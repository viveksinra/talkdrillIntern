/**
 * Token storage for the internship portal SPA.
 *
 * The portal is on a different origin than the backend, so auth is a Bearer
 * JWT stored client-side (localStorage) and sent on every API call — the same
 * model the TalkDrill app and admin panel use.
 *
 * Two principal types share one storage slot:
 *  - intern: regular TalkDrill user (email OTP login) — has refreshToken rotation
 *  - admin : myTeam member (password + email 2FA)     — 7d/180d token, no refresh
 */

export type Principal = 'intern' | 'admin';

export interface StoredUser {
  id: string;
  name?: string;
  email?: string;
  profileImage?: string;
}

export interface StoredAuth {
  principal: Principal;
  accessToken: string;
  refreshToken?: string;
  user: StoredUser;
}

const KEY = 'td_internship_auth';

export function getAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.accessToken || !parsed?.principal) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setAuth(auth: StoredAuth): void {
  window.localStorage.setItem(KEY, JSON.stringify(auth));
}

export function updateTokens(accessToken: string, refreshToken?: string): void {
  const current = getAuth();
  if (!current) return;
  setAuth({ ...current, accessToken, refreshToken: refreshToken ?? current.refreshToken });
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}
