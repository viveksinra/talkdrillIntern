'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearAuth, getAuth, setAuth, type StoredAuth } from './tokens';

interface AuthState {
  /** null while hydrating from localStorage (first client render). */
  ready: boolean;
  auth: StoredAuth | null;
  login: (auth: StoredAuth) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  ready: false,
  auth: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [auth, setAuthState] = useState<StoredAuth | null>(null);

  useEffect(() => {
    setAuthState(getAuth());
    setReady(true);
  }, []);

  const login = useCallback((next: StoredAuth) => {
    setAuth(next);
    setAuthState(next);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setAuthState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ ready, auth, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
