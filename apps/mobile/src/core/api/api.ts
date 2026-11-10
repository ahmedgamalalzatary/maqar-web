import type { ApiErrorBody } from '@maqar/shared';
import Constants from 'expo-constants';
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

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Do not send the access token or try to refresh (the auth routes themselves). */
  anonymous?: boolean;
  /** Return the body as text (e.g. a calendar file) instead of reading JSON. */
  text?: boolean;
};

async function send(path: string, opts: ApiOptions, token: string | null | undefined): Promise<Response> {
  const headers = new Headers(opts.headers);
  headers.set('Accept', opts.text ? 'text/plain, text/calendar, */*' : 'application/json');
  // FormData (photos) sets its own multipart type and boundary.
  const form = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body !== undefined && !form) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(apiBaseUrl() + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : form ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, 'Network request failed');
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
