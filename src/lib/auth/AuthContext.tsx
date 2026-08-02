'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearAuth, getAuth, setAuth, type StoredAuth } from './tokens';
import { clearViewAs, getViewAs, setViewAs, type ViewAsTarget } from './viewAs';

/** The nav shape cached by AppShell — must be dropped whenever the identity changes. */
const NAV_SNAPSHOT_KEY = 'td_internship_nav';

const dropNavSnapshot = () => {
  try {
    localStorage.removeItem(NAV_SNAPSHOT_KEY);
  } catch {
    /* non-critical */
  }
};

interface AuthState {
  /** null while hydrating from localStorage (first client render). */
  ready: boolean;
  auth: StoredAuth | null;
  login: (auth: StoredAuth) => void;
  logout: () => void;
  /**
   * Set when a team member is looking through an intern's profile. The token is
   * still the admin's — only the `X-View-As-Intern` header changes — so this is
   * a display/routing concern, never an authorization one. The backend decides.
   */
  viewAs: ViewAsTarget | null;
  enterViewAs: (target: ViewAsTarget) => void;
  exitViewAs: () => void;
}

const AuthContext = createContext<AuthState>({
  ready: false,
  auth: null,
  login: () => {},
  logout: () => {},
  viewAs: null,
  enterViewAs: () => {},
  exitViewAs: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [auth, setAuthState] = useState<StoredAuth | null>(null);
  const [viewAs, setViewAsState] = useState<ViewAsTarget | null>(null);

  useEffect(() => {
    setAuthState(getAuth());
    setViewAsState(getViewAs());
    setReady(true);
  }, []);

  const login = useCallback((next: StoredAuth) => {
    setAuth(next);
    setAuthState(next);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    // A stale view-as would otherwise outlive the session and send the header on
    // the NEXT person's login from this browser.
    clearViewAs();
    setAuthState(null);
    setViewAsState(null);
  }, []);

  // Entering/leaving view-as changes which nav the shell should show, so the
  // cached snapshot has to go with it — same reason logout clears it.
  const enterViewAs = useCallback((target: ViewAsTarget) => {
    setViewAs(target);
    dropNavSnapshot();
    setViewAsState(target);
  }, []);

  const exitViewAs = useCallback(() => {
    clearViewAs();
    dropNavSnapshot();
    setViewAsState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ ready, auth, login, logout, viewAs, enterViewAs, exitViewAs }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/**
 * True when the current session may only READ. Impersonating a real intern is
 * read-only (the backend 403s any non-GET); a sandbox persona is writable, which
 * is the whole point of having one.
 */
export function useReadOnly(): boolean {
  const { viewAs } = useAuth();
  return !!viewAs && !viewAs.isSandbox;
}
