import { useCallback, useRef, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { Card, ChipRow, EmptyState, Field, LoadingView, Pill, PrimaryButton, colors } from "@/components/ui";
import { formatDate, type Fixture } from "@whistle/shared";

const FIXTURE_TONE = {
  draft: "neutral",
  scheduled: "info",
  live: "warning",
  pending_confirmation: "warning",
  completed: "success",
  abandoned: "danger",
} as const;

const SIDES = [
  { key: "A", label: "Side A won" },
  { key: "B", label: "Side B won" },
  { key: "draw", label: "Draw" },
] as const;

// Roles that can run live scoring / enter results (matches backend guards).
const SCORING_ROLES = ["admin", "head_coach", "coach", "account_manager"];

// Format hints from the shared per-sport score engine (backend
// common/game-score-rules.ts) — the API enforces the same rules.
const SCORE_HINTS: Record<string, string> = {
  badminton: "Badminton: sets to 21, win by 2, cap 30 — e.g. 21-15, 18-21, 21-19",
  pickleball: "Pickleball: sets to 11, win by 2, cap 21 — e.g. 11-8, 9-11, 11-6",
  "table-tennis": "Table tennis: sets to 11, win by 2 — e.g. 11-7, 11-9, 8-11, 11-5",
  table_tennis: "Table tennis: sets to 11, win by 2 — e.g. 11-7, 11-9, 8-11, 11-5",
  squash: "Squash: sets to 11, win by 2 — e.g. 11-9, 11-7",
  tennis: "Tennis: sets to 6, win by 2, tiebreak at 7 — e.g. 6-4, 7-5",
  volleyball: "Volleyball: sets to 25, win by 2 — e.g. 25-20, 23-25, 25-18",
  throwball: "Throwball: sets to 25, win by 2 — e.g. 25-20, 25-22",
};

interface SetScore {
  a: number;
  b: number;
}

// Modern tap-to-score board: two giant tap zones, live set tracking, undo,
// finish. Modeled on current racquet-sport scorekeeper apps.
function LiveScoreboard({
  sessionId,
  sideAName,
  sideBName,
  onFinished,
}: {
  sessionId: string;
  sideAName: string;
  sideBName: string;
  onFinished: (winnerSide: "A" | "B" | "draw", scoreDisplay: string, marginRatio: number) => Promise<void>;
}) {
  const [points, setPoints] = useState<SetScore>({ a: 0, b: 0 });
  const [sets, setSets] = useState<SetScore[]>([]);
  const [finishing, setFinishing] = useState(false);
  const counter = useRef(0);

  const record = (side: "A" | "B") => {
    setPoints((p) => ({ a: p.a + (side === "A" ? 1 : 0), b: p.b + (side === "B" ? 1 : 0) }));
    counter.current += 1;
    // Fire-and-forget with an idempotency key — the backend dedupes retries.
    apiJson(`/scoring-sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({
        clientEventId: `${sessionId}-${counter.current}-${side}`,
        actionType: "point",
        payload: { side, pointNo: counter.current },
        clientTimestamp: new Date().toISOString(),
      }),
    }).catch(() => undefined);
  };

  const undo = () => {
    setPoints((p) => {
      // Undo the most recent point locally (best effort: higher count first).
      if (p.a === 0 && p.b === 0) return p;
      return p.a >= p.b ? { ...p, a: Math.max(0, p.a - 1) } : { ...p, b: p.b - 1 };
    });
    apiJson(`/scoring-sessions/${sessionId}/undo`, { method: "POST", body: JSON.stringify({}) }).catch(() => undefined);
  };

  const endSet = () => {
    if (points.a === 0 && points.b === 0) return;
    setSets((s) => [...s, points]);
    setPoints({ a: 0, b: 0 });
  };

  async function finish() {
    const finalSets = points.a || points.b ? [...sets, points] : sets;
    if (finalSets.length === 0) return;
    const winsA = finalSets.filter((s) => s.a > s.b).length;
    const winsB = finalSets.filter((s) => s.b > s.a).length;
    const winnerSide: "A" | "B" | "draw" = winsA > winsB ? "A" : winsB > winsA ? "B" : "draw";
    const scoreDisplay = finalSets.map((s) => `${s.a}-${s.b}`).join(", ");
    const totalPts = finalSets.reduce((t, s) => t + s.a + s.b, 0);
    const diffPts = Math.abs(finalSets.reduce((t, s) => t + s.a - s.b, 0));
    const marginRatio = totalPts ? Math.min(1, diffPts / (totalPts / 2)) : 0.5;
    setFinishing(true);
    try {
      await onFinished(winnerSide, scoreDisplay, marginRatio);
    } finally {
      setFinishing(false);
    }
  }

  const scoreZone = (side: "A" | "B", name: string, value: number) => (
    <TouchableOpacity
      onPress={() => record(side)}
      activeOpacity={0.65}
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 26,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: side === "A" ? "rgba(96, 165, 250, 0.45)" : "rgba(248, 113, 113, 0.45)",
        backgroundColor: side === "A" ? "rgba(96, 165, 250, 0.10)" : "rgba(248, 113, 113, 0.10)",
      }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6 }} numberOfLines={1}>
        {name}
      </Text>
      <Text style={{ color: colors.textPrimary, fontSize: 64, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>tap to score</Text>
    </TouchableOpacity>
  );

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 15 }}>Live scoring</Text>
        <Pill tone="warning">LIVE</Pill>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {scoreZone("A", sideAName, points.a)}
        <View style={{ justifyContent: "center" }}>
          <Text style={{ color: colors.textMuted, fontWeight: "800" }}>:</Text>
        </View>
        {scoreZone("B", sideBName, points.b)}
      </View>

      {sets.length > 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 12 }}>
          Sets: {sets.map((s) => `${s.a}-${s.b}`).join("  ·  ")}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <TouchableOpacity
          onPress={undo}
          activeOpacity={0.7}
          style={{ flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 13 }}>↩ Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={endSet}
          activeOpacity={0.7}
          style={{ flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 13 }}>End set</Text>
        </TouchableOpacity>
      </View>
      <View style={{ marginTop: 8 }}>
        <PrimaryButton
          title={finishing ? "Finishing…" : "Finish match"}
          onPress={finish}
          disabled={finishing || (sets.length === 0 && points.a === 0 && points.b === 0)}
        />
      </View>
    </Card>
  );
}

export default function FixtureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [winnerSide, setWinnerSide] = useState<"A" | "B" | "draw">("A");
  const [scoreDisplay, setScoreDisplay] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [schedVenue, setSchedVenue] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    apiJson<Fixture>(`/fixtures/${id}`)
      .then(setFixture)
      .catch(() => setFixture(null))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(load);

  async function startScoring() {
    if (!fixture) return;
    setStarting(true);
    try {
      const session = await apiJson<{ id: string }>(`/fixtures/${fixture.id}/sessions`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSessionId(session.id);
      load();
    } catch (e) {
      Alert.alert("Couldn't start scoring", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setStarting(false);
    }
  }

  async function finishSession(w: "A" | "B" | "draw", display: string, marginRatio: number) {
    if (!sessionId) return;
    try {
      await apiJson(`/scoring-sessions/${sessionId}/complete`, {
        method: "POST",
        body: JSON.stringify({ winnerSide: w, scoreDisplay: display, marginRatio }),
      });
      setSessionId(null);
      load();
    } catch (e) {
      Alert.alert("Couldn't complete match", e instanceof Error ? e.message : "Please try again.");
    }
  }

  async function submitManual() {
    if (!fixture || !scoreDisplay.trim()) return;
    setSaving(true);
    try {
      await apiJson(`/fixtures/${fixture.id}/manual-result`, {
        method: "POST",
        body: JSON.stringify({ winnerSide, scoreDisplay: scoreDisplay.trim() }),
      });
      setScoreDisplay("");
      setShowManual(false);
      load();
    } catch (e) {
      Alert.alert("Couldn't save result", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule() {
    if (!fixture) return;
    setScheduling(true);
    try {
      const body: { scheduledAt?: string; venue?: string } = {};
      if (/^\d{4}-\d{2}-\d{2}$/.test(schedDate.trim())) {
        const time = /^\d{2}:\d{2}$/.test(schedTime.trim()) ? schedTime.trim() : "09:00";
        body.scheduledAt = new Date(`${schedDate.trim()}T${time}:00`).toISOString();
      }
      if (schedVenue.trim()) body.venue = schedVenue.trim();
      await apiJson(`/fixtures/${fixture.id}/schedule`, { method: "PATCH", body: JSON.stringify(body) });
      setShowSchedule(false);
      load();
    } catch (e) {
      Alert.alert("Couldn't schedule", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setScheduling(false);
    }
  }

  async function confirmResult() {
    if (!fixture) return;
    setSaving(true);
    try {
      await apiJson(`/fixtures/${fixture.id}/confirm`, { method: "POST", body: JSON.stringify({}) });
      load();
    } catch (e) {
      Alert.alert("Couldn't confirm", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingView />;
  if (!fixture) return <EmptyState message="Fixture not found." />;

  const sideNames = (clients?: { name: string }[], ids?: string[]) =>
    clients?.length ? clients.map((c) => c.name).join(", ") : `${ids?.length ?? 0} player(s)`;
  const sideA = sideNames(fixture.entrantAClients, fixture.entrantA);
  const sideB = sideNames(fixture.entrantBClients, fixture.entrantB);

  const canScore = SCORING_ROLES.includes(user?.role ?? "");
  // Coaches included (2026-07): Match Center hosts score their own event's
  // fixtures — a coach-entered interschool result still needs the opposing
  // school's approval before it completes (backend rule).
  const canManual = SCORING_ROLES.includes(user?.role ?? "");
  const isOpen = !["completed", "abandoned"].includes(fixture.status);
  // Scheduling is the HOST's call for event fixtures (backend enforces it);
  // fixtures without an event (practice/internal) are open to scoring roles.
  const eventHost = (fixture.event as { hostAcademyId?: string } | undefined)?.hostAcademyId;
  const canSchedule = canScore && isOpen && (!eventHost || eventHost === user?.academyId);
  const schedTimeLabel = fixture.scheduledAt
    ? new Date(fixture.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800" }}>
          {fixture.sport?.name ?? fixture.sportKey}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <Pill tone={FIXTURE_TONE[fixture.status as keyof typeof FIXTURE_TONE] ?? "neutral"}>
            {fixture.status.replace("_", " ")}
          </Pill>
          {fixture.event ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{fixture.event.name}</Text> : null}
        </View>
      </View>

      {sessionId ? (
        <LiveScoreboard sessionId={sessionId} sideAName={sideA} sideBName={sideB} onFinished={finishSession} />
      ) : (
        <Card>
          <View style={{ gap: 10 }}>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase" }}>Side A</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>{sideA}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase" }}>Side B</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>{sideB}</Text>
            </View>
          </View>
        </Card>
      )}

      <Card>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          {fixture.scheduledAt ? `📅 ${formatDate(fixture.scheduledAt)}${schedTimeLabel ? ` · 🕒 ${schedTimeLabel}` : ""}` : "Unscheduled"}
          {fixture.venue ? ` · 📍 ${fixture.venue}` : ""} · {fixture.matchType.replace("_", " ")}
        </Text>
        {canSchedule && (
          <View style={{ marginTop: 10 }}>
            <TouchableOpacity onPress={() => {
              if (!showSchedule) {
                // Prefill from the current schedule for quick tweaks.
                if (fixture.scheduledAt) {
                  const d = new Date(fixture.scheduledAt);
                  setSchedDate(d.toISOString().slice(0, 10));
                  setSchedTime(d.toTimeString().slice(0, 5));
                }
                setSchedVenue(fixture.venue ?? "");
              }
              setShowSchedule((v) => !v);
            }} activeOpacity={0.7}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "600" }}>
                {showSchedule ? "Hide scheduling" : "🕒 Set match time & court"}
              </Text>
            </TouchableOpacity>
            {showSchedule && (
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Date" value={schedDate} onChangeText={setSchedDate} placeholder="YYYY-MM-DD" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Time" value={schedTime} onChangeText={setSchedTime} placeholder="HH:MM" />
                  </View>
                </View>
                <Field label="Court / ground" value={schedVenue} onChangeText={setSchedVenue} placeholder="e.g. Court 2" />
                <PrimaryButton
                  title={scheduling ? "Saving…" : "Save schedule"}
                  onPress={saveSchedule}
                  disabled={scheduling || (!/^\d{4}-\d{2}-\d{2}$/.test(schedDate.trim()) && !schedVenue.trim())}
                />
              </View>
            )}
          </View>
        )}
        {fixture.resultSummary?.scoreDisplay ? (
          <Text style={{ color: colors.accent, fontSize: 20, fontWeight: "800", marginTop: 8 }}>
            {fixture.resultSummary.scoreDisplay}
            {fixture.resultSummary.winnerSide
              ? fixture.resultSummary.winnerSide === "draw"
                ? " (draw)"
                : ` (Side ${fixture.resultSummary.winnerSide} won)`
              : ""}
          </Text>
        ) : null}
      </Card>

      {isOpen && canScore && !sessionId ? (
        <PrimaryButton title={starting ? "Starting…" : "▶ Start live scoring"} onPress={startScoring} disabled={starting} />
      ) : null}

      {fixture.status === "pending_confirmation" && canScore ? (
        <PrimaryButton title={saving ? "Confirming…" : "Confirm result"} onPress={confirmResult} disabled={saving} />
      ) : null}

      {isOpen && canManual && !sessionId ? (
        <View>
          <TouchableOpacity onPress={() => setShowManual((v) => !v)} activeOpacity={0.7}>
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 4 }}>
              {showManual ? "Hide manual result entry" : "Enter result manually instead"}
            </Text>
          </TouchableOpacity>
          {showManual ? (
            <Card>
              <ChipRow
                options={SIDES.map((s) => ({ key: s.key, label: s.label }))}
                value={winnerSide}
                onChange={(v) => setWinnerSide(v as typeof winnerSide)}
              />
              <View style={{ height: 12 }} />
              <Field label="Score" value={scoreDisplay} onChangeText={setScoreDisplay} placeholder="e.g. 21-15, 18-21, 21-19" />
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 10 }}>
                {SCORE_HINTS[fixture.sportKey] ?? "Enter the final score, e.g. 3-1 — sets separated by commas."}
              </Text>
              <PrimaryButton
                title={saving ? "Saving…" : "Save result"}
                onPress={submitManual}
                disabled={saving || !scoreDisplay.trim()}
              />
            </Card>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
