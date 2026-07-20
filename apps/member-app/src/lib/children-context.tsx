import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiJson } from "./api-client";
import { useAuth } from "./auth-context";

// Shape returned by GET /auth/me/children (client + academy/center/enrollments).
export interface ChildClient {
  id: string;
  name: string;
  academy?: { id: string; name: string } | null;
  center?: { id: string; name: string } | null;
  enrollments?: {
    id: string;
    status: string;
    class?: { id: string; title: string; sportKey: string } | null;
  }[];
}

interface ChildrenContextValue {
  children: ChildClient[];
  selectedChild: ChildClient | null;
  selectChild: (id: string) => void;
  loading: boolean;
  refresh: () => void;
}

const ChildrenContext = createContext<ChildrenContextValue>({
  children: [],
  selectedChild: null,
  selectChild: () => undefined,
  loading: true,
  refresh: () => undefined,
});

export function ChildrenProvider({ children: node }: { children: ReactNode }) {
  const { user } = useAuth();
  const [kids, setKids] = useState<ChildClient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!user) {
      setKids([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiJson<ChildClient[]>("/auth/me/children")
      .then((all) => {
        setKids(all);
        setSelectedId((prev) => (prev && all.some((c) => c.id === prev) ? prev : (all[0]?.id ?? null)));
      })
      .catch(() => setKids([]))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(refresh, [refresh]);

  const value = useMemo<ChildrenContextValue>(
    () => ({
      children: kids,
      selectedChild: kids.find((c) => c.id === selectedId) ?? null,
      selectChild: setSelectedId,
      loading,
      refresh,
    }),
    [kids, selectedId, loading, refresh]
  );

  return <ChildrenContext.Provider value={value}>{node}</ChildrenContext.Provider>;
}

export function useChildren() {
  return useContext(ChildrenContext);
}
