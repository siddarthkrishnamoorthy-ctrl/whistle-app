import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useChildren } from "@/lib/children-context";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import type { Drill, LessonPlan } from "@whistle/shared";

interface FitnessTestHistory {
  test: { id: string; name: string; unit: string; metricType: string };
  results: {
    cycleTitle: string;
    value: number;
    benchmarkZone: string | null;
    recordedAt: string;
  }[];
}

const ZONE_TONE: Record<string, "success" | "warning" | "neutral"> = {
  "High Performance": "success",
  "Healthy Zone": "success",
  "Needs Improvement": "warning",
};

export default function ChildScreen() {
  const { selectedChild, loading } = useChildren();
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [fitness, setFitness] = useState<FitnessTestHistory[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!selectedChild) return;
      let cancelled = false;
      apiJson<LessonPlan[]>("/lesson-plans")
        .then((all) => !cancelled && setLessonPlans(all))
        .catch(() => undefined);
      apiJson<Drill[]>("/drills")
        .then((all) => !cancelled && setDrills(all))
        .catch(() => undefined);
      apiJson<FitnessTestHistory[]>(`/assessment-history/${selectedChild.id}`)
        .then((all) => !cancelled && setFitness(all))
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [selectedChild])
  );

  if (loading) return <LoadingView />;
  if (!selectedChild) return <EmptyState message="No child linked yet. Link your player from the Home tab." />;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>{selectedChild.name}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
          {[selectedChild.academy?.name, selectedChild.center?.name].filter(Boolean).join(" · ")}
        </Text>
      </View>

      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
          Enrolled classes
        </Text>
        {!selectedChild.enrollments || selectedChild.enrollments.length === 0 ? (
          <EmptyState message="Not enrolled in any class yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {selectedChild.enrollments.map((e) => (
              <Card key={e.id}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                      {e.class?.title ?? "Class"}
                    </Text>
                    {e.class?.sportKey ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{e.class.sportKey}</Text>
                    ) : null}
                  </View>
                  <Pill tone={e.status === "active" ? "success" : "neutral"}>{e.status}</Pill>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* Periodic Assessment history (Assessment Module BRD 4.6): every
          completed cycle's result, its benchmark zone and the trend. */}
      {fitness.length > 0 && (
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
            Fitness tests
          </Text>
          <View style={{ gap: 8 }}>
            {fitness.map((f) => {
              const latest = f.results.at(-1);
              const prev = f.results.at(-2);
              const delta =
                latest && prev
                  ? Math.round((latest.value - prev.value) * 100) / 100
                  : null;
              const improved =
                delta != null && (f.test.metricType === "time" ? delta < 0 : delta > 0);
              return (
                <Card key={f.test.id}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{f.test.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                        {latest ? `${latest.value} ${f.test.unit} · ${latest.cycleTitle}` : "—"}
                      </Text>
                      {delta != null && (
                        <Text style={{ color: improved ? colors.success : colors.warning, fontSize: 12, marginTop: 2 }}>
                          {improved ? "▲ improved" : "▼"} {Math.abs(delta)} {f.test.unit} vs last cycle
                        </Text>
                      )}
                    </View>
                    {latest?.benchmarkZone ? (
                      <Pill tone={ZONE_TONE[latest.benchmarkZone] ?? "neutral"}>{latest.benchmarkZone}</Pill>
                    ) : null}
                  </View>
                  {f.results.length > 1 && (
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                      Trend: {f.results.map((r) => r.value).join(" → ")} {f.test.unit}
                    </Text>
                  )}
                </Card>
              );
            })}
          </View>
        </View>
      )}

      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
          Lesson plans
        </Text>
        {lessonPlans.length === 0 ? (
          <EmptyState message="The academy hasn't published lesson plans yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {lessonPlans.slice(0, 3).map((lp) => (
              <Card key={lp.id}>
                <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{lp.title}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {lp.sportKey ?? "General"} · {lp.sessionFlow?.length ?? 0} steps
                  {lp.status ? ` · ${lp.status}` : ""}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </View>

      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
          Drills they practice
        </Text>
        {drills.length === 0 ? (
          <EmptyState message="No drills in the academy's drill bank yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {drills.slice(0, 5).map((d) => (
              <Card key={d.id}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "600", flex: 1 }}>{d.title}</Text>
                  {d.level ? <Pill tone="info">{d.level}</Pill> : null}
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {d.sportKey}
                  {d.skillCategory ? ` · ${d.skillCategory}` : ""}
                  {d.durationMin ? ` · ${d.durationMin} min` : ""}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
