import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Share, Platform } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Card, Pill, PrimaryButton, SectionHeader, EmptyState, LoadingView, colors } from "@/components/ui";
import { tFetch, tournamentUser } from "@/lib/tournament-api";
import { API_URL } from "@/lib/api-client";

interface Entry {
  id: string;
  teamName: string | null;
  players: { name: string }[];
  status: string;
  seed: number | null;
  paidAmount: string | null;
}

interface Match {
  id: string;
  round: number;
  matchNo: number;
  entryAId: string | null;
  entryBId: string | null;
  status: string;
  scoreA: number;
  scoreB: number;
  scoreDisplay: string | null;
  winnerEntryId: string | null;
  venue: string | null;
}

interface TEvent {
  id: string;
  name: string;
  kind: string;
  discipline: string;
  format: string;
  unit: string;
  entryFee: string | null;
  entries: Entry[];
  matches: Match[];
  standings?: { entryId: string; name: string; played: number; won: number; lost: number; points: number }[];
  heatRanking?: { rank: number; entryId: string; name: string; value: number; unit: string; heat: number }[];
  finalRanking?: { rank: number; entryId: string; name: string; value: number; unit: string }[];
}

interface TDetail {
  id: string;
  name: string;
  status: string;
  publicSlug: string;
  startDate: string;
  venues: string[];
  events: TEvent[];
}

interface PaySummary {
  collected: number;
  platformFeePct: number;
  platformFee: number;
  netPayable: number;
  paidEntries: number;
}

function entryName(entries: Entry[], id: string | null): string {
  if (!id) return "TBD";
  const e = entries.find((x) => x.id === id);
  return e ? (e.teamName ?? e.players[0]?.name ?? "—") : "TBD";
}

export default function ManageTournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = tournamentUser();
  const [detail, setDetail] = useState<TDetail | null>(null);
  const [pay, setPay] = useState<PaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quickNames, setQuickNames] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});
  const [times, setTimes] = useState<Record<string, string>>({});
  const [timedPhase, setTimedPhase] = useState<Record<string, "heat" | "final">>({});

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await tFetch<TDetail>(`/tournaments/${id}`);
      setDetail(d);
      setPay(await tFetch<PaySummary>(`/tournaments/${id}/payment-summary`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tournament.");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return <LoadingView />;

  const publicUrl = `${API_URL.replace("/api/v1", "")}/t/${detail.publicSlug}`;
  const webUrl =
    Platform.OS === "web" && typeof window !== "undefined"
      ? `${window.location.origin.replace(":8081", ":3000")}/t/${detail.publicSlug}`
      : `http://localhost:3000/t/${detail.publicSlug}`;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 19, fontWeight: "800", flex: 1, paddingRight: 8 }}>
          {detail.name}
        </Text>
        <Pill tone={detail.status === "draft" ? "neutral" : "success"}>{detail.status.replace("_", " ")}</Pill>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 14 }}>
        {new Date(detail.startDate).toLocaleDateString()} · {detail.venues.join(", ") || "venue TBA"}
      </Text>

      {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

      {detail.status === "draft" && (
        <View style={{ marginBottom: 16 }}>
          <PrimaryButton title="Open Registration" onPress={() => act(() => tFetch(`/tournaments/${id}/publish`, { method: "POST" }))} disabled={busy} />
        </View>
      )}

      {/* Public page link (BRD 6.6 — shareable, no login needed) */}
      <Card style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Public page — share with anyone, no app needed</Text>
        <Text style={{ color: colors.accent, fontSize: 13 }} selectable>
          {webUrl}
        </Text>
        <View style={{ marginTop: 8 }}>
          <Pressable
            onPress={() => Share.share({ message: webUrl }).catch(() => {})}
            style={{ alignSelf: "flex-start", borderWidth: 1, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>Share Link</Text>
          </Pressable>
        </View>
      </Card>

      {/* Payment summary (BRD 6.7) */}
      {pay && (
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 8 }}>Payments</Text>
          {[
            ["Collected", `₹${pay.collected}`],
            [`Platform fee (${pay.platformFeePct}%)`, `-₹${pay.platformFee}`],
            ["Net payable to you", `₹${pay.netPayable}`],
            ["Paid entries", `${pay.paidEntries}`],
          ].map(([label, value]) => (
            <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{label}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>{value}</Text>
            </View>
          ))}
        </Card>
      )}

      {detail.events.map((ev) => {
        const confirmed = ev.entries.filter((e) => e.status === "confirmed");
        const phase = timedPhase[ev.id] ?? "heat";
        return (
          <Card key={ev.id} style={{ marginBottom: 18 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 15 }}>{ev.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 10 }}>
              {ev.kind} · {ev.discipline === "timed" ? `timed (${ev.unit})` : ev.format.replace("_", " ")} ·{" "}
              {confirmed.length} confirmed{ev.entryFee ? ` · ₹${ev.entryFee}` : ""}
            </Text>

            {/* Entries */}
            <SectionHeader title={`Entries (${ev.entries.length})`} />
            {ev.entries.length === 0 && <EmptyState message="No entries yet." />}
            {ev.entries.map((en) => (
              <View
                key={en.id}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 5 }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 13, flex: 1 }} numberOfLines={1}>
                  {en.seed ? `[${en.seed}] ` : ""}
                  {en.teamName ?? en.players[0]?.name ?? "—"}
                </Text>
                <Pill
                  tone={
                    en.status === "confirmed"
                      ? "success"
                      : en.status === "awaiting_payment" || en.status === "pending"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {en.status.replace("_", " ")}
                </Pill>
                {en.status === "pending" && (
                  <Pressable
                    onPress={() => act(() => tFetch(`/tournaments/entries/${en.id}/approve`, { method: "POST", body: JSON.stringify({ approve: true }) }))}
                    style={{ marginLeft: 8 }}
                  >
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>Approve</Text>
                  </Pressable>
                )}
              </View>
            ))}

            {/* Quick entries (organizer fast path) */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
              <TextInput
                placeholder="Quick add: name1, name2, …"
                placeholderTextColor={colors.textMuted}
                value={quickNames[ev.id] ?? ""}
                onChangeText={(v) => setQuickNames((p) => ({ ...p, [ev.id]: v }))}
                style={{
                  flex: 1,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  fontSize: 13,
                }}
              />
              <Pressable
                disabled={busy}
                onPress={() => {
                  const names = (quickNames[ev.id] ?? "").split(",").map((n) => n.trim()).filter(Boolean);
                  if (names.length < 1) return;
                  act(async () => {
                    await tFetch(`/tournaments/events/${ev.id}/quick-entries`, {
                      method: "POST",
                      body: JSON.stringify({ names }),
                    });
                    setQuickNames((p) => ({ ...p, [ev.id]: "" }));
                  });
                }}
                style={{ backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: "700" }}>Add</Text>
              </Pressable>
            </View>

            {/* Match events: fixtures + scoring */}
            {ev.discipline === "match" && (
              <>
                {ev.matches.length === 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <PrimaryButton
                      title={busy ? "Working…" : `Generate Fixtures (${confirmed.length} entries)`}
                      onPress={() => act(() => tFetch(`/tournaments/events/${ev.id}/fixtures`, { method: "POST", body: JSON.stringify({}) }))}
                      disabled={busy || confirmed.length < 2}
                    />
                  </View>
                ) : (
                  <>
                    <View style={{ height: 12 }} />
                    <SectionHeader title="Matches" />
                    {ev.matches.map((m) => {
                      const s = scores[m.id] ?? { a: String(m.scoreA), b: String(m.scoreB) };
                      const canScore = m.status !== "completed" && m.entryAId && m.entryBId;
                      return (
                        <View
                          key={m.id}
                          style={{
                            borderTopWidth: 1,
                            borderTopColor: "rgba(255,255,255,0.06)",
                            paddingVertical: 8,
                          }}
                        >
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                              R{m.round} · M{m.matchNo}
                              {m.venue ? ` · ${m.venue}` : ""}
                            </Text>
                            <Pill tone={m.status === "completed" ? "neutral" : m.status === "live" ? "warning" : "success"}>
                              {m.status}
                            </Pill>
                          </View>
                          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
                            {entryName(ev.entries, m.entryAId)} vs {entryName(ev.entries, m.entryBId)}
                          </Text>
                          {m.status === "completed" ? (
                            <Text style={{ color: colors.accent, fontSize: 13, marginTop: 2 }}>
                              {m.scoreDisplay === "bye"
                                ? "Bye — auto-advanced"
                                : `${m.scoreA} – ${m.scoreB} · winner: ${entryName(ev.entries, m.winnerEntryId)}`}
                            </Text>
                          ) : (
                            canScore && (
                              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
                                {(["a", "b"] as const).map((side) => (
                                  <TextInput
                                    key={side}
                                    keyboardType="numeric"
                                    value={s[side]}
                                    onChangeText={(v) => setScores((p) => ({ ...p, [m.id]: { ...s, [side]: v } }))}
                                    style={{
                                      width: 52,
                                      textAlign: "center",
                                      color: colors.textPrimary,
                                      borderWidth: 1,
                                      borderColor: "rgba(255,255,255,0.15)",
                                      borderRadius: 8,
                                      paddingVertical: 6,
                                      fontSize: 15,
                                      fontWeight: "700",
                                    }}
                                  />
                                ))}
                                <Pressable
                                  disabled={busy}
                                  onPress={() =>
                                    act(() =>
                                      tFetch(`/tournaments/matches/${m.id}/score`, {
                                        method: "POST",
                                        body: JSON.stringify({ scoreA: Number(s.a) || 0, scoreB: Number(s.b) || 0, final: false }),
                                      })
                                    )
                                  }
                                  style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                                >
                                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>Live</Text>
                                </Pressable>
                                <Pressable
                                  disabled={busy}
                                  onPress={() =>
                                    act(() =>
                                      tFetch(`/tournaments/matches/${m.id}/score`, {
                                        method: "POST",
                                        body: JSON.stringify({ scoreA: Number(s.a) || 0, scoreB: Number(s.b) || 0, final: true }),
                                      })
                                    )
                                  }
                                  style={{ backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                                >
                                  <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: "700" }}>Final</Text>
                                </Pressable>
                              </View>
                            )
                          )}
                        </View>
                      );
                    })}
                    {ev.format === "round_robin" && ev.standings && ev.standings.length > 0 && (
                      <>
                        <View style={{ height: 12 }} />
                        <SectionHeader title="Standings" />
                        {ev.standings.map((row, i) => (
                          <View key={row.entryId} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                            <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                              {i + 1}. {row.name}
                            </Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                              {row.won}W-{row.lost}L · {row.points} pts
                            </Text>
                          </View>
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* Timed events: record results, heats → final */}
            {ev.discipline === "timed" && (
              <>
                <View style={{ height: 12 }} />
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  {(["heat", "final"] as const).map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setTimedPhase((prev) => ({ ...prev, [ev.id]: p }))}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        backgroundColor: phase === p ? colors.accent : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <Text style={{ color: phase === p ? colors.accentText : colors.textSecondary, fontSize: 12, fontWeight: "700" }}>
                        {p === "heat" ? "Heats" : "Final"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <SectionHeader title={`Record ${phase} results (${ev.unit})`} />
                {confirmed.map((en) => {
                  const key = `${ev.id}:${en.id}:${phase}`;
                  return (
                    <View key={en.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, flex: 1 }} numberOfLines={1}>
                        {en.teamName ?? en.players[0]?.name ?? "—"}
                      </Text>
                      <TextInput
                        keyboardType="numeric"
                        placeholder={ev.unit === "sec" ? "12.34" : "5.20"}
                        placeholderTextColor={colors.textMuted}
                        value={times[key] ?? ""}
                        onChangeText={(v) => setTimes((p) => ({ ...p, [key]: v }))}
                        style={{
                          width: 84,
                          textAlign: "center",
                          color: colors.textPrimary,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.15)",
                          borderRadius: 8,
                          paddingVertical: 6,
                          fontSize: 13,
                        }}
                      />
                    </View>
                  );
                })}
                <View style={{ marginTop: 10 }}>
                  <PrimaryButton
                    title={busy ? "Saving…" : `Save ${phase} results`}
                    disabled={busy}
                    onPress={() => {
                      const results = confirmed
                        .map((en) => ({ entryId: en.id, value: Number(times[`${ev.id}:${en.id}:${phase}`]) }))
                        .filter((r) => !Number.isNaN(r.value) && times[`${ev.id}:${r.entryId}:${phase}`]);
                      if (!results.length) return;
                      act(() =>
                        tFetch(`/tournaments/events/${ev.id}/timed-results`, {
                          method: "POST",
                          body: JSON.stringify({ results: results.map((r) => ({ ...r, phase })) }),
                        })
                      );
                    }}
                  />
                </View>
                {(phase === "heat" ? ev.heatRanking : ev.finalRanking)?.length ? (
                  <>
                    <View style={{ height: 12 }} />
                    <SectionHeader title={phase === "heat" ? "Heat Ranking" : "Final Result"} />
                    {(phase === "heat" ? ev.heatRanking! : ev.finalRanking!).map((r) => (
                      <View key={r.entryId} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                        <Text style={{ color: r.rank <= 3 && phase === "final" ? colors.accent : colors.textPrimary, fontSize: 13 }}>
                          {r.rank}. {r.name}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                          {r.value} {r.unit}
                        </Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}
