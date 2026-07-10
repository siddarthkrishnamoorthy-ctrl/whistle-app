import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { Card, ChipRow, EmptyState, colors } from "@/components/ui";
import { formatDate, type Assessment } from "@whistle/shared";

interface ClientRef {
  id: string;
  name: string;
}

// Compact "12 reps · 87% acc · 34s" summary from whichever metrics were recorded.
function metricSummary(a: Assessment): string {
  const parts: string[] = [];
  if (a.repsCompleted != null) parts.push(`${a.repsCompleted} reps`);
  if (a.accuracyPct != null) parts.push(`${Number(a.accuracyPct)}% acc`);
  if (a.timeTakenSec != null) parts.push(`${Number(a.timeTakenSec)}s`);
  if (a.errorCount != null) parts.push(`${a.errorCount} errors`);
  if (a.overallRating != null) parts.push(`${Number(a.overallRating)}/10 overall`);
  return parts.join(" · ") || "No metrics";
}

interface DueCycle {
  id: string;
  title: string;
  cadence: string;
  windowStart: string;
  windowEnd: string;
  tests: { id: string; name: string; metricType: string; unit: string }[];
}

export default function AssessmentsScreen() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [dueCycles, setDueCycles] = useState<DueCycle[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.academyId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      Promise.all([
        apiJson<ClientRef[]>("/clients"),
        apiJson<DueCycle[]>("/assessment-cycles/due").catch(() => [] as DueCycle[]),
      ])
        .then(([all, cycles]) => {
          if (cancelled) return;
          setClients(all);
          setSelectedClientId((prev) => prev ?? all[0]?.id ?? null);
          setDueCycles(cycles);
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [user])
  );

  useEffect(() => {
    if (!selectedClientId) return;
    let cancelled = false;
    apiJson<Assessment[]>(`/assessments?clientId=${selectedClientId}`)
      .then((all) => !cancelled && setAssessments(all))
      .catch(() => !cancelled && setAssessments([]));
    return () => {
      cancelled = true;
    };
  }, [selectedClientId]);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>Assessments</Text>
        <TouchableOpacity
          onPress={() => router.push("/assessments/new")}
          style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.accent, borderRadius: 999 }}
        >
          <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 13 }}>+ Record</Text>
        </TouchableOpacity>
      </View>

      {/* Scheduled fitness/skill test cycles — distinct from ad hoc drill
          assessments (Assessment Module BRD 4.6), same visual language. */}
      {dueCycles.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>Fitness test cycles due</Text>
          {dueCycles.map((c) => (
            <TouchableOpacity key={c.id} onPress={() => router.push(`/assessments/cycle/${c.id}`)}>
              <Card style={{ borderColor: "rgba(245,185,63,0.35)", borderWidth: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{c.title}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      {c.tests.map((t) => t.name).join(" · ")}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                      window: {formatDate(c.windowStart)} – {formatDate(c.windowEnd)}
                    </Text>
                  </View>
                  <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 18 }}>›</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      ) : clients.length === 0 ? (
        <EmptyState message="No students in your academy yet." />
      ) : (
        <>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>Drill assessments</Text>
          <ChipRow
            scroll
            options={clients.map((c) => ({ key: c.id, label: c.name }))}
            value={selectedClientId ?? ""}
            onChange={setSelectedClientId}
          />
          {assessments.length === 0 ? (
            <EmptyState message="No assessments recorded for this student yet." />
          ) : (
            <View style={{ gap: 8 }}>
              {assessments.map((a) => (
                <Card key={a.id}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                    {a.drill?.title ?? "General assessment"}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{metricSummary(a)}</Text>
                  {a.coachNote ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6, fontStyle: "italic" }}>
                      “{a.coachNote}”
                    </Text>
                  ) : null}
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                    {formatDate(a.assessedAt)}
                    {a.recorder ? ` · by ${a.recorder.name}` : ""}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
