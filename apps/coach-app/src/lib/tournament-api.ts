import { getItem, setItem, deleteItem } from "./token-storage";
import { API_URL } from "./api-client";

// The Tournament module is a standalone product surface with its own user
// master — its session must never mix with the academy coach session, so it
// uses its own storage keys and fetch helper.
const T_ACCESS_KEY = "tournament_access_token";
const T_USER_KEY = "tournament_user";

export interface TournamentUser {
  id: string;
  name: string;
  email: string;
  role: "organizer" | "official" | "registrant";
  organizationName: string | null;
}

let tAccessToken: string | null = null;
let tUser: TournamentUser | null = null;

export async function loadTournamentSession(): Promise<TournamentUser | null> {
  tAccessToken = await getItem(T_ACCESS_KEY);
  const raw = await getItem(T_USER_KEY);
  tUser = raw ? (JSON.parse(raw) as TournamentUser) : null;
  return tAccessToken ? tUser : null;
}

export function tournamentUser(): TournamentUser | null {
  return tUser;
}

export async function storeTournamentSession(accessToken: string, user: TournamentUser): Promise<void> {
  tAccessToken = accessToken;
  tUser = user;
  await setItem(T_ACCESS_KEY, accessToken);
  await setItem(T_USER_KEY, JSON.stringify(user));
}

export async function clearTournamentSession(): Promise<void> {
  tAccessToken = null;
  tUser = null;
  await deleteItem(T_ACCESS_KEY);
  await deleteItem(T_USER_KEY);
}

export async function tFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (tAccessToken) headers.set("Authorization", `Bearer ${tAccessToken}`);
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
  const data = await tFetch<{ accessToken: string; user: TournamentUser }>("/tournament-auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
  await storeTournamentSession(data.accessToken, data.user);
  return data.user;
}

export async function tournamentLogin(email: string, password: string): Promise<TournamentUser> {
  const data = await tFetch<{ accessToken: string; user: TournamentUser }>("/tournament-auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await storeTournamentSession(data.accessToken, data.user);
  return data.user;
}
