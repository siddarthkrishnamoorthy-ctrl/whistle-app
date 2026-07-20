import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { Card, ChipRow, EmptyState, ListRow, Pill, colors } from "@/components/ui";
import { formatDate, type InterschoolEvent } from "@whistle/shared";
import { sportEmoji } from "@/lib/sport-emoji";

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

const LIST_PREVIEW = 4;

// Compact by default: the first few events with a "View all" expander, so
// a long season never turns the tab into an endless wall. On the Registered
// tab each row also gets a quick "💬 Chat" shortcut into the event's team
// thread (where the members message each other about the tournament).
function EventList({
  events,
  emptyMessage,
  showChat,
}: {
  events: EventRow[];
  emptyMessage: string;
  showChat?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  if (events.length === 0) return <EmptyState message={emptyMessage} />;
  const visible = showAll ? events : events.slice(0, LIST_PREVIEW);
  return (
    <View style={{ gap: 8 }}>
      {visible.map((e) => (
        <View key={e.id} style={{ position: "relative" }}>
          <ListRow
            title={`${sportEmoji(e.sports[0])}  ${e.name}`}
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
            onPress={() => router.push(`/coach/events/${e.id}`)}
          />
          {showChat && (
            <TouchableOpacity
              onPress={() => router.push(`/coach/events/${e.id}?tab=chat`)}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                alignSelf: "flex-start",
                marginTop: 6,
                marginLeft: 4,
                borderWidth: 1,
                borderColor: colors.accent,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Ionicons name="chatbubbles-outline" size={13} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>Team chat</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      {events.length > LIST_PREVIEW && (
        <TouchableOpacity onPress={() => setShowAll((v) => !v)}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "600", textAlign: "center", paddingVertical: 4 }}>
            {showAll ? "Show less" : `View all ${events.length}`}
          </Text>
        </TouchableOpacity>
      )}
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
  const [search, setSearch] = useState("");
  // Sub-tabs inside Match Center: what I'm in vs. what I can join.
  const [tab, setTab] = useState<"registered" | "discover">("registered");

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

  const match = (e: EventRow) =>
    !search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase());
  const mineShown = mine.filter(match);
  const nearbyShown = nearby.filter(match);

  // LBL split: events my academy has registered/paid for vs. ones still open
  // to register. Registered LBL live under "Registered" with the rest of my
  // events; unregistered LBL live under "Discover".
  const lblMatch = (e: LblEvent) => !search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase());
  const lblRegistered = lbl.filter(
    (e) => lblMatch(e) && (e.hostAcademy?.id === user?.academyId || e.lblRegistrations.length > 0)
  );
  const lblOpen = lbl.filter(
    (e) => lblMatch(e) && e.hostAcademy?.id !== user?.academyId && e.lblRegistrations.length === 0
  );

  const registeredCount = mineShown.length + lblRegistered.length;
  const discoverCount = nearbyShown.length + lblOpen.length;

  function LblCard({ event }: { event: LblEvent }) {
    const isHost = event.hostAcademy?.id === user?.academyId;
    const regBySport = new Map(event.lblRegistrations.map((r) => [r.sportKey, r]));
    const anyRegistered = event.lblRegistrations.length > 0;
    return (
      <Card>
        <TouchableOpacity onPress={() => router.push(`/coach/events/${event.id}`)} activeOpacity={0.75}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15, flex: 1 }}>
              {sportEmoji(event.sports[0])}  {event.name}
            </Text>
            <Pill tone="info">{isHost ? "hosting" : event.status}</Pill>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }}>
            {formatDate(event.startDate)} – {formatDate(event.endDate)} · Host: {event.hostAcademy?.name ?? "—"}
            {event.payToJoin && event.pricePerHead != null ? ` · ₹${Number(event.pricePerHead)} per sport` : " · free entry"}
          </Text>
        </TouchableOpacity>

        {!isHost ? (
          <View style={{ gap: 6, marginTop: 10 }}>
            {event.sports.map((sportKey) => {
              const reg = regBySport.get(sportKey);
              const busy = busyLbl === event.id + sportKey;
              return (
                <View key={sportKey} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
                    {sportEmoji(sportKey)} {sportKey}
                  </Text>
                  {!reg ? (
                    <TouchableOpacity
                      disabled={busy}
                      onPress={() => lblAction(event, "register", sportKey)}
                      style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}
                    >
                      <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 12 }}>{busy ? "…" : "Register"}</Text>
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
              {event._count?.lblRegistrations ?? 0} school registration(s) · {event._count?.fixtures ?? 0} fixture(s)
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

        {/* Team chat for registered/hosting LBL events — this is where the
            registration conversation happens. */}
        {(isHost || anyRegistered) && (
          <TouchableOpacity
            onPress={() => router.push(`/coach/events/${event.id}?tab=chat`)}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              alignSelf: "flex-start",
              marginTop: 10,
              borderWidth: 1,
              borderColor: colors.accent,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }}
          >
            <Ionicons name="chatbubbles-outline" size={13} color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>Team chat</Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>Match Center</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Interschool tournaments and fixtures</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/coach/events/new")}
          style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.accent, borderRadius: 999 }}
        >
          <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 13 }}>+ Host</Text>
        </TouchableOpacity>
      </View>

      {/* Find an event fast instead of scrolling the whole season */}
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

      {/* Sub-tabs: what I'm in vs. what I can join */}
      <ChipRow
        options={[
          { key: "registered", label: `Registered${registeredCount ? ` (${registeredCount})` : ""}` },
          { key: "discover", label: `Discover${discoverCount ? ` (${discoverCount})` : ""}` },
        ]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

      {loading ? (
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      ) : tab === "registered" ? (
        <>
          {/* Registered LBL tournaments — with team chat where registration happens */}
          {lblRegistered.length > 0 && (
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 10 }}>
                <Text style={{ color: colors.accent, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 }}>LBL TOURNAMENTS</Text>
                <Pill tone="warning">registered</Pill>
              </View>
              <View style={{ gap: 10 }}>
                {lblRegistered.map((event) => (
                  <LblCard key={event.id} event={event} />
                ))}
              </View>
            </View>
          )}

          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
              My events &amp; joined
            </Text>
            <EventList
              events={mineShown}
              showChat
              emptyMessage={
                search
                  ? "No registered events match your search."
                  : "You haven't hosted or joined an event yet — check Discover, or host one with + Host."
              }
            />
          </View>
        </>
      ) : (
        <>
          {/* Open LBL tournaments you can still register for */}
          {lblOpen.length > 0 && (
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 10 }}>
                <Text style={{ color: colors.accent, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 }}>LBL TOURNAMENTS</Text>
                <Pill tone="warning">open to register</Pill>
              </View>
              <View style={{ gap: 10 }}>
                {lblOpen.map((event) => (
                  <LblCard key={event.id} event={event} />
                ))}
              </View>
            </View>
          )}

          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 4 }}>
              Around you
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
              Open events hosted within 15 km — tap to view and join.
            </Text>
            <EventList
              events={nearbyShown}
              emptyMessage={
                search ? "No nearby events match your search." : "No open events hosted within 15 km of your center right now."
              }
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
