import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/api-server";
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from "@/lib/auth-cookie";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }

  const apiRes = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await apiRes.json();
  if (!apiRes.ok) {
    const res = NextResponse.json(data, { status: apiRes.status });
    clearRefreshCookie(res);
    return res;
  }

  const res = NextResponse.json({ accessToken: data.accessToken, user: data.user });
  setRefreshCookie(res, data.refreshToken, false);
  return res;
}
