const TOKEN_KEY = "chronolore-token";
const USER_KEY = "chronolore-user";

export const AUTH_EXPIRED_EVENT = "chronolore-auth-expired";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): string | null {
  return localStorage.getItem(USER_KEY);
}

export function storeAuth(token: string, user: unknown) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function notifyAuthExpired() {
  clearStoredAuth();
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}
