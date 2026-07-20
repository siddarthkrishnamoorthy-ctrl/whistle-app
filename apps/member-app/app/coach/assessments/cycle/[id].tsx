import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, ChipRow, EmptyState, LoadingView, Pill, colors } from "@/components/ui";

// Periodic Assessment — coach recording screen (Assessment Module BRD 4.3).
// Roster-based batch entry, one row per student: an inbuilt stopwatch for
// timed tests, a tally for repetition tests, plain numeric for distance.
// Best-of-attempts is kept automatically; absent/exempt are explicit marks.
// No camera, photo or video control exists anywhere on this screen (BRD 4.4).

interface TestInfo {
  id: string;
  name: string;
  metricType: "time" | "repetitions" | "distance_height";
  unit: string;
  precisionDecimals: number;
  attemptsAllowed: number;
  instructions?: string | null;
}
interface StudentRow {
  clientId: string;
  name: string;
  status: string;
  bestValue: number | null;
  benchmarkZone: string | null;
  attempts: number[];
}
interface Roster {
  cycle: { id: string; title: string };
  test: TestInfo;
  students: StudentRow[];
}
interface DueCycle {
  id: string;
  title: string;
  tests: TestInfo[];
}

const ZONE_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  "High Performance": "success",
  "Healthy Zone": "success",
  "Needs Improvement": "warning",
};

export default function CycleRecordingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cycle, setCycle] = useState<DueCycle | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Local pending attempts per student (before Save keeps the best).
  const [pending, setPending] = useState<Record<string, number[]>>({});
  const [manual, setManual] = useState<Record<string, string>>({});

  // Inbuilt stopwatch: one active timer at a time, per BRD "tap Start when
  // the student begins, tap Stop when they finish".
  const [timerFor, setTimerFor] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  useEffect(() => {
    if (!timerFor) return;
    const t = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 100);
    return () => clearInterval(t);
  }, [timerFor]);

  const loadRoster = useCallback(
    async (tid: string) => {
      try {
        setRoster(await apiJson<Roster>(`/assessment-cycles/${id}/roster?testId=${tid}`));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the roster.");
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      apiJson<DueCycle[]>("/assessment-cycles/due")
        .then((all) => {
          const c = all.find((x) => x.id === id) ?? null;
          setCycle(c);
          const first = c?.tests[0]?.id ?? null;
          setTestId((prev) => prev ?? first);
          if (first) loadRoster(first);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Could not load the cycle."));
    }, [id, loadRoster])
  );

  const test = roster?.test;

  function addAttempt(clientId: string, value: number) {
    if (!test) return;
    const rounded = Number(value.toFixed(test.precisionDecimals));
    setPending((p) => {
      const cur = p[clientId] ?? [];
      if (cur.length >= test.attemptsAllowed) return p; // best-of-N only
      return { ...p, [clientId]: [...cur, rounded] };
    });
  }

  async function save(clientId: string, statusOverride?: "absent" | "exempt") {
    if (!test || !testId) return;
    setBusy(clientId);
    setError(null);
    try {
      await apiJson(`/assessment-cycles/${id}/results`, {
        method: "POST",
        body: JSON.stringify(
          statusOverride ? { testId, clientId, status: statusOverride } : { testId, clientId, attempts: pending[clientId] ?? [] }
        ),
      });
      setPending((p) => ({ ...p, [clientId]: [] }));
      await loadRoster(testId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  if (!cycle) return <LoadingView />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 12 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>{cycle.title}</Text>

      <ChipRow
        options={cycle.tests.map((t) => ({ key: t.id, label: t.name }))}
        value={testId ?? ""}
        onChange={(tid) => {
          setTestId(tid);
          setTimerFor(null);
          loadRoster(tid);
        }}
      />

      {test?.instructions ? (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>📋 {test.instructions}</Text>
        </Card>
      ) : null}
      {test && (
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {test.metricType === "time" ? "⏱ Timed — lower is better" : test.metricType === "repetitions" ? "🔢 Reps — higher is better" : "📏 Distance — higher is better"}{" "}
          · best of {test.attemptsAllowed} · {test.unit}
        </Text>
      )}

      {error && <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>}

      {!roster ? (
        <LoadingView />
      ) : roster.students.length === 0 ? (
        <EmptyState message="No enrolled students match this cycle's grades/classes." />
      ) : (
        roster.students.map((s) => {
          const mine = pending[s.clientId] ?? [];
          const running = timerFor === s.clientId;
          return (
            <Card key={s.clientId}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                  {s.name}
                </Text>
                {s.status === "recorded" && s.bestValue != null ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: colors.accent, fontWeight: "800" }}>
                      {s.bestValue} {test?.unit}
                    </Text>
                    {s.benchmarkZone ? <Pill tone={ZONE_TONE[s.benchmarkZone] ?? "neutral"}>{s.benchmarkZone}</Pill> : null}
                  </View>
                ) : s.status !== "pending" ? (
                  <Pill tone="neutral">{s.status}</Pill>
                ) : null}
              </View>

              {/* Attempt entry */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {test?.metricType === "time" ? (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        if (running) {
                          setTimerFor(null);
                          addAttempt(s.clientId, elapsed);
                        } else {
                          startRef.current = Date.now();
                          setElapsed(0);
                          setTimerFor(s.clientId);
                        }
                      }}
                      style={{
                        backgroundColor: running ? colors.danger : colors.accent,
                        borderRadius: 999,
                        paddingHorizontal: 18,
                        paddingVertical: 8,
                        minWidth: 110,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: running ? "#fff" : colors.accentText, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                        {running ? `■ ${elapsed.toFixed(1)}s` : "▶ Start"}
                      </Text>
                    </TouchableOpacity>
                    <TextInput
                      placeholder="or type secs"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={manual[s.clientId] ?? ""}
                      onChangeText={(v) => setManual((m) => ({ ...m, [s.clientId]: v }))}
                      onSubmitEditing={() => {
                        const v = Number(manual[s.clientId]);
                        if (v > 0) addAttempt(s.clientId, v);
                        setManual((m) => ({ ...m, [s.clientId]: "" }));
                      }}
                      style={{
                        color: colors.textPrimary,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        width: 110,
                        fontSize: 13,
                      }}
                    />
                  </>
                ) : test?.metricType === "repetitions" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    {(() => {
                      const count = Number(manual[s.clientId] ?? 0);
                      return (
                        <>
                          <TouchableOpacity
                            onPress={() => setManual((m) => ({ ...m, [s.clientId]: String(Math.max(0, count - 1)) }))}
                            style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 999, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
                          >
                            <Text style={{ color: colors.textPrimary, fontSize: 18 }}>−</Text>
                          </TouchableOpacity>
                          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800", minWidth: 44, textAlign: "center" }}>{count}</Text>
                          <TouchableOpacity
                            onPress={() => setManual((m) => ({ ...m, [s.clientId]: String(count + 1) }))}
                            style={{ backgroundColor: colors.accent, borderRadius: 999, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
                          >
                            <Text style={{ color: colors.accentText, fontSize: 18, fontWeight: "800" }}>+</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              if (count > 0) addAttempt(s.clientId, count);
                              setManual((m) => ({ ...m, [s.clientId]: "0" }));
                            }}
                            style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}
                          >
                            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>Log attempt</Text>
                          </TouchableOpacity>
                        </>
                      );
                    })()}
                  </View>
                ) : (
                  <TextInput
                    placeholder={`value in ${test?.unit ?? "cm"}`}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={manual[s.clientId] ?? ""}
                    onChangeText={(v) => setManual((m) => ({ ...m, [s.clientId]: v }))}
                    onSubmitEditing={() => {
                      const v = Number(manual[s.clientId]);
                      if (v > 0) addAttempt(s.clientId, v);
                      setManual((m) => ({ ...m, [s.clientId]: "" }));
                    }}
                    style={{
                      color: colors.textPrimary,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      width: 140,
                      fontSize: 14,
                    }}
                  />
                )}
              </View>

              {/* Captured attempts + actions */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {mine.map((v, i) => (
                  <Text key={i} style={{ color: colors.textSecondary, fontSize: 12 }}>
                    #{i + 1}: {v}
                    {test?.unit === "seconds" ? "s" : ` ${test?.unit}`}
                  </Text>
                ))}
                {mine.length > 0 && (
                  <TouchableOpacity
                    disabled={busy === s.clientId}
                    onPress={() => save(s.clientId)}
                    style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}
                  >
                    <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: "800" }}>
                      {busy === s.clientId ? "…" : `Save (best of ${mine.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
                {s.status === "pending" && mine.length === 0 && (
                  <>
                    <TouchableOpacity onPress={() => save(s.clientId, "absent")}>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Absent</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => save(s.clientId, "exempt")}>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Exempt</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}
