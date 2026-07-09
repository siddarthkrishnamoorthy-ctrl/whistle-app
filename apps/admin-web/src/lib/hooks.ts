"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { apiJson } from "./api-client";

// Generic list-fetching hook for admin screens: waits for auth to settle
// (silent refresh on mount) before calling the API, and exposes `refetch` so
// screens can re-pull after a create/update/delete instead of wiring up
// real-time subscriptions (Firestore's onSnapshot has no REST equivalent —
// simple refetch-on-mutation is the right level of complexity here).
export function useApiList<T>(path: string | null) {
  const { loading: authLoading, user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (authLoading || !user || !path) return;
    setLoading(true);
    setError(null);
    apiJson<T[]>(path)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [authLoading, user, path, version]);

  return { data, loading, error, refetch: () => setVersion((v) => v + 1) };
}
