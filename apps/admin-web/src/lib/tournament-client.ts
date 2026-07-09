"use client";

// The Tournament module is a standalone product surface with its own user
// master (organizer/official/registrant) — separate from the academy admin
// session. Its token lives under its own localStorage keys so logging in or
// out of either side never affects the other.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const T_TOKEN_KEY = "whistle_tournament_token";
const T_USER_KEY = "whistle_tournament_user";

export interface TournamentUser {
  id: string;
  name: string;
  email: string;
  role: "organizer" | "official" | "registrant";
  organizationName: string | null;
}

export function tournamentSession(): { token: string; user: TournamentUser } | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(T_TOKEN_KEY);
  const raw = window.localStorage.getItem(T_USER_KEY);
  if (!token || !raw) return null;
  try {
    return { token, user: JSON.parse(raw) as TournamentUser };
  } catch {
    return null;
  }
}

export function clearTournamentSession(): void {
  window.localStorage.removeItem(T_TOKEN_KEY);
  window.localStorage.removeItem(T_USER_KEY);
}

function storeSession(token: string, user: TournamentUser): void {
  window.localStorage.setItem(T_TOKEN_KEY, token);
  window.localStorage.setItem(T_USER_KEY, JSON.stringify(user));
}

export async function tJson<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const session = tournamentSession();
  const headers = new Headers(options.headers);
  if (session) headers.set("Authorization", `Bearer ${session.token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function tournamentSignup(body: {
  name: string;
  email: string;
  password: string;
  role: string;
  organizationName?: string;
}): Promise<TournamentUser> {
  const data = await tJson<{ accessToken: string; user: TournamentUser }>("/tournament-auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
  storeSession(data.accessToken, data.user);
  return data.user;
}

export async function tournamentLogin(email: string, password: string): Promise<TournamentUser> {
  const data = await tJson<{ accessToken: string; user: TournamentUser }>("/tournament-auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  storeSession(data.accessToken, data.user);
  return data.user;
}
