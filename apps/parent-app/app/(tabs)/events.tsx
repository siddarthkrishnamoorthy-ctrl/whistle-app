import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { useChildren } from "@/lib/children-context";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Pill, colors } from "@/components/ui";
import { formatDate, type InterschoolEvent } from "@whistle/shared";
import { RANK_MEDALS, sportEmoji } from "@/lib/sport-emoji";

type EventRow = InterschoolEvent & {
  hostAcademy?: { id: string; name: string };
  _count?: { fixtures: number; invitations: number };
};

const STATUS_TONE = { draft: "neutral", scheduled: "info", live: "warning", completed: "success", closed: "success" } as const;

// Vertical chronological feed: a timeline rail with glowing dots on the left,
// spaced glass cards on the right.
function TimelineItem({ event, isLast }: { event: EventRow; isLast: boolean }) {
  const live = event.status === "live";
  return (
    <View style={{ flexDirection: "row" }}>
      <View style={{ width: 26, alignItems: "center" }}>
        <View
          style={{
            width: 11,
            height: 11,
            borderRadius: 6,
            marginTop: 6,
            backgroundColor: live ? colors.warning : colors.accent,
            shadowColor: live ? colors.warning : colors.accent,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 6,
            elevation: 3,
          }}
        />
        {!isLast ? <View style={{ flex: 1, width: 1.5, backgroundColor: colors.border, marginTop: 4 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: 18 }}>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 6, fontWeight: "600" }}>
          {formatDate(event.startDate)} – {formatDate(event.endDate)}
        </Text>
        <TouchableOpacity onPress={() => router.push(`/events/${event.id}`)} activeOpacity={0.75}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15, flex: 1, marginRight: 8 }}>
                {event.name}
              </Text>
              <Pill tone={STATUS_TONE[event.status as keyof typeof STATUS_TONE] ?? "neutral"}>{event.status}</Pill>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              {[
                event.sports.join(", "),
                event.hostAcademy ? `Host: ${event.hostAcademy.name}` : undefined,
                event._count ? `${event._count.fixtures} fixture(s)` : undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </Card>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface FixtureRow {
  id: string;
  sportKey: string;
  matchType: string;
  status: string;
  scheduledAt?: string | null;
  resultSummary?: { scoreDisplay?: string; winnerSide?: string } | null;
}

interface LeaderRow {
  client?: { id: string; name: string; academy?: { name: string } };
  clientId?: string;
  currentRating?: number | string;
  rating?: number | string;
  matchesPlayed?: number;
}

interface Sport {
  key: string;
  name: string;
}

interface KidMatch {
  fixtureId: string;
  sportKey: string;
  status: string;
  playedAt?: string | null;
  result?: { scoreDisplay?: string } | null;
  stats: Record<string, unknown>;
}

export default function EventsScreen() {
  const { user } = useAuth();
  const { selectedChild } = useChildren();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [kidMatches, setKidMatches] = useState<KidMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [search, setSearch] = useState("");
  const [sports, setSports] = useState<Sport[]>([]);
  // Standings sport can be browsed — defaults to the child's sport.
  const [standingsSport, setStandingsSport] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!user?.academyId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      const childSport = selectedChild?.enrollments?.[0]?.class?.sportKey ?? "";
      Promise.all([
        apiJson<EventRow[]>("/interschool/events").catch(() => [] as EventRow[]),
        apiJson<EventRow[]>("/interschool/events?scope=discover").catch(() => [] as EventRow[]),
        apiJson<FixtureRow[]>("/fixtures").catch(() => [] as FixtureRow[]),
        selectedChild
          ? apiJson<KidMatch[]>(`/player-stats/${selectedChild.id}`).catch(() => [] as KidMatch[])
          : Promise.resolve([] as KidMatch[]),
        apiJson<Sport[]>("/sports").catch(() => [] as Sport[]),
      ])
        .then(([own, nearby, fx, kid, sportList]) => {
          if (cancelled) return;
          const seen = new Set<string>();
          const merged = [...own, ...nearby].filter((e) => !seen.has(e.id) && seen.add(e.id));
          merged.sort((a, b) => a.startDate.localeCompare(b.startDate));
          setEvents(merged);
          setFixtures(fx.filter((f) => f.status === "live" || f.status === "scheduled").slice(0, 6));
          setKidMatches(kid.slice(0, 5));
          setSports(sportList);
          // Seed the standings sport: child's sport if known, else the first.
          setStandingsSport((prev) => prev || childSport || sportList[0]?.key || "");
        })
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [user, selectedChild])
  );

  // Standings reload whenever the browsed sport changes.
  useEffect(() => {
    if (!standingsSport || !user?.academyId) return;
    let cancelled = false;
    apiJson<LeaderRow[]>(`/ratings/leaderboard/students?sportKey=${standingsSport}&formatType=individual`)
      .then((board) => !cancelled && setLeaders(board.slice(0, 10)))
      .catch(() => !cancelled && setLeaders([]));
    return () => {
      cancelled = true;
    };
  }, [standingsSport, user]);

  const shownEvents = events.filter(
    (e) => !search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>Match Center</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Tournaments from your academy and nearby schools
        </Text>
      </View>

      {loading ? (
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      ) : !user?.academyId ? (
        <EmptyState message="Link your child first to see their academy's events." />
      ) : (
        <>
          {/* Search the events feed */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: 12,
              paddingHorizontal: 12,
            }}
          >
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search events…"
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, color: colors.textPrimary, paddingVertical: 9, fontSize: 14 }}
            />
            {search.trim().length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Matches being played right now / coming up */}
          {fixtures.length > 0 && (
            <View>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
                Matches
              </Text>
              <View style={{ gap: 8 }}>
                {fixtures.map((f) => (
                  <Card key={f.id}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ color: colors.textPrimary, fontWeight: "600", textTransform: "capitalize" }}>
                          {f.sportKey} · {f.matchType.replace("_", " ")}
                        </Text>
                        {f.resultSummary?.scoreDisplay ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                            {f.resultSummary.scoreDisplay}
                          </Text>
                        ) : null}
                      </View>
                      <Pill tone={f.status === "live" ? "warning" : "success"}>{f.status}</Pill>
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          )}

          {/* Whistle Standings — browsable by sport, always available */}
          {sports.length > 0 && (
            <View>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>Whistle Standings</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>
                DUPR-style rating earned across every match played — pick a sport to browse.
              </Text>
              {/* Scrollable emoji sport picker */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                {sports.map((s) => {
                  const active = s.key === standingsSport;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      onPress={() => setStandingsSport(s.key)}
                      activeOpacity={0.8}
                      style={{
                        width: 72,
                        paddingVertical: 9,
                        alignItems: "center",
                        gap: 3,
                        borderRadius: 13,
                        borderWidth: 1,
                        borderColor: active ? colors.accent : colors.border,
                        backgroundColor: active ? colors.accent + "22" : colors.surface,
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>{sportEmoji(s.key)}</Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: active ? colors.accent : colors.textSecondary, fontSize: 10, fontWeight: active ? "800" : "600" }}
                      >
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {leaders.length === 0 ? (
                <EmptyState message="No rated players in this sport yet." />
              ) : (
                <Card>
                  {leaders.map((l, i) => {
                    const cid = l.client?.id ?? l.clientId;
                    const rating = l.currentRating ?? l.rating;
                    const isMine = cid && cid === selectedChild?.id;
                    return (
                      <View
                        key={cid ?? i}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 6,
                          borderBottomWidth: i < leaders.length - 1 ? 1 : 0,
                          borderBottomColor: "rgba(255,255,255,0.06)",
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                          <Text style={{ width: 24, textAlign: "center", fontSize: RANK_MEDALS[i] ? 15 : 12, color: colors.textMuted, fontWeight: "700" }}>
                            {RANK_MEDALS[i] ?? `${i + 1}`}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{ color: isMine ? colors.accent : colors.textPrimary, fontWeight: isMine ? "800" : "500", fontSize: 13, flex: 1 }}
                          >
                            {l.client?.name ?? "—"}
                            {isMine ? "  (your child)" : ""}
                          </Text>
                        </View>
                        <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "700" }}>
                          {rating != null ? Number(rating).toFixed(2) : "—"}
                        </Text>
                      </View>
                    );
                  })}
                </Card>
              )}
            </View>
          )}

          {/* The child's own match performance */}
          {kidMatches.length > 0 && selectedChild && (
            <View>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
                {selectedChild.name}&apos;s matches
              </Text>
              <View style={{ gap: 8 }}>
                {kidMatches.map((m) => (
                  <Card key={m.fixtureId}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "600", textTransform: "capitalize" }}>
                      {m.sportKey} {m.result?.scoreDisplay ? `— ${m.result.scoreDisplay}` : ""}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      {Object.entries(m.stats ?? {})
                        .slice(0, 4)
                        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                        .join(" · ") || "played"}
                    </Text>
                  </Card>
                ))}
              </View>
            </View>
          )}

          {/* Tournaments timeline — a short feed with a View-all expander */}
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginTop: 4 }}>Tournaments</Text>
          {shownEvents.length === 0 ? (
            <EmptyState message={search ? "No events match your search." : "No interschool events yet."} />
          ) : (
            <View style={{ marginTop: 4 }}>
              {(showAllEvents ? shownEvents : shownEvents.slice(0, 4)).map((e, i, arr) => (
                <TimelineItem key={e.id} event={e} isLast={i === arr.length - 1} />
              ))}
              {shownEvents.length > 4 && (
                <TouchableOpacity onPress={() => setShowAllEvents((v) => !v)}>
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "600", textAlign: "center", paddingVertical: 4 }}>
                    {showAllEvents ? "Show less" : `View all ${shownEvents.length} events`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
