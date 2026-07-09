import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { EmptyState, ListRow, Pill, colors } from "@/components/ui";
import type { ClassSummary } from "@whistle/shared";

export default function ClassesScreen() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.academyId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      apiJson<ClassSummary[]>("/classes")
        .then((all) => {
          if (cancelled) return;
          setClasses(all.filter((c) => c.coach?.userId === user.id));
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [user])
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>My Classes</Text>

      {loading ? (
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      ) : classes.length === 0 ? (
        <EmptyState message="No classes assigned to you yet." />
      ) : (
        <View style={{ gap: 8 }}>
          {classes.map((c) => (
            <ListRow
              key={c.id}
              title={c.title}
              subtitle={`${c.sport.name} · ${c.center.name} · ${c._count?.enrollments ?? 0} students`}
              right={<Pill tone="info">{c.level ?? "—"}</Pill>}
              onPress={() => router.push(`/classes/${c.id}`)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
