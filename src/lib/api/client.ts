import { API_BASE_URL } from '@/config/env';
import { clearAuth, getAuth, updateTokens } from '@/lib/auth/tokens';
import { getViewAs, VIEW_AS_HEADER } from '@/lib/auth/viewAs';

/**
 * Typed API client — ALL backend calls go through here.
 *
 * Backend response envelope (utils/responseHelpers.js on the server):
 *   { message: string, variant: 'success'|'error'|'info', myData?: T }
 * Some legacy endpoints return errors with HTTP 200 + variant:'error',
 * so we treat variant === 'error' as a failure regardless of status code.
 */

export interface Envelope<T> {
  message: string;
  variant: 'success' | 'error' | 'info' | string;
  myData?: T;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  myData?: unknown;
  constructor(message: string, status: number, myData?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.myData = myData;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach Authorization header (default true). */
  auth?: boolean;
  /** Internal — one silent refresh+retry on 401. */
  _retry?: boolean;
}

/** Single-flight refresh so parallel 401s don't burn the rotating refresh token. */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const stored = getAuth();
      if (!stored?.refreshToken) return false;
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: stored.refreshToken }),
        });
        const json = (await res.json()) as Envelope<{
          accessToken: string;
          refreshToken: string;
        }>;
        if (!res.ok || json.variant === 'error' || !json.myData?.accessToken) return false;
        updateTokens(json.myData.accessToken, json.myData.refreshToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      // allow a future refresh cycle
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    });
  }
  return refreshPromise;
}

export async function api<T = unknown>(
  path: string,
  { method = 'GET', body, auth = true, _retry = true }: RequestOptions = {}
): Promise<Envelope<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const stored = getAuth();
    if (stored?.accessToken) headers['Authorization'] = `Bearer ${stored.accessToken}`;
    // "View as": the admin keeps their OWN token and names the intern they want
    // to look through. The backend ignores this header for anyone who is not a
    // myTeam member, so sending it is inert for a normal intern session.
    const viewAs = getViewAs();
    if (viewAs) headers[VIEW_AS_HEADER] = viewAs.internProfileId;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error — is the server reachable?', 0);
  }

  // Expired/revoked access token → one silent refresh + retry (interns only;
  // admin tokens have no refresh token and fall through to logout).
  if (res.status === 401 && auth && _retry) {
    if (await tryRefresh()) {
      return api<T>(path, { method, body, auth, _retry: false });
    }
    clearAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError('Session expired. Please log in again.', 401);
  }

  const json = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok || json.variant === 'error') {
    throw new ApiError(json.message || `Request failed (${res.status})`, res.status, json.myData);
  }
  return json;
}
