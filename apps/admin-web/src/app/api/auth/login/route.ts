import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/api-server";
import { setRefreshCookie } from "@/lib/auth-cookie";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const apiRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await apiRes.json();
  if (!apiRes.ok) return NextResponse.json(data, { status: apiRes.status });

  const res = NextResponse.json({ accessToken: data.accessToken, user: data.user });
  setRefreshCookie(res, data.refreshToken, Boolean(body.rememberMe));
  return res;
}
