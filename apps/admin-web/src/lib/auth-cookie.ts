import type { NextResponse } from "next/server";

export const REFRESH_COOKIE = "whistle_refresh_token";

// Matches the backend's default (30d) / remember-me (90d) refresh TTL —
// see backend/src/auth/auth.service.ts. The cookie's own maxAge just governs
// how long the browser keeps sending it; the server independently enforces
// expiry against the RefreshToken row.
const THIRTY_DAYS = 30 * 24 * 60 * 60;
const NINETY_DAYS = 90 * 24 * 60 * 60;

export function setRefreshCookie(res: NextResponse, refreshToken: string, rememberMe: boolean) {
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: rememberMe ? NINETY_DAYS : THIRTY_DAYS,
  });
}

export function clearRefreshCookie(res: NextResponse) {
  res.cookies.set(REFRESH_COOKIE, "", { path: "/api/auth", maxAge: 0 });
}
