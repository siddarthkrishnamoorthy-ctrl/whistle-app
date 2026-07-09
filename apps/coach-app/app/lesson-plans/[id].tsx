import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import type { LessonPlan } from "@whistle/shared";

export default function LessonPlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lesson, setLesson] = useState<LessonPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiJson<LessonPlan>(`/lesson-plans/${id}`)
      .then(setLesson)
      .catch(() => setLesson(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingView />;
  if (!lesson) return <EmptyState message="Lesson plan not found." />;

  const steps = lesson.sessionFlow ?? [];
  const totalMin = steps.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>{lesson.title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          {lesson.sportKey ? <Pill tone="info">{lesson.sportKey}</Pill> : null}
          {lesson.status ? <Pill tone={lesson.status === "published" ? "success" : "neutral"}>{lesson.status}</Pill> : null}
          {totalMin > 0 ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{totalMin} min total</Text> : null}
        </View>
      </View>

      {steps.length === 0 ? (
        <EmptyState message="This lesson plan has no steps yet." />
      ) : (
        <View style={{ gap: 8 }}>
          {steps.map((step, i) => (
            <Card key={step.id ?? i}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "600", flex: 1 }}>
                  {i + 1}. {step.title ?? step.drillTitle ?? "Step"}
                </Text>
                {step.durationMin ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{step.durationMin} min</Text>
                ) : null}
              </View>
              {step.drillTitle && step.title ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Drill: {step.drillTitle}</Text>
              ) : null}
              {step.notes ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>{step.notes}</Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
