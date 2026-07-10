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

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [standings, setStandings] = useState<{ sportKey: string; rows: StandingsRow[] }[]>([]);
  const [messages, setMessages] = useState<EventMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Same console layout as the tournament module: one tab open at a time
  // keeps the screen calm however many fixtures or messages pile up.
  const [tab, setTab] = useState<"score" | "fixtures" | "standings" | "chat">("fixtures");
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
        {isHost && (
          <View style={{ marginTop: 12 }}>
            <PrimaryButton
              title={busy ? "Working…" : "Generate fixtures (round robin)"}
              onPress={generateFixtures}
              disabled={busy}
            />
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6, textAlign: "center" }}>
              Builds every-team-plays-every-team fixtures for each sport whose rosters are in.
            </Text>
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
          { key: "standings", label: "Standings" },
          ...(messages !== null ? [{ key: "chat", label: "💬 Chat" }] : []),
        ]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

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
                  title={`${f.sportKey} · ${f.matchType.replace("_", " ")}`}
                  subtitle={[
                    f.scheduledAt ? formatDate(f.scheduledAt) : "Unscheduled",
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
                  onPress={() => router.push(`/fixtures/${f.id}`)}
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
