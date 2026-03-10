import { useState, useCallback, useEffect } from "react";

const TOKEN_KEY = "chronolore-token";
const USER_KEY = "chronolore-user";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [user, setUserState] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setAuth = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setTokenState(token);
    setUserState(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setTokenState(null);
    setUserState(null);
  }, []);

  const isAuthenticated = !!token && !!user;

  return { token, user, isAuthenticated, setAuth, logout };
}

/** Helper for authenticated API calls */
export function authHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
