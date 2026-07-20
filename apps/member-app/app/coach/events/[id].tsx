import { useCallback, useRef, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { Card, ChipRow, EmptyState, ListRow, LoadingView, Pill, PrimaryButton, colors } from "@/components/ui";
import { formatDate, type Fixture, type InterschoolEvent } from "@whistle/shared";

type EventDetail = InterschoolEvent & {
  hostAcademy?: { id: string; name: string };
  fixtures?: Fixture[];
  invitations?: { status: string; invitedAcademy?: { id: string; name: string } }[];
  maxTeams?: number | null;
  venue?: string | null;
};

interface EventMessage {
  id: string;
  senderName: string;
  body: string;
  createdAt: string;
  academy: { id: string; name: string };
}

interface StandingsRow {
  academyId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  points: number;
}

interface RosterEntry {
  id: string;
  sportKey: string;
  eligibilityStatus: string;
  client: { id: string; name: string };
  academy: { id: string; name: string };
}

interface ClientRef {
  id: string;
  name: string;
}

const EVENT_TONE = { draft: "neutral", scheduled: "info", live: "warning", completed: "success", closed: "success" } as const;
const FIXTURE_TONE = {
  draft: "neutral",
  scheduled: "info",
  live: "warning",
  pending_confirmation: "warning",
  completed: "success",
  abandoned: "danger",
} as const;
const MEDALS = ["🥇", "🥈", "🥉"];

// "12 Sep · 09:30" — the time only once the host has actually set one
// (midnight = the untouched default from fixture generation).
function fixtureWhen(iso?: string | null): string {
  if (!iso) return "Unscheduled";
  const d = new Date(iso);
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return `${formatDate(iso)}${hasTime ? ` · 🕒 ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`;
}

export default function EventDetailScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [standings, setStandings] = useState<{ sportKey: string; rows: StandingsRow[] }[]>([]);
  const [messages, setMessages] = useState<EventMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Same console layout as the tournament module: one tab open at a time
  // keeps the screen calm however many fixtures or messages pile up. The
  // Matches list can deep-link straight to a tab (e.g. ?tab=chat).
  const [tab, setTab] = useState<"score" | "fixtures" | "roster" | "standings" | "chat">(
    initialTab === "chat" || initialTab === "score" || initialTab === "roster" || initialTab === "standings"
      ? (initialTab as "score" | "roster" | "standings" | "chat")
      : "fixtures"
  );
  const [rosters, setRosters] = useState<RosterEntry[]>([]);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [rosterSport, setRosterSport] = useState("");
  const chatScroll = useRef<ScrollView | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const ev = await apiJson<EventDetail>(`/interschool/events/${id}`).catch(() => null);
    setEvent(ev);
    if (ev) {
      apiJson<{ standings: { sportKey: string; rows: StandingsRow[] }[] }>(`/interschool/events/${id}/standings`)
        .then((s) => setStandings(s.standings))
        .catch(() => setStandings([]));
      // Chat only opens for members — a 403 just means "not joined yet".
      apiJson<EventMessage[]>(`/interschool/events/${id}/messages`)
        .then(setMessages)
        .catch(() => setMessages(null));
      // Roster (members only): my nominated players + my students to add.
      apiJson<RosterEntry[]>(`/interschool/events/${id}/rosters`)
        .then(setRosters)
        .catch(() => setRosters([]));
      apiJson<ClientRef[]>("/clients")
        .then(setClients)
        .catch(() => setClients([]));
      setRosterSport((prev) => prev || ev.sports[0] || "");
    }
  }, [id]);

  // Focus-based: returning from a scoring screen refreshes results, the
  // standings table and the chat without a manual reload.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  if (loading) return <LoadingView />;
  if (!event) return <EmptyState message="Event not found." />;

  const isHost = event.hostAcademy?.id === user?.academyId;
  const joinedTeams = 1 + (event.invitations?.filter((i) => i.status === "accepted").length ?? 0);
  const iAmMember =
    isHost || event.invitations?.some((i) => i.status === "accepted" && i.invitedAcademy?.id === user?.academyId);
  const slotsLeft = event.maxTeams != null ? Math.max(0, event.maxTeams - joinedTeams) : null;
  const chatOpen = event.status !== "closed";
  const fixtures = event.fixtures ?? [];
  const openFixtures = fixtures.filter((f) => !["completed", "abandoned"].includes(f.status));
  const canScoreRole =
    ["admin", "head_coach", "coach", "account_manager"].includes(user?.role ?? "") && Boolean(iAmMember);

  async function join() {
    setBusy(true);
    try {
      const res = await apiJson<{ teamsJoined: number; autoFixtures?: { created: number } | null }>(
        `/interschool/events/${id}/join`,
        { method: "POST", body: JSON.stringify({}) }
      );
      await load();
      if (res.autoFixtures?.created) {
        Alert.alert("You're in!", `All team slots are filled — ${res.autoFixtures.created} fixtures were generated.`);
      }
    } catch (e) {
      Alert.alert("Couldn't join", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function generateFixtures() {
    setBusy(true);
    try {
      const res = await apiJson<{ created: number; skipped: { sportKey: string; reason: string }[] }>(
        `/interschool/events/${id}/fixtures`,
        { method: "POST", body: JSON.stringify({}) }
      );
      await load();
      const notes = res.skipped.map((s) => `${s.sportKey}: ${s.reason}`).join("\n");
      Alert.alert(
        res.created ? `${res.created} fixtures generated` : "No fixtures generated",
        notes || "Round robin is ready — every team plays every team."
      );
    } catch (e) {
      Alert.alert("Couldn't generate", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Post-league confirmation: the host set groups + playoff mode when the
  // event was listed; each tap builds the next playoff round (Semis → Final).
  async function generatePlayoffs() {
    setBusy(true);
    try {
      const res = await apiJson<{
        created: { sportKey: string; round: string; matches: number }[];
        skipped: { sportKey: string; reason: string }[];
      }>(`/interschool/events/${id}/playoffs`, { method: "POST", body: JSON.stringify({}) });
      await load();
      const madeLines = res.created.map((c) => `${c.sportKey}: ${c.round} (${c.matches} match${c.matches === 1 ? "" : "es"})`);
      const skipLines = res.skipped.map((s) => `${s.sportKey}: ${s.reason}`);
      Alert.alert(
        res.created.length ? "Playoff round ready 🏆" : "Nothing to generate yet",
        [...madeLines, ...skipLines].join("\n") || "All playoff rounds are done."
      );
    } catch (e) {
      Alert.alert("Couldn't generate playoffs", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function closeEvent() {
    setBusy(true);
    try {
      await apiJson(`/interschool/events/${id}/close`, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (e) {
      Alert.alert("Couldn't close", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function nominate(clientId: string) {
    try {
      await apiJson(`/interschool/events/${id}/rosters`, {
        method: "POST",
        body: JSON.stringify({ sportKey: rosterSport, clientId }),
      });
      const fresh = await apiJson<RosterEntry[]>(`/interschool/events/${id}/rosters`).catch(() => rosters);
      setRosters(fresh);
      // The last roster in can auto-generate fixtures — refresh everything.
      await load();
    } catch (e) {
      Alert.alert("Couldn't nominate", e instanceof Error ? e.message : "Please try again.");
    }
  }

  async function removeNomination(rosterId: string) {
    try {
      await apiJson(`/interschool/events/${id}/rosters/${rosterId}`, { method: "DELETE" });
      setRosters((prev) => prev.filter((r) => r.id !== rosterId));
    } catch (e) {
      Alert.alert("Couldn't remove", e instanceof Error ? e.message : "Please try again.");
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      const msg = await apiJson<EventMessage>(`/interschool/events/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      setMessages((prev) => [...(prev ?? []), msg]);
      setTimeout(() => chatScroll.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      Alert.alert("Couldn't send", e instanceof Error ? e.message : "Please try again.");
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>{event.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <Pill tone={EVENT_TONE[event.status as keyof typeof EVENT_TONE] ?? "neutral"}>{event.status}</Pill>
          {isHost ? <Pill tone="warning">hosting</Pill> : iAmMember ? <Pill tone="success">joined</Pill> : null}
          {event.hostAcademy ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Hosted by {event.hostAcademy.name}</Text>
          ) : null}
        </View>
      </View>

      <Card>
        <Text style={{ color: colors.textPrimary, fontSize: 14 }}>
          {formatDate(event.startDate)} – {formatDate(event.endDate)}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
          {event.sports.join(", ")} · {event.formatType}
          {event.ageBands?.length ? ` · ${event.ageBands.join(", ")}` : ""}
        </Text>
        {event.venue ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 }}>
            <Ionicons name="location-outline" size={14} color={colors.accent} />
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{event.venue}</Text>
          </View>
        ) : null}
        {event.payToJoin ? (
          <Text style={{ color: colors.warning, fontSize: 12, marginTop: 4 }}>
            Pay to join{event.pricePerHead != null ? ` · ₹${Number(event.pricePerHead)} per head` : ""}
          </Text>
        ) : null}
        {/* Team slots */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          <Ionicons name="people-outline" size={16} color={colors.accent} />
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
            {joinedTeams}
            {event.maxTeams != null ? ` of ${event.maxTeams}` : ""} team{joinedTeams === 1 ? "" : "s"} in
          </Text>
          {slotsLeft != null && (
            <Text style={{ color: slotsLeft > 0 ? colors.textMuted : colors.success, fontSize: 12 }}>
              {slotsLeft > 0 ? `· ${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left` : "· full — fixtures auto-generate"}
            </Text>
          )}
        </View>
        {!iAmMember && event.status === "scheduled" && (slotsLeft == null || slotsLeft > 0) && (
          <View style={{ marginTop: 12 }}>
            <PrimaryButton title={busy ? "Joining…" : "Join this event"} onPress={join} disabled={busy} />
          </View>
        )}
        {isHost && event.status !== "closed" && (
          <View style={{ marginTop: 12 }}>
            {fixtures.length === 0 || openFixtures.length > 0 ? (
              <>
                <PrimaryButton
                  title={busy ? "Working…" : "Generate fixtures (round robin)"}
                  onPress={generateFixtures}
                  disabled={busy}
                />
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6, textAlign: "center" }}>
                  Builds every-team-plays-every-team fixtures for each sport whose rosters are in.
                </Text>
              </>
            ) : (event as { playoffMode?: string }).playoffMode &&
              (event as { playoffMode?: string }).playoffMode !== "none" &&
              !event.sports.every((sk) =>
                fixtures.some(
                  (f) => f.sportKey === sk && (f as { roundLabel?: string | null }).roundLabel === "Final" && f.status === "completed"
                )
              ) ? (
              <>
                {/* League stage done, playoffs configured — the host confirms
                    each round here (opening round, then winners onward). */}
                <PrimaryButton title={busy ? "Working…" : "🏆 Generate playoff round"} onPress={generatePlayoffs} disabled={busy} />
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6, textAlign: "center" }}>
                  You set this event to finish with{" "}
                  {(event as { playoffMode?: string }).playoffMode === "final"
                    ? "a Final (top 2)"
                    : (event as { playoffMode?: string }).playoffMode === "semis"
                      ? "Semi-finals (top 4)"
                      : "Quarter-finals (top 8)"}
                  {" — "}each tap builds the next round from the standings/winners.
                </Text>
              </>
            ) : (
              <>
                {/* All fixtures settled → the host wraps the event up, which
                    locks the chat and freezes the final standings. */}
                <PrimaryButton title={busy ? "Working…" : "🏁 Close event"} onPress={closeEvent} disabled={busy} />
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6, textAlign: "center" }}>
                  Every match has a result — closing ends the event and locks the team chat.
                </Text>
              </>
            )}
          </View>
        )}
      </Card>

      {/* Console tabs — same layout as the tournament scoring console */}
      <ChipRow
        scroll
        options={[
          ...(canScoreRole
            ? [{ key: "score", label: `⚡ Score${openFixtures.length ? ` (${openFixtures.length})` : ""}` }]
            : []),
          { key: "fixtures", label: "Fixtures" },
          ...(canScoreRole ? [{ key: "roster", label: "Roster" }] : []),
          { key: "standings", label: "Standings" },
          ...(messages !== null ? [{ key: "chat", label: "💬 Chat" }] : []),
        ]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

      {/* Roster — nominate my students per sport; the missing link that
          makes fixtures possible entirely from the app */}
      {tab === "roster" && (
        <View style={{ gap: 12 }}>
          {(event.sports.length > 1) && (
            <ChipRow
              scroll
              options={event.sports.map((s) => ({ key: s, label: s.replace(/[-_]/g, " ") }))}
              value={rosterSport}
              onChange={setRosterSport}
            />
          )}
          <Card>
            <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 2 }}>
              My {rosterSport.replace(/[-_]/g, " ")} roster
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 10 }}>
              Fixtures generate once every team's roster is in.
            </Text>
            {rosters.filter((r) => r.sportKey === rosterSport && r.academy.id === user?.academyId).length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>No players nominated yet — add them below.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {rosters
                  .filter((r) => r.sportKey === rosterSport && r.academy.id === user?.academyId)
                  .map((r) => (
                    <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="person-circle-outline" size={20} color={colors.accent} />
                      <Text style={{ color: colors.textPrimary, fontSize: 14, flex: 1 }}>{r.client.name}</Text>
                      <Pill tone={r.eligibilityStatus === "eligible" ? "success" : "warning"}>
                        {r.eligibilityStatus}
                      </Pill>
                      <TouchableOpacity onPress={() => removeNomination(r.id)} style={{ padding: 4 }}>
                        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            )}
          </Card>
          <Card>
            <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 10 }}>Add a player</Text>
            {(() => {
              const nominatedIds = new Set(
                rosters.filter((r) => r.sportKey === rosterSport && r.academy.id === user?.academyId).map((r) => r.client.id)
              );
              const available = clients.filter((c) => !nominatedIds.has(c.id));
              if (available.length === 0) {
                return <Text style={{ color: colors.textMuted, fontSize: 13 }}>All your students are nominated.</Text>;
              }
              return (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {available.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => nominate(c.id)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          borderRadius: 999,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={15} color={colors.accent} />
                        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              );
            })()}
          </Card>
          {rosters.some((r) => r.academy.id !== user?.academyId) && (
            <Card>
              <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 8 }}>Other teams</Text>
              {[...new Set(rosters.filter((r) => r.academy.id !== user?.academyId).map((r) => r.academy.name))].map(
                (name) => {
                  const count = rosters.filter((r) => r.academy.name === name && r.sportKey === rosterSport).length;
                  return (
                    <Text key={name} style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>
                      {name} · {count} player{count === 1 ? "" : "s"} nominated
                    </Text>
                  );
                }
              )}
            </Card>
          )}
        </View>
      )}

      {/* Standings — from completed fixture results */}
      {tab === "standings" &&
        (standings.some((s) => s.rows.length > 0) ? (
        <View>
          {standings.map((s) => (
            <Card key={s.sportKey} style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "capitalize" }}>
                {s.sportKey.replace(/[-_]/g, " ")}
              </Text>
              <View style={{ flexDirection: "row", marginBottom: 6 }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, flex: 1 }}>TEAM</Text>
                {["P", "W", "L", "PTS"].map((h) => (
                  <Text key={h} style={{ color: colors.textMuted, fontSize: 11, width: 34, textAlign: "center" }}>
                    {h}
                  </Text>
                ))}
              </View>
              {s.rows.map((r, i) => (
                <View key={r.academyId} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5 }}>
                  <Text style={{ color: i === 0 ? colors.accent : colors.textPrimary, fontSize: 13, flex: 1, fontWeight: i === 0 ? "700" : "400" }}>
                    {MEDALS[i] ? `${MEDALS[i]} ` : `${i + 1}. `}
                    {r.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, width: 34, textAlign: "center" }}>{r.played}</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, width: 34, textAlign: "center" }}>{r.won}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, width: 34, textAlign: "center" }}>{r.lost}</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, width: 34, textAlign: "center", fontWeight: "700" }}>
                    {r.points}
                  </Text>
                </View>
              ))}
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState message="No completed results yet — the table builds as scores are confirmed." />
      ))}

      {(tab === "fixtures" || tab === "score") && (
      <View>
        {(tab === "score" ? openFixtures : fixtures).length === 0 ? (
          <EmptyState
            message={
              tab === "score"
                ? "All caught up — every fixture has a result. 🎉"
                : "No fixtures yet — they appear when the host generates them or all team slots fill."
            }
          />
        ) : (
          <View style={{ gap: 8 }}>
            {(tab === "score" ? openFixtures : fixtures).map((f) => {
              const open = !["completed", "abandoned"].includes(f.status);
              // Same scoring option as everywhere else: coaches, head
              // coaches, admins and account managers score right from here.
              const canScore = ["admin", "head_coach", "coach", "account_manager"].includes(user?.role ?? "");
              return (
                <ListRow
                  key={f.id}
                  title={`${f.sportKey} · ${
                    (f as { roundLabel?: string | null }).roundLabel
                      ? `🏆 ${(f as { roundLabel?: string | null }).roundLabel}`
                      : (f as { groupNo?: number | null }).groupNo
                        ? `Group ${String.fromCharCode(64 + ((f as { groupNo?: number | null }).groupNo ?? 1))}`
                        : f.matchType.replace("_", " ")
                  }`}
                  subtitle={[
                    fixtureWhen(f.scheduledAt),
                    f.venue ?? undefined,
                    f.resultSummary?.scoreDisplay ?? undefined,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  right={
                    canScore && open ? (
                      <View
                        style={{
                          backgroundColor: f.status === "pending_confirmation" ? "transparent" : colors.accent,
                          borderWidth: 1,
                          borderColor: colors.accent,
                          borderRadius: 999,
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                        }}
                      >
                        <Text
                          style={{
                            color: f.status === "pending_confirmation" ? colors.accent : colors.accentText,
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          {f.status === "pending_confirmation" ? "Approve" : "⚡ Score"}
                        </Text>
                      </View>
                    ) : (
                      <Pill tone={FIXTURE_TONE[f.status as keyof typeof FIXTURE_TONE] ?? "neutral"}>
                        {f.status.replace("_", " ")}
                      </Pill>
                    )
                  }
                  onPress={() => router.push(`/coach/fixtures/${f.id}`)}
                />
              );
            })}
          </View>
        )}
      </View>
      )}

      {/* Team chat — members only, locks when the event closes */}
      {tab === "chat" && messages !== null && (
        <View>
          {!chatOpen && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Ionicons name="chatbubbles-outline" size={16} color={colors.accent} />
              <Pill tone="neutral">chat closed</Pill>
            </View>
          )}
          <Card>
            <ScrollView
              ref={chatScroll}
              style={{ maxHeight: 400 }}
              onContentSizeChange={() => chatScroll.current?.scrollToEnd({ animated: false })}
            >
              {messages.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  No messages yet — say hello to the other teams!
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {messages.map((m) => {
                    const mine = m.academy.id === user?.academyId;
                    return (
                      <View
                        key={m.id}
                        style={{
                          alignSelf: mine ? "flex-end" : "flex-start",
                          maxWidth: "85%",
                          backgroundColor: mine ? "rgba(245,185,63,0.15)" : colors.surface,
                          borderWidth: 1,
                          borderColor: mine ? "rgba(245,185,63,0.35)" : colors.border,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ color: mine ? colors.accent : colors.textSecondary, fontSize: 11, fontWeight: "700" }}>
                          {m.senderName} · {m.academy.name}
                        </Text>
                        <Text style={{ color: colors.textPrimary, fontSize: 13, marginTop: 2 }}>{m.body}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            {chatOpen ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Message the teams…"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    flex: 1,
                    color: colors.textPrimary,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    fontSize: 13,
                  }}
                  onSubmitEditing={send}
                />
                <TouchableOpacity
                  onPress={send}
                  disabled={!draft.trim()}
                  style={{
                    backgroundColor: draft.trim() ? colors.accent : colors.surface,
                    borderRadius: 999,
                    padding: 10,
                  }}
                >
                  <Ionicons name="send" size={16} color={draft.trim() ? colors.accentText : colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 10 }}>
                The event has ended — the chat is read-only now.
              </Text>
            )}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
