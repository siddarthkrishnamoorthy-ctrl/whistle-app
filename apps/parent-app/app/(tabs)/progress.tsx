import { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useChildren } from "@/lib/children-context";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import { ProgressRing } from "@/components/progress-ring";
import { formatDate, type Assessment, type Rating } from "@whistle/shared";

function metricSummary(a: Assessment): string {
  const parts: string[] = [];
  if (a.repsCompleted != null) parts.push(`${a.repsCompleted} reps`);
  if (a.accuracyPct != null) parts.push(`${Number(a.accuracyPct)}% accuracy`);
  if (a.timeTakenSec != null) parts.push(`${Number(a.timeTakenSec)}s`);
  if (a.overallRating != null) parts.push(`${Number(a.overallRating)}/10 overall`);
  return parts.join(" · ");
}

export default function ProgressScreen() {
  const { selectedChild, loading: childLoading } = useChildren();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [rating, setRating] = useState<Rating | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!selectedChild) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);

      const load = async () => {
        const history = await apiJson<Assessment[]>(`/assessments?clientId=${selectedChild.id}`).catch(
          () => [] as Assessment[]
        );
        if (cancelled) return;
        setAssessments(history);

        // The child's sport for the rating lookup: prefer the enrolled class,
        // fall back to the sport of their most recent assessed drill.
        const sportKey =
          selectedChild.enrollments?.find((e) => e.status === "active")?.class?.sportKey ??
          selectedChild.enrollments?.[0]?.class?.sportKey ??
          history.find((a) => a.drill?.sportKey)?.drill?.sportKey;
        if (sportKey) {
          const r = await apiJson<Rating>(`/ratings/${selectedChild.id}/${sportKey}/individual`).catch(() => null);
          if (!cancelled) setRating(r);
        } else {
          setRating(null);
        }
      };

      load().finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [selectedChild])
  );

  if (childLoading || loading) return <LoadingView />;
  if (!selectedChild) return <EmptyState message="No child linked yet. Link your player from the Home tab." />;

  const notes = assessments.filter((a) => a.coachNote);
  const latestAccuracy = assessments.find((a) => a.accuracyPct != null)?.accuracyPct;
  const latestAccuracyNum = latestAccuracy != null ? Number(latestAccuracy) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>Progress</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{selectedChild.name}</Text>
      </View>

      {rating ? (
        <TouchableOpacity onPress={() => router.push("/rating-detail")} activeOpacity={0.75}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-evenly", alignItems: "flex-start" }}>
              <ProgressRing
                // Rating scale runs 2.0–8.0 (DUPR-style); map onto the ring.
                fraction={(Number(rating.currentRating) - 2) / 6}
                value={Number(rating.currentRating).toFixed(2)}
                sublabel={rating.sportKey}
                label="Skill rating"
                from={colors.accent}
                to="#F87171"
              />
              {latestAccuracyNum != null ? (
                <ProgressRing
                  fraction={latestAccuracyNum / 100}
                  value={`${Math.round(latestAccuracyNum)}%`}
                  sublabel="latest drill"
                  label="Accuracy"
                  from="#34D399"
                  to="#60A5FA"
                />
              ) : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {rating.matchesPlayed} match{rating.matchesPlayed === 1 ? "" : "es"}
              </Text>
              {rating.isProvisional ? <Pill tone="warning">provisional</Pill> : null}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, textAlign: "center" }}>
              Tap for match history →
            </Text>
          </Card>
        </TouchableOpacity>
      ) : null}

      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>Coach notes</Text>
        {notes.length === 0 ? (
          <EmptyState message="No coach notes yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {notes.slice(0, 5).map((a) => (
              <Card key={a.id}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 19 }}>“{a.coachNote}”</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                  {a.recorder?.name ? `${a.recorder.name} · ` : ""}
                  {formatDate(a.assessedAt)}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </View>

      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
          Recent assessments
        </Text>
        {assessments.length === 0 ? (
          <EmptyState message="No assessments recorded yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {assessments.slice(0, 8).map((a) => (
              <Card key={a.id}>
                <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                  {a.drill?.title ?? "General assessment"}
                </Text>
                {metricSummary(a) ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{metricSummary(a)}</Text>
                ) : null}
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>{formatDate(a.assessedAt)}</Text>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
