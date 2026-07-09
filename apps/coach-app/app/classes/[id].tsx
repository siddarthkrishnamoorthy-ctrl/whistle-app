import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import type { ClassSummary } from "@whistle/shared";

type ClassDetail = ClassSummary & {
  enrollments?: { id: string; status: string; client: { id: string; name: string } }[];
  classPlans?: { plan: { id: string; name: string } }[];
};

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [klass, setKlass] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiJson<ClassDetail>(`/classes/${id}`)
      .then(setKlass)
      .catch(() => setKlass(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingView />;
  if (!klass) return <EmptyState message="Class not found." />;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>{klass.title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          {klass.level ? <Pill tone="info">{klass.level}</Pill> : null}
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {klass.sport.name} · {klass.center.name}
          </Text>
        </View>
      </View>

      {klass.timings?.length ? (
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>
            Timings
          </Text>
          {klass.timings.map((t, i) => (
            <Text key={i} style={{ color: colors.textPrimary, fontSize: 13, marginTop: 2 }}>
              {t.days.join(", ")} · {t.startTime} – {t.endTime}
            </Text>
          ))}
        </Card>
      ) : null}

      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
          Students {klass.enrollments?.length ? `(${klass.enrollments.length})` : ""}
        </Text>
        {!klass.enrollments || klass.enrollments.length === 0 ? (
          <EmptyState message="No students enrolled yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {klass.enrollments.map((e) => (
              <Card key={e.id}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{e.client.name}</Text>
                  <Pill tone={e.status === "active" ? "success" : "neutral"}>{e.status}</Pill>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
