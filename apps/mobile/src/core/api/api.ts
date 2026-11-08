import type { ApiErrorBody } from '@maqar/shared';
import Constants from 'expo-constants';
import { resolveApiUrl } from './api-url';

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
};

async function send(path: string, opts: ApiOptions, token: string | null | undefined): Promise<Response> {
  const headers = new Headers(opts.headers);
  headers.set('Accept', 'application/json');
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(apiBaseUrl() + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, 'Network request failed');
  }
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
