import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, ListRow, LoadingView, Pill, colors } from "@/components/ui";
import { formatDate, type Fixture, type InterschoolEvent } from "@whistle/shared";

type EventDetail = InterschoolEvent & {
  hostAcademy?: { id: string; name: string };
  fixtures?: Fixture[];
  invitations?: { status: string }[];
  maxTeams?: number | null;
};

interface StandingsRow {
  academyId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  points: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

const EVENT_TONE = { draft: "neutral", scheduled: "info", live: "warning", completed: "success", closed: "success" } as const;
const FIXTURE_TONE = {
  draft: "neutral",
  scheduled: "info",
  live: "warning",
  pending_confirmation: "warning",
  completed: "success",
  abandoned: "danger",
} as const;

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [standings, setStandings] = useState<{ sportKey: string; rows: StandingsRow[] }[]>([]);
  const [loading, setLoading] = useState(true);

  // Focus-based so results and standings are fresh every time the parent
  // opens the event — right after a coach confirms a score.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      apiJson<EventDetail>(`/interschool/events/${id}`)
        .then(setEvent)
        .catch(() => setEvent(null))
        .finally(() => setLoading(false));
      apiJson<{ standings: { sportKey: string; rows: StandingsRow[] }[] }>(`/interschool/events/${id}/standings`)
        .then((s) => setStandings(s.standings))
        .catch(() => setStandings([]));
    }, [id])
  );

  if (loading) return <LoadingView />;
  if (!event) return <EmptyState message="Event not found." />;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>{event.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <Pill tone={EVENT_TONE[event.status as keyof typeof EVENT_TONE] ?? "neutral"}>{event.status}</Pill>
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
        {event.invitations && (
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            👥 {1 + event.invitations.filter((i) => i.status === "accepted").length}
            {event.maxTeams != null ? ` of ${event.maxTeams}` : ""} teams playing
          </Text>
        )}
      </Card>

      {/* Event standings — from confirmed match results */}
      {standings.some((s) => s.rows.length > 0) && (
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
            Standings
          </Text>
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
      )}

      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
          Fixtures {event.fixtures?.length ? `(${event.fixtures.length})` : ""}
        </Text>
        {!event.fixtures || event.fixtures.length === 0 ? (
          <EmptyState message="No fixtures scheduled yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {event.fixtures.map((f) => (
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
                  <Pill tone={FIXTURE_TONE[f.status as keyof typeof FIXTURE_TONE] ?? "neutral"}>
                    {f.status.replace("_", " ")}
                  </Pill>
                }
                onPress={() => router.push(`/fixtures/${f.id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
