import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useChildren } from "@/lib/children-context";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";

interface OpponentRef {
  id: string;
  name: string;
  center?: { name: string } | null;
}

interface Challenge {
  id: string;
  status: string;
  incoming: boolean;
  challengerName: string;
  opponentName: string;
}

interface Game {
  id: string;
  whiteId: string;
  blackId: string;
  whiteName: string;
  blackName: string;
  status: string;
  winner: string | null;
  fen: string;
}

// Chess Arena (Chess Module BRD 5.4/5.5): same-center students play each
// other directly; a student from another center gets an invitation and the
// game starts once they accept.
export default function ChessArenaScreen() {
  const { selectedChild, loading } = useChildren();
  const [opponents, setOpponents] = useState<{ sameCenter: OpponentRef[]; otherCenters: OpponentRef[] }>({ sameCenter: [], otherCenters: [] });
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [busy, setBusy] = useState(false);
  const [showAllOther, setShowAllOther] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    apiJson<typeof opponents>(`/chess/opponents?clientId=${selectedChild.id}`).then(setOpponents).catch(() => undefined);
    apiJson<Challenge[]>(`/chess/challenges?clientId=${selectedChild.id}`).then(setChallenges).catch(() => setChallenges([]));
    apiJson<Game[]>(`/chess/games?clientId=${selectedChild.id}`).then(setGames).catch(() => setGames([]));
  }, [selectedChild]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingView />;
  if (!selectedChild) return <EmptyState message="Link your player first — chess games belong to your child." />;

  async function play(opponentClientId: string) {
    setBusy(true);
    try {
      const res = await apiJson<{ game?: { id: string } | null; challenge: { status: string } }>("/chess/challenges", {
        method: "POST",
        body: JSON.stringify({ clientId: selectedChild!.id, opponentClientId }),
      });
      if (res.game?.id) router.push(`/chess/${res.game.id}`);
      else Alert.alert("Invitation sent", "The game starts as soon as they accept.");
      load();
    } catch (e) {
      Alert.alert("Couldn't start", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function respond(challengeId: string, accept: boolean) {
    try {
      const res = await apiJson<{ game?: { id: string } }>(`/chess/challenges/${challengeId}/respond`, {
        method: "POST",
        body: JSON.stringify({ clientId: selectedChild!.id, accept }),
      });
      if (accept && res.game?.id) router.push(`/chess/${res.game.id}`);
      load();
    } catch (e) {
      Alert.alert("Couldn't respond", e instanceof Error ? e.message : "Please try again.");
    }
  }

  const active = games.filter((g) => g.status === "active");
  const finished = games.filter((g) => g.status !== "active").slice(0, 5);
  const incoming = challenges.filter((c) => c.incoming);
  const outgoing = challenges.filter((c) => !c.incoming);
  const otherShown = showAllOther ? opponents.otherCenters : opponents.otherCenters.slice(0, 6);

  const gameRow = (g: Game) => {
    const iAmWhite = g.whiteId === selectedChild!.id;
    const result =
      g.status === "active"
        ? null
        : g.winner === "draw"
          ? "Draw"
          : (g.winner === "white") === iAmWhite
            ? "You won 🎉"
            : "They won";
    return (
      <TouchableOpacity key={g.id} onPress={() => router.push(`/chess/${g.id}`)} activeOpacity={0.75}>
        <Card style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                ♔ {g.whiteName} vs ♚ {g.blackName}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {g.status === "active" ? "Game in progress — tap to play" : `${g.status}${result ? ` · ${result}` : ""}`}
              </Text>
            </View>
            <Pill tone={g.status === "active" ? "warning" : "neutral"}>{g.status === "active" ? "live" : "over"}</Pill>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>♟️ Chess Arena</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{selectedChild.name} plays here</Text>
      </View>

      {incoming.length > 0 && (
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
            Invitations for you
          </Text>
          {incoming.map((c) => (
            <Card key={c.id} style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{c.challengerName} wants to play</Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => respond(c.id, true)}
                  style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}
                >
                  <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 13 }}>Accept & play</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => respond(c.id, false)}
                  style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 13 }}>Decline</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      )}

      {active.length > 0 && (
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>Your games</Text>
          {active.map(gameRow)}
        </View>
      )}

      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>Play at your center</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>
          Same-center friends — the game starts straight away
        </Text>
        {opponents.sameCenter.length === 0 ? (
          <EmptyState message="No other students at your center yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {opponents.sameCenter.slice(0, 8).map((o) => (
              <Card key={o.id}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "600", flex: 1 }}>{o.name}</Text>
                  <TouchableOpacity
                    disabled={busy}
                    onPress={() => play(o.id)}
                    style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}
                  >
                    <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 12 }}>▶ Play</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>Challenge other centers</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>
          They get an invitation — the game starts when they accept
        </Text>
        {opponents.otherCenters.length === 0 ? (
          <EmptyState message="No students at other centers yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {otherShown.map((o) => (
              <Card key={o.id}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{o.name}</Text>
                    {o.center?.name ? (
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>📍 {o.center.name}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    disabled={busy}
                    onPress={() => play(o.id)}
                    style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Ionicons name="mail-outline" size={12} color={colors.accent} />
                    <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>Invite</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
            {opponents.otherCenters.length > 6 && (
              <TouchableOpacity onPress={() => setShowAllOther((v) => !v)}>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "600", textAlign: "center", paddingVertical: 4 }}>
                  {showAllOther ? "Show less" : `View all ${opponents.otherCenters.length}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {outgoing.length > 0 && (
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>Sent invitations</Text>
          {outgoing.map((c) => (
            <Card key={c.id} style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Waiting for <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{c.opponentName}</Text> to accept…
              </Text>
            </Card>
          ))}
        </View>
      )}

      {finished.length > 0 && (
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>Recent games</Text>
          {finished.map(gameRow)}
        </View>
      )}
    </ScrollView>
  );
}
