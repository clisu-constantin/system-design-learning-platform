/**
 * Calls to the progress API (server/, base URL from VITE_API_URL).
 *
 * Never throws: every outcome is a result, because the server is a backup and
 * a bridge between devices, never a gate. A down server, no network or a slow
 * answer is a quiet failure the caller may retry later; nothing renders
 * waiting for it. Use it through `useAccount().request`, which adds the ID
 * token and answers a 410 (Account deleted) by signing out.
 *
 * No imports, so Node runs this file and its tests as they are.
 */

export type ApiFailure =
  /** No network, DNS, CORS or the server is down. */
  | 'offline'
  /** No answer within the timeout. */
  | 'timeout'
  /** 401: the token was missing, expired or for another Firebase project. */
  | 'unauthorized'
  /** 410: this Account was deleted - the app signs out and becomes an empty Guest. */
  | 'gone'
  /** Any other 4xx, such as a body that does not validate (422). */
  | 'rejected'
  /** 5xx, or a success that is not JSON (a proxy error page). */
  | 'server'
  /** This build has no API, or no one is signed in. */
  | 'unavailable';

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; reason: ApiFailure };

export interface ApiFetchOptions {
  baseUrl: string;
  /** The Firebase ID token. */
  token: string;
  method?: 'GET' | 'POST' | 'DELETE';
  /** Sent as JSON. */
  body?: unknown;
  timeoutMs?: number;
  /** For tests. */
  fetch?: typeof globalThis.fetch;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

function failureOf(status: number): ApiFailure {
  if (status === 401) return 'unauthorized';
  if (status === 410) return 'gone';
  // Only these say the body itself is wrong, so sending it again cannot work. Any other 4xx (a proxy
  // 404, a 408, a 429 rate limit) is about this moment, and is retried like a server error.
  if (status === 400 || status === 413 || status === 422) return 'rejected';
  return 'server';
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<ApiResult<T>> {
  const { baseUrl, token, method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const doFetch = options.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const response = await doFetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, status: response.status, reason: failureOf(response.status) };
    if (response.status === 204) return { ok: true, status: 204, data: undefined as T };
    try {
      return { ok: true, status: response.status, data: (await response.json()) as T };
    } catch {
      return timedOut
        ? { ok: false, status: 0, reason: 'timeout' }
        : { ok: false, status: response.status, reason: 'server' };
    }
  } catch {
    return { ok: false, status: 0, reason: timedOut ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** VITE_API_URL without a trailing slash, or null when this build has no API. */
export function apiUrlFrom(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '');
  return trimmed ? trimmed : null;
}
