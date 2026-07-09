import { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
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

export default function EventsScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.academyId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      Promise.all([
        apiJson<EventRow[]>("/interschool/events").catch(() => [] as EventRow[]),
        apiJson<EventRow[]>("/interschool/events?scope=discover").catch(() => [] as EventRow[]),
      ])
        .then(([own, nearby]) => {
          if (cancelled) return;
          const seen = new Set<string>();
          const merged = [...own, ...nearby].filter((e) => !seen.has(e.id) && seen.add(e.id));
          merged.sort((a, b) => a.startDate.localeCompare(b.startDate));
          setEvents(merged);
        })
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [user])
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
      ) : events.length === 0 ? (
        <EmptyState message="No interschool events yet." />
      ) : (
        <View style={{ marginTop: 4 }}>
          {events.map((e, i) => (
            <TimelineItem key={e.id} event={e} isLast={i === events.length - 1} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
