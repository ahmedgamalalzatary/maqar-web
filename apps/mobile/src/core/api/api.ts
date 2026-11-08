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

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

/** JSON request to the Maqar API. `path` starts with "/", e.g. "/health". */
export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set('Accept', 'application/json');
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(apiBaseUrl() + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, 'Network request failed');
  }

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const msg = (data as Partial<ApiErrorBody> | undefined)?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join('\n') : (msg ?? res.statusText));
  }
  return data as T;
}
