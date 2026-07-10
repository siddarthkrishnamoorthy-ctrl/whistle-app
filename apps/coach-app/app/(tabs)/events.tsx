import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, ListRow, Pill, colors } from "@/components/ui";
import { formatDate, type InterschoolEvent } from "@whistle/shared";

type EventRow = InterschoolEvent & {
  hostAcademy?: { id: string; name: string };
  _count?: { fixtures: number; invitations: number };
  // Discovery is ranked by distance from the coach's center pin (2026-07).
  distanceKm?: number | null;
  nearestVenue?: string | null;
  // Match Center team slots (2026-07).
  teamsJoined?: number;
  maxTeams?: number | null;
  myAcademyJoined?: boolean;
};

interface LblRegistration {
  id: string;
  sportKey: string;
  status: "pending_payment" | "paid";
  amount?: string | number | null;
}

type LblEvent = InterschoolEvent & {
  hostAcademy?: { id: string; name: string };
  lblRegistrations: LblRegistration[]; // scoped to MY academy by the API
  _count?: { fixtures: number; lblRegistrations: number };
};

const STATUS_TONE = {
  draft: "neutral",
  scheduled: "info",
  live: "warning",
  completed: "success",
  closed: "success",
} as const;

function EventList({ events, emptyMessage }: { events: EventRow[]; emptyMessage: string }) {
  if (events.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <View style={{ gap: 8 }}>
      {events.map((e) => (
        <ListRow
          key={e.id}
          title={e.name}
          subtitle={[
            `${formatDate(e.startDate)} – ${formatDate(e.endDate)}`,
            e.sports.join(", "),
            e.hostAcademy ? `Host: ${e.hostAcademy.name}` : undefined,
            e.teamsJoined != null
              ? `👥 ${e.teamsJoined}${e.maxTeams != null ? `/${e.maxTeams}` : ""} teams${
                  e.maxTeams != null && e.teamsJoined >= e.maxTeams ? " · full" : e.myAcademyJoined ? " · joined" : ""
                }`
              : undefined,
            e.distanceKm != null ? `📍 ≈${e.distanceKm} km away${e.nearestVenue ? ` (${e.nearestVenue})` : ""}` : undefined,
          ]
            .filter(Boolean)
            .join(" · ")}
          right={<Pill tone={STATUS_TONE[e.status as keyof typeof STATUS_TONE] ?? "neutral"}>{e.status}</Pill>}
          onPress={() => router.push(`/events/${e.id}`)}
        />
      ))}
    </View>
  );
}

export default function EventsScreen() {
  const { user } = useAuth();
  const [mine, setMine] = useState<EventRow[]>([]);
  const [nearby, setNearby] = useState<EventRow[]>([]);
  const [lbl, setLbl] = useState<LblEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyLbl, setBusyLbl] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user?.academyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiJson<EventRow[]>("/interschool/events").catch(() => [] as EventRow[]),
      apiJson<EventRow[]>("/interschool/events?scope=discover").catch(() => [] as EventRow[]),
      apiJson<LblEvent[]>("/interschool/lbl/events").catch(() => [] as LblEvent[]),
    ])
      .then(([own, discovered, lblEvents]) => {
        if (cancelled) return;
        const lblIds = new Set(lblEvents.map((e) => e.id));
        setMine(own.filter((e) => !lblIds.has(e.id)));
        setNearby(discovered.filter((e) => !lblIds.has(e.id)));
        setLbl(lblEvents);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  useFocusEffect(load);

  async function lblAction(event: LblEvent, action: "register" | "pay" | "generate", sportKey?: string) {
    setBusyLbl(event.id + (sportKey ?? ""));
    try {
      if (action === "register") {
        await apiJson(`/interschool/lbl/events/${event.id}/register`, {
          method: "POST",
          body: JSON.stringify({ sports: sportKey ? [sportKey] : event.sports }),
        });
      } else if (action === "pay") {
        await apiJson(`/interschool/lbl/events/${event.id}/pay`, {
          method: "POST",
          body: JSON.stringify({ sportKey }),
        });
      } else {
        const res = await apiJson<{ created: number; skipped: { sportKey: string; reason: string }[] }>(
          `/interschool/lbl/events/${event.id}/generate-fixtures`,
          { method: "POST", body: JSON.stringify({}) }
        );
        Alert.alert(
          "Fixtures",
          `${res.created} fixture(s) created.` +
            (res.skipped.length ? `\nSkipped: ${res.skipped.map((s) => `${s.sportKey} (${s.reason})`).join("; ")}` : "")
        );
      }
      load();
    } catch (e) {
      Alert.alert("LBL", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusyLbl(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>Match Center</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Interschool tournaments and fixtures</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/events/new")}
          style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.accent, borderRadius: 999 }}
        >
          <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 13 }}>+ Host</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      ) : (
        <>
          {lbl.length > 0 ? (
            <View>
              {/* Exclusive LBL header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                  borderLeftWidth: 3,
                  borderLeftColor: colors.accent,
                  paddingLeft: 10,
                }}
              >
                <Text style={{ color: colors.accent, fontSize: 16, fontWeight: "800", letterSpacing: 1 }}>
                  LBL TOURNAMENTS
                </Text>
                <Pill tone="warning">exclusive</Pill>
              </View>
              <View style={{ gap: 10 }}>
                {lbl.map((event) => {
                  const isHost = event.hostAcademy?.id === user?.academyId;
                  const regBySport = new Map(event.lblRegistrations.map((r) => [r.sportKey, r]));
                  return (
                    <Card key={event.id}>
                      <TouchableOpacity onPress={() => router.push(`/events/${event.id}`)} activeOpacity={0.75}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15, flex: 1 }}>
                            {event.name}
                          </Text>
                          <Pill tone="info">{isHost ? "hosting" : event.status}</Pill>
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }}>
                          {formatDate(event.startDate)} – {formatDate(event.endDate)} · Host:{" "}
                          {event.hostAcademy?.name ?? "—"}
                          {event.payToJoin && event.pricePerHead != null
                            ? ` · ₹${Number(event.pricePerHead)} per sport`
                            : " · free entry"}
                        </Text>
                      </TouchableOpacity>

                      {!isHost ? (
                        <View style={{ gap: 6, marginTop: 10 }}>
                          {event.sports.map((sportKey) => {
                            const reg = regBySport.get(sportKey);
                            const busy = busyLbl === event.id + sportKey;
                            return (
                              <View
                                key={sportKey}
                                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                              >
                                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
                                  {sportKey}
                                </Text>
                                {!reg ? (
                                  <TouchableOpacity
                                    disabled={busy}
                                    onPress={() => lblAction(event, "register", sportKey)}
                                    style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}
                                  >
                                    <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 12 }}>
                                      {busy ? "…" : "Register"}
                                    </Text>
                                  </TouchableOpacity>
                                ) : reg.status === "pending_payment" ? (
                                  <TouchableOpacity
                                    disabled={busy}
                                    onPress={() => lblAction(event, "pay", sportKey)}
                                    style={{ backgroundColor: colors.warning, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}
                                  >
                                    <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 12 }}>
                                      {busy ? "…" : `Pay ₹${Number(reg.amount ?? 0)}`}
                                    </Text>
                                  </TouchableOpacity>
                                ) : (
                                  <Pill tone="success">registered ✓</Pill>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={{ marginTop: 10 }}>
                          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
                            {event._count?.lblRegistrations ?? 0} school registration(s) · {event._count?.fixtures ?? 0}{" "}
                            fixture(s)
                          </Text>
                          <TouchableOpacity
                            disabled={busyLbl === event.id}
                            onPress={() => lblAction(event, "generate")}
                            style={{ backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}
                          >
                            <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 13 }}>
                              {busyLbl === event.id ? "Generating…" : "Generate fixtures"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </Card>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
              Your academy
            </Text>
            <EventList events={mine} emptyMessage="No events yet — host one with the + Host button." />
          </View>

          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
              Around you
            </Text>
            <EventList
              events={nearby}
              emptyMessage="No published events from other academies in your network yet."
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
