import type { AuthUser } from "@whistle/shared";
import { getItem, setItem, deleteItem } from "./token-storage";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const ACCESS_KEY = "whistle_access_token";
const REFRESH_KEY = "whistle_refresh_token";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export async function loadStoredTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  accessToken = await getItem(ACCESS_KEY);
  return { accessToken, refreshToken: await getItem(REFRESH_KEY) };
}

export async function storeTokens(access: string, refresh: string): Promise<void> {
  accessToken = access;
  await setItem(ACCESS_KEY, access);
  await setItem(REFRESH_KEY, refresh);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  await deleteItem(ACCESS_KEY);
  await deleteItem(REFRESH_KEY);
}

interface RefreshResult {
  accessToken: string;
  user: AuthUser;
}

// The backend rotates refresh tokens on every use (old one is revoked the
// instant a new one is issued). Both the mount-time silent refresh and
// apiFetch's 401-retry path need this, and if they (or two 401s) ever fire
// concurrently, the second caller would present an already-consumed token
// and fail. Sharing one in-flight promise means every caller awaits the same
// single request/rotation instead of racing each other.
let inFlightRefresh: Promise<RefreshResult | null> | null = null;

export function refreshSession(): Promise<RefreshResult | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const refreshToken = await getItem(REFRESH_KEY);
      if (!refreshToken) return null;
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      await storeTokens(data.accessToken, data.refreshToken);
      return data as RefreshResult;
    })()
      .catch(() => null)
      .finally(() => {
        inFlightRefresh = null;
      });
  }
  return inFlightRefresh;
}

// Attaches the current access token and, on a 401, transparently refreshes
// once and retries — every screen just calls apiFetch instead of juggling
// tokens itself.
export async function apiFetch(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed) return apiFetch(path, options, false);
  }
  return res;
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
