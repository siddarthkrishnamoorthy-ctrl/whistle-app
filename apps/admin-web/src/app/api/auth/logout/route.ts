import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/api-server";
import { REFRESH_COOKIE, clearRefreshCookie } from "@/lib/auth-cookie";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  const res = NextResponse.json({ success: true });
  clearRefreshCookie(res);

  if (!refreshToken) return res;

  const accessToken = req.headers.get("authorization");
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: accessToken } : {}),
    },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => undefined);

  return res;
}
