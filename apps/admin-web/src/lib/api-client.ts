// Browser-side API client for everything except auth (auth goes through the
// Next.js Route Handlers in src/app/api/auth/* so the refresh token can stay
// in an httpOnly cookie — see auth-context.tsx). Data endpoints are called
// directly against the NestJS API with the access token in memory.
import type { AuthUser } from "@whistle/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

// Uploaded files are served by the backend outside the /api/v1 prefix (see
// backend/src/main.ts's useStaticAssets) — strip the prefix to get the
// origin they hang off of.
export const ASSET_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, "");

export function assetUrl(path: string): string {
  return `${ASSET_BASE_URL}${path}`;
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

interface RefreshResult {
  accessToken: string;
  user: AuthUser;
}

// The backend rotates refresh tokens on every use (old one is revoked the
// instant a new one is issued). React can mount AuthProvider's effect twice
// in dev (StrictMode) or otherwise trigger overlapping refresh attempts —
// without dedup, the second concurrent call reads the same pre-rotation
// cookie the first call already consumed, gets a 401, and its error path
// clears the cookie the first call just successfully set. Sharing one
// in-flight promise means only one request ever actually goes out.
let inFlightRefresh: Promise<RefreshResult | null> | null = null;

export function refreshSession(): Promise<RefreshResult | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = fetch("/api/auth/refresh", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        accessToken = data.accessToken;
        return data as RefreshResult;
      })
      .catch(() => null)
      .finally(() => {
        inFlightRefresh = null;
      });
  }
  return inFlightRefresh;
}

export async function apiFetch(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  // Skip auto Content-Type for FormData — the browser needs to set its own
  // multipart boundary, which a hardcoded "application/json" would break.
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

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

export async function apiUploadImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  return apiJson<{ url: string }>("/uploads/image", { method: "POST", body: form });
}
