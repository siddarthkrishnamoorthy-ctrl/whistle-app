import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, ListRow, LoadingView, Pill, colors } from "@/components/ui";
import { formatDate, type Fixture, type InterschoolEvent } from "@whistle/shared";

type EventDetail = InterschoolEvent & {
  hostAcademy?: { id: string; name: string };
  fixtures?: Fixture[];
};

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiJson<EventDetail>(`/interschool/events/${id}`)
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [id]);

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
        {event.payToJoin ? (
          <Text style={{ color: colors.warning, fontSize: 12, marginTop: 4 }}>
            Pay to join{event.pricePerHead != null ? ` · ₹${Number(event.pricePerHead)} per head` : ""}
          </Text>
        ) : null}
      </Card>

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
                right={<Pill tone={FIXTURE_TONE[f.status as keyof typeof FIXTURE_TONE] ?? "neutral"}>{f.status.replace("_", " ")}</Pill>}
                onPress={() => router.push(`/fixtures/${f.id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
