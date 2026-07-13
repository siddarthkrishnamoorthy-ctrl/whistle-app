import { useEffect, useState } from "react";
import { Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";

// The coach needs the full plan — its goals + objectives, and for every step
// the drill's description and demo video — not just the step headers.
interface Step {
  id?: string;
  drillId?: string;
  drillTitle?: string;
  title?: string;
  durationMin?: number;
  notes?: string;
}
interface LessonPlanFull {
  id: string;
  title: string;
  sportKey?: string | null;
  level?: string | null;
  status?: string | null;
  goals?: string | null;
  objectives?: string[] | null;
  whatToBring?: string[] | null;
  sessionFlow?: Step[];
}
interface Drill {
  id: string;
  title: string;
  description?: string | null;
  skillCategory?: string | null;
  media?: { type: "video" | "diagram"; url: string }[];
}

export default function LessonPlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lesson, setLesson] = useState<LessonPlanFull | null>(null);
  const [drills, setDrills] = useState<Record<string, Drill>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiJson<LessonPlanFull>(`/lesson-plans/${id}`).catch(() => null),
      // The drill bank hydrates each step with its description + video link.
      apiJson<Drill[]>(`/drills`).catch(() => [] as Drill[]),
    ])
      .then(([plan, allDrills]) => {
        setLesson(plan);
        setDrills(Object.fromEntries((allDrills ?? []).map((d) => [d.id, d])));
      })
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
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {lesson.sportKey ? <Pill tone="info">{lesson.sportKey}</Pill> : null}
          {lesson.level ? <Pill tone="neutral">{lesson.level}</Pill> : null}
          {lesson.status ? <Pill tone={lesson.status === "published" || lesson.status === "active" ? "success" : "neutral"}>{lesson.status}</Pill> : null}
          {totalMin > 0 ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{totalMin} min total</Text> : null}
        </View>
      </View>

      {/* Lesson description — goals, objectives, what to bring */}
      {(lesson.goals || (lesson.objectives?.length ?? 0) > 0 || (lesson.whatToBring?.length ?? 0) > 0) && (
        <Card style={{ gap: 8 }}>
          {lesson.goals ? (
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>GOAL</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }}>{lesson.goals}</Text>
            </View>
          ) : null}
          {(lesson.objectives?.length ?? 0) > 0 ? (
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>OBJECTIVES</Text>
              {lesson.objectives!.map((o, i) => (
                <Text key={i} style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>• {o}</Text>
              ))}
            </View>
          ) : null}
          {(lesson.whatToBring?.length ?? 0) > 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>🎒 Bring: {lesson.whatToBring!.join(", ")}</Text>
          ) : null}
        </Card>
      )}

      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginTop: 4 }}>Session flow</Text>
      {steps.length === 0 ? (
        <EmptyState message="This lesson plan has no steps yet." />
      ) : (
        <View style={{ gap: 8 }}>
          {steps.map((step, i) => {
            const drill = step.drillId ? drills[step.drillId] : undefined;
            const video = drill?.media?.find((m) => m.type === "video");
            const desc = step.notes || drill?.description;
            return (
              <Card key={step.id ?? i} style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "600", flex: 1 }}>
                    {i + 1}. {step.title ?? step.drillTitle ?? drill?.title ?? "Step"}
                  </Text>
                  {step.durationMin ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{step.durationMin} min</Text> : null}
                </View>
                {step.drillTitle && step.title && step.drillTitle !== step.title ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Drill: {step.drillTitle}</Text>
                ) : null}
                {drill?.skillCategory ? (
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{drill.skillCategory}</Text>
                ) : null}
                {desc ? <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{desc}</Text> : null}
                {video ? (
                  <TouchableOpacity onPress={() => Linking.openURL(video.url)} activeOpacity={0.7}>
                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "700", marginTop: 2 }}>▶ Watch demo video</Text>
                  </TouchableOpacity>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
