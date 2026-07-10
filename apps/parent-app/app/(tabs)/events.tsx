import { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { useChildren } from "@/lib/children-context";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Pill, colors } from "@/components/ui";
import { formatDate, type InterschoolEvent } from "@whistle/shared";

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
  client?: { id: string; name: string };
  rating?: number | string;
  matchesPlayed?: number;
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

  useFocusEffect(
    useCallback(() => {
      if (!user?.academyId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      const childSport = selectedChild?.enrollments?.[0]?.class?.sportKey ?? "badminton";
      Promise.all([
        apiJson<EventRow[]>("/interschool/events").catch(() => [] as EventRow[]),
        apiJson<EventRow[]>("/interschool/events?scope=discover").catch(() => [] as EventRow[]),
        apiJson<FixtureRow[]>("/fixtures").catch(() => [] as FixtureRow[]),
        apiJson<LeaderRow[]>(`/ratings/leaderboard/students?sportKey=${childSport}&formatType=individual`).catch(
          () => [] as LeaderRow[]
        ),
        selectedChild
          ? apiJson<KidMatch[]>(`/player-stats/${selectedChild.id}`).catch(() => [] as KidMatch[])
          : Promise.resolve([] as KidMatch[]),
      ])
        .then(([own, nearby, fx, board, kid]) => {
          if (cancelled) return;
          const seen = new Set<string>();
          const merged = [...own, ...nearby].filter((e) => !seen.has(e.id) && seen.add(e.id));
          merged.sort((a, b) => a.startDate.localeCompare(b.startDate));
          setEvents(merged);
          setFixtures(fx.filter((f) => f.status === "live" || f.status === "scheduled").slice(0, 6));
          setLeaders(board.slice(0, 5));
          setKidMatches(kid.slice(0, 5));
        })
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [user, selectedChild])
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

          {/* Whistle Standings — the leaderboard for the child's sport */}
          {leaders.length > 0 && (
            <View>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>
                Whistle Standings
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>
                Overall ranking — DUPR-style rating earned across every match played
              </Text>
              <Card>
                {leaders.map((l, i) => (
                  <View
                    key={l.client?.id ?? i}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 5,
                      borderBottomWidth: i < leaders.length - 1 ? 1 : 0,
                      borderBottomColor: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <Text
                      style={{
                        color: l.client?.id === selectedChild?.id ? colors.accent : colors.textPrimary,
                        fontWeight: l.client?.id === selectedChild?.id ? "800" : "500",
                        fontSize: 13,
                      }}
                    >
                      {i + 1}. {l.client?.name ?? "—"}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {l.rating != null ? Number(l.rating).toFixed(2) : "—"}
                    </Text>
                  </View>
                ))}
              </Card>
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

          {/* Tournaments timeline */}
          {events.length === 0 ? (
            <EmptyState message="No interschool events yet." />
          ) : (
            <View style={{ marginTop: 4 }}>
              {events.map((e, i) => (
                <TimelineItem key={e.id} event={e} isLast={i === events.length - 1} />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
