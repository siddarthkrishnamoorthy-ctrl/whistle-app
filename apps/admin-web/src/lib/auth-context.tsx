"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser } from "@whistle/shared";
import { setAccessToken as syncApiClientToken, refreshSession } from "./api-client";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  apiUnreachable: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signUp: (fullName: string, email: string, password: string, declaredStrength?: number) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.message || fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiUnreachable, setApiUnreachable] = useState(false);

  function applyToken(token: string | null) {
    setAccessTokenState(token);
    syncApiClientToken(token);
  }

  useEffect(() => {
    // A refresh cookie may exist from a previous session — try a silent
    // refresh on mount rather than forcing the user to log in again.
    // refreshSession() dedupes concurrent calls (see api-client.ts) so this
    // is safe even under React's double-invoke-effects-in-dev behavior.
    let cancelled = false;
    refreshSession()
      .then((result) => {
        if (cancelled) return;
        if (result) {
          applyToken(result.accessToken);
          setUser(result.user);
        }
      })
      .catch(() => !cancelled && setApiUnreachable(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      loading,
      apiUnreachable,
      async signIn(email, password, rememberMe) {
        let res: Response;
        try {
          res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, rememberMe }),
          });
        } catch {
          throw new Error("Can't reach the server. Is the backend running?");
        }
        if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not log in."));
        const data = await res.json();
        applyToken(data.accessToken);
        setUser(data.user);
      },
      async signUp(fullName, email, password, declaredStrength) {
        let res: Response;
        try {
          res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName, email, password, declaredStrength }),
          });
        } catch {
          throw new Error("Can't reach the server. Is the backend running?");
        }
        if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not sign up."));
        const data = await res.json();
        applyToken(data.accessToken);
        setUser(data.user);
      },
      async signOut() {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        }).catch(() => undefined);
        applyToken(null);
        setUser(null);
      },
    }),
    [user, accessToken, loading, apiUnreachable]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
