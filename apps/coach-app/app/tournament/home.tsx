import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Pill, PrimaryButton, SectionHeader, EmptyState, LoadingView, colors } from "@/components/ui";
import { tFetch, tournamentUser, clearTournamentSession, loadTournamentSession } from "@/lib/tournament-api";

interface OpenTournament {
  id: string;
  name: string;
  sports: string[];
  startDate: string;
  publicSlug: string;
  organizer: { name: string; organizationName: string | null };
  events: { id: string; name: string; kind: string; discipline: string; entryFee: string | null; _count: { entries: number } }[];
}

interface MyEntry {
  id: string;
  status: string;
  teamName: string | null;
  event: { name: string; entryFee: string | null; tournament: { name: string; publicSlug: string } };
}

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  confirmed: "success",
  awaiting_payment: "warning",
  pending: "warning",
  waitlisted: "neutral",
  rejected: "danger",
  withdrawn: "neutral",
};

export default function TournamentHome() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<OpenTournament[]>([]);
  const [entries, setEntries] = useState<MyEntry[]>([]);
  const [mine, setMine] = useState<{ tournaments: { id: string; name: string; status: string; events: unknown[] }[]; stats: { active: number; registrations: number; collected: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyEntry, setBusyEntry] = useState<string | null>(null);
  const user = tournamentUser();

  const load = useCallback(async () => {
    try {
      setError(null);
      const session = user ?? (await loadTournamentSession());
      if (!session) {
        router.replace("/tournament/login");
        return;
      }
      const [openRes, entriesRes] = await Promise.all([
        tFetch<OpenTournament[]>("/tournaments/open"),
        tFetch<MyEntry[]>("/tournaments/my-entries"),
      ]);
      setOpen(openRes);
      setEntries(entriesRes);
      if (session.role === "organizer") {
        setMine(await tFetch("/tournaments/mine"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tournaments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function registerFor(eventId: string) {
    setBusyEntry(eventId);
    try {
      await tFetch(`/tournaments/events/${eventId}/register`, {
        method: "POST",
        body: JSON.stringify({ players: [{ name: user?.name ?? "Player" }] }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusyEntry(null);
    }
  }

  async function payFor(entryId: string) {
    setBusyEntry(entryId);
    try {
      await tFetch(`/tournaments/entries/${entryId}/pay`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setBusyEntry(null);
    }
  }

  if (loading) return <LoadingView />;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>Tournaments</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {user?.name} · {user?.role === "organizer" ? "Organizer" : user?.role === "official" ? "Official" : "Player"}
          </Text>
        </View>
        <Pressable
          onPress={async () => {
            await clearTournamentSession();
            router.replace("/tournament/login");
          }}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

      {user?.role === "organizer" && (
        <>
          {mine && (
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Active", value: mine.stats.active },
                { label: "Entries", value: mine.stats.registrations },
                { label: "Collected", value: `₹${mine.stats.collected}` },
              ].map((s) => (
                <Card key={s.label} style={{ flex: 1, alignItems: "center", paddingVertical: 14 }}>
                  <Text style={{ color: colors.accent, fontSize: 18, fontWeight: "800" }}>{s.value}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{s.label}</Text>
                </Card>
              ))}
            </View>
          )}
          <PrimaryButton title="+ Create Tournament" onPress={() => router.push("/tournament/new")} />
          <View style={{ height: 20 }} />
          <SectionHeader title="My Tournaments" />
          {mine?.tournaments.length === 0 && <EmptyState message="No tournaments yet — create your first one." />}
          {mine?.tournaments.map((t) => (
            <Pressable key={t.id} onPress={() => router.push(`/tournament/${t.id}`)}>
              <Card style={{ marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{t.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t.events.length} events</Text>
                </View>
                <Pill tone={t.status === "draft" ? "neutral" : t.status === "completed" ? "neutral" : "success"}>
                  {t.status.replace("_", " ")}
                </Pill>
              </Card>
            </Pressable>
          ))}
          <View style={{ height: 20 }} />
        </>
      )}

      {entries.length > 0 && (
        <>
          <SectionHeader title="My Entries" />
          {entries.map((e) => (
            <Card key={e.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{e.event.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{e.event.tournament.name}</Text>
                </View>
                <Pill tone={STATUS_TONE[e.status] ?? "neutral"}>{e.status.replace("_", " ")}</Pill>
              </View>
              {e.status === "awaiting_payment" && (
                <View style={{ marginTop: 10 }}>
                  <PrimaryButton
                    title={busyEntry === e.id ? "Processing…" : `Pay Entry Fee ₹${e.event.entryFee ?? 0}`}
                    onPress={() => payFor(e.id)}
                    disabled={busyEntry === e.id}
                  />
                </View>
              )}
            </Card>
          ))}
          <View style={{ height: 12 }} />
        </>
      )}

      <SectionHeader title="Open for Registration" />
      {open.length === 0 && <EmptyState message="No tournaments open right now — check back soon." />}
      {open.map((t) => (
        <Card key={t.id} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 15 }}>{t.name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
            {t.organizer.organizationName ?? t.organizer.name} · {new Date(t.startDate).toLocaleDateString()} ·{" "}
            {t.sports.join(", ")}
          </Text>
          {t.events.map((ev) => {
            const already = entries.some((en) => en.event.name === ev.name && en.event.tournament.name === t.name && en.status !== "withdrawn" && en.status !== "rejected");
            return (
              <View
                key={ev.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255,255,255,0.06)",
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>{ev.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {ev.kind} · {ev.discipline} · {ev._count.entries} entered
                    {ev.entryFee ? ` · ₹${ev.entryFee}` : " · free"}
                  </Text>
                </View>
                {user?.role !== "official" && (
                  <Pressable
                    onPress={() => registerFor(ev.id)}
                    disabled={already || busyEntry === ev.id}
                    style={{
                      backgroundColor: already ? "rgba(255,255,255,0.08)" : colors.accent,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: already ? colors.textMuted : colors.accentText, fontSize: 12, fontWeight: "700" }}>
                      {already ? "Entered" : busyEntry === ev.id ? "…" : "Register"}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>
      ))}
    </ScrollView>
  );
}
