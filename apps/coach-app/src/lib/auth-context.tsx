import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser } from "@whistle/shared";
import { apiFetch, clearTokens, refreshSession, storeTokens } from "./api-client";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  apiUnreachable: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContextInternal = createContext<AuthContextValue | undefined>(undefined);

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
  const [loading, setLoading] = useState(true);
  const [apiUnreachable, setApiUnreachable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then((result) => {
        if (cancelled) return;
        if (result) {
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
      loading,
      apiUnreachable,
      async signIn(email, password) {
        let res: Response;
        try {
          res = await apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
        } catch {
          throw new Error("Can't reach the server. Is the backend running?");
        }
        if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not log in."));
        const data = await res.json();
        await storeTokens(data.accessToken, data.refreshToken);
        setUser(data.user);
      },
      async signUp(fullName, email, password) {
        let res: Response;
        try {
          res = await apiFetch("/auth/signup", {
            method: "POST",
            body: JSON.stringify({ fullName, email, password }),
          });
        } catch {
          throw new Error("Can't reach the server. Is the backend running?");
        }
        if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not sign up."));
        const data = await res.json();
        await storeTokens(data.accessToken, data.refreshToken);
        setUser(data.user);
      },
      async signOut() {
        await clearTokens();
        setUser(null);
      },
    }),
    [user, loading, apiUnreachable]
  );

  return <AuthContextInternal.Provider value={value}>{children}</AuthContextInternal.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContextInternal);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
