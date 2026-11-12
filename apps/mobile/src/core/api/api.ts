import type { ApiErrorBody } from '@maqar/shared';
import Constants from 'expo-constants';
import { File, UploadType } from 'expo-file-system';
import { mediaUrlFrom, resolveApiUrl } from './api-url';

/** An HTTP error from the API. `status` is 0 when the server could not be reached. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let baseUrl: string | undefined;
export function apiBaseUrl(): string {
  baseUrl ??= resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, Constants.expoConfig?.hostUri);
  return baseUrl;
}

/** Full URL of a photo path from the API (`/uploads/...`). */
export const mediaUrl = (path: string | null): string | null => mediaUrlFrom(apiBaseUrl(), path);

/**
 * How the client talks to the session (the auth feature registers these at start-up,
 * so core does not depend on a feature).
 */
export type AuthHandlers = {
  getAccessToken: () => string | null;
  /** Gets a new access token. False when the session is over. */
  refresh: () => Promise<boolean>;
  /** The session cannot be renewed: sign the user out locally. */
  onAuthFailure: () => void;
};

let auth: AuthHandlers | undefined;
let refreshing: Promise<boolean> | undefined;

export function setAuthHandlers(handlers: AuthHandlers | undefined): void {
  auth = handlers;
}

/** Requests that fail together share one refresh. */
function refreshOnce(handlers: AuthHandlers): Promise<boolean> {
  refreshing ??= handlers.refresh().finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}

/** The application deadline for every request, so nothing waits on a stalled connection. */
export const REQUEST_TIMEOUT_MS = 20_000;

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Override the request deadline (tests, long uploads). */
  timeoutMs?: number;
  /** Do not send the access token or try to refresh (the auth routes themselves). */
  anonymous?: boolean;
  /** Return the body as text (e.g. a calendar file) instead of reading JSON. */
  text?: boolean;
};

/** One signal for the caller's cancel and the deadline, whichever lands first. */
function boundedSignal(opts: ApiOptions): { signal: AbortSignal; timedOut: () => boolean; done: () => void } {
  const controller = new AbortController();
  let callerAborted = false;
  let timedOutFlag = false;
  const onCallerAbort = () => {
    callerAborted = true;
    controller.abort();
  };
  if (opts.signal) {
    if (opts.signal.aborted) onCallerAbort();
    else opts.signal.addEventListener('abort', onCallerAbort);
  }
  const timer = setTimeout(() => {
    timedOutFlag = true;
    controller.abort();
  }, opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    timedOut: () => timedOutFlag && !callerAborted,
    done: () => {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onCallerAbort);
    },
  };
}

async function send(path: string, opts: ApiOptions, token: string | null | undefined): Promise<Response> {
  const headers = new Headers(opts.headers);
  headers.set('Accept', opts.text ? 'text/plain, text/calendar, */*' : 'application/json');
  // FormData (photos) sets its own multipart type and boundary.
  const form = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body !== undefined && !form) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const bound = boundedSignal(opts);
  try {
    return await fetch(apiBaseUrl() + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : form ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: bound.signal,
    });
  } catch {
    if (bound.timedOut()) throw new ApiError(0, 'Request timed out');
    throw new ApiError(0, 'Network request failed');
  } finally {
    bound.done();
  }
}

/** The current access token, for the chat socket. */
export const accessToken = (): string | null => auth?.getAccessToken() ?? null;

/**
 * Renews the access token (the chat socket's was refused). False when the session is over, after
 * signing out locally, as a refused HTTP request would.
 */
export async function renewAccess(): Promise<boolean> {
  if (!auth) return false;
  const handlers = auth;
  const ok = await refreshOnce(handlers);
  if (!ok) handlers.onAuthFailure();
  return ok;
}

/** JSON request to the Maqar API. `path` starts with "/", e.g. "/health". */
export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const sentWith = opts.anonymous ? null : auth?.getAccessToken();
  let res = await send(path, opts, sentWith);

  // An expired access token: renew it once and retry.
  if (res.status === 401 && auth && sentWith) {
    const handlers = auth;
    if (handlers.getAccessToken() !== sentWith) {
      // Another request already renewed the token while this one was out.
      res = await send(path, opts, handlers.getAccessToken());
    } else if (await refreshOnce(handlers)) {
      res = await send(path, opts, handlers.getAccessToken());
    } else {
      handlers.onAuthFailure();
    }
  }

  const text = await res.text();
  if (opts.text && res.ok) return text as T;
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // Not JSON, e.g. a proxy's HTML error page. Keep the HTTP status.
    if (!res.ok) throw new ApiError(res.status, res.statusText || 'Request failed');
    throw new ApiError(res.status, 'The server sent an unreadable response');
  }
  if (!res.ok) {
    const msg = (data as Partial<ApiErrorBody> | undefined)?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join('\n') : (msg ?? res.statusText));
  }
  return data as T;
}

/** A file from the phone's disk for `apiUpload`: the form field it goes in and its type. */
export type UploadFile = { uri: string; field: string; type: string };

/**
 * Sends one file from the phone's disk as a multipart field, streamed by the OS rather than read
 * into memory (listing videos are up to 150 MB). Reports the fraction sent; renews the access
 * token once if it expired on the way, like `apiFetch`.
 */
export async function apiUpload<T>(path: string, file: UploadFile, onProgress?: (sent: number) => void): Promise<T> {
  const send = async (token: string | null | undefined) => {
    try {
      return await new File(file.uri).upload(apiBaseUrl() + path, {
        uploadType: UploadType.MULTIPART,
        fieldName: file.field,
        mimeType: file.type,
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        sessionType: 'foreground',
        onProgress: ({ bytesSent, totalBytes }) => onProgress?.(totalBytes > 0 ? Math.min(1, bytesSent / totalBytes) : 0),
      });
    } catch {
      throw new ApiError(0, 'Network request failed');
    }
  };
  const sentWith = auth?.getAccessToken();
  let res = await send(sentWith);
  if (res.status === 401 && auth && sentWith) {
    const handlers = auth;
    if (handlers.getAccessToken() !== sentWith) res = await send(handlers.getAccessToken());
    else if (await refreshOnce(handlers)) res = await send(handlers.getAccessToken());
    else handlers.onAuthFailure();
  }
  let data: unknown;
  try {
    data = res.body ? JSON.parse(res.body) : undefined;
  } catch {
    throw new ApiError(res.status, res.status >= 400 ? 'Request failed' : 'The server sent an unreadable response');
  }
  if (res.status < 200 || res.status >= 300) {
    const msg = (data as Partial<ApiErrorBody> | undefined)?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join('\n') : (msg ?? 'Request failed'));
  }
  return data as T;
}
