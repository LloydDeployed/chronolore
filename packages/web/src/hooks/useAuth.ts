import { useState, useCallback, useEffect } from "react";
import { toast } from "../components/Toast";
import {
  AUTH_EXPIRED_EVENT,
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  storeAuth,
} from "../auth/session";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(() =>
    getStoredToken(),
  );
  const [user, setUserState] = useState<User | null>(() => {
    try {
      const raw = getStoredUser();
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setAuth = useCallback((token: string, user: User) => {
    storeAuth(token, user);
    setTokenState(token);
    setUserState(user);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setTokenState(null);
    setUserState(null);
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      if (token || user) {
        setTokenState(null);
        setUserState(null);
        toast("Your session expired. Please sign in again.");
      }
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, [token, user]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401 && !cancelled) {
            clearStoredAuth();
            setTokenState(null);
            setUserState(null);
            toast("Your session expired. Please sign in again.");
          }
          return null;
        }
        return (await res.json()) as User;
      })
      .then((nextUser) => {
        if (cancelled || !nextUser) return;
        setUserState(nextUser);
      })
      .catch(() => {
        // Ignore startup auth validation failures unless the API explicitly
        // rejected the token.
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const isAuthenticated = !!token && !!user;

  return { token, user, isAuthenticated, setAuth, logout };
}

/** Helper for authenticated API calls */
export function authHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
