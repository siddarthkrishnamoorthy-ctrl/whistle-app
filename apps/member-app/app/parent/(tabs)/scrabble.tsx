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
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  status: string;
  winner: string | null;
  scoreA: number;
  scoreB: number;
  myTurn: boolean;
}

// Scrabble Arena (Scrabble Module §5): individual play (vs-computer, puzzles,
// Word Power), and social play (friends at your center, invite other centers).
export default function ScrabbleArenaScreen() {
  const { selectedChild, loading } = useChildren();
  const [opponents, setOpponents] = useState<{ sameCenter: OpponentRef[]; otherCenters: OpponentRef[] }>({ sameCenter: [], otherCenters: [] });
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [busy, setBusy] = useState(false);
  const [showAllOther, setShowAllOther] = useState(false);
  const [matchType, setMatchType] = useState("async");
  const [seeking, setSeeking] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    apiJson<typeof opponents>(`/scrabble/opponents?clientId=${selectedChild.id}`).then(setOpponents).catch(() => undefined);
    apiJson<Challenge[]>(`/scrabble/challenges?clientId=${selectedChild.id}`).then(setChallenges).catch(() => setChallenges([]));
    apiJson<Game[]>(`/scrabble/games?clientId=${selectedChild.id}`).then(setGames).catch(() => setGames([]));
  }, [selectedChild]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingView />;
  if (!selectedChild) return <EmptyState message="Link your player first — Scrabble games belong to your child." />;

  async function play(opponentClientId: string) {
    setBusy(true);
    try {
      const res = await apiJson<{ game?: { id: string } | null }>("/scrabble/challenges", {
        method: "POST",
        body: JSON.stringify({ clientId: selectedChild!.id, opponentClientId, matchType }),
      });
      if (res.game?.id) router.push(`/parent/scrabble/${res.game.id}`);
      else Alert.alert("Invitation sent", "The game starts as soon as they accept.");
      load();
    } catch (e) {
      Alert.alert("Couldn't start", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function playBot(level: number) {
    setBusy(true);
    try {
      const game = await apiJson<{ id: string }>("/scrabble/games/vs-computer", {
        method: "POST",
        body: JSON.stringify({ clientId: selectedChild!.id, level, matchType }),
      });
      router.push(`/parent/scrabble/${game.id}`);
    } catch (e) {
      Alert.alert("Couldn't start", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Community open-seek (§5.5): post a seek, then poll until someone joins.
  async function findCommunityGame() {
    setSeeking(true);
    try {
      const res = await apiJson<{ matched: boolean; game?: { id: string } }>("/scrabble/community/seek", {
        method: "POST",
        body: JSON.stringify({ clientId: selectedChild!.id, matchType }),
      });
      if (res.matched && res.game?.id) {
        setSeeking(false);
        router.push(`/parent/scrabble/${res.game.id}`);
        return;
      }
      // Poll for a match; the effect below stops when the component unfocuses.
      const poll = setInterval(async () => {
        const st = await apiJson<{ matched: boolean; game?: { id: string } }>(`/scrabble/community/seek?clientId=${selectedChild!.id}`).catch(() => null);
        if (st?.matched && st.game?.id) {
          clearInterval(poll);
          setSeeking(false);
          router.push(`/parent/scrabble/${st.game.id}`);
        }
      }, 2500);
      // Stop polling after 60s if nobody joins.
      setTimeout(() => clearInterval(poll), 60000);
    } catch (e) {
      setSeeking(false);
      Alert.alert("Couldn't find a game", e instanceof Error ? e.message : "Please try again.");
    }
  }

  async function cancelSeek() {
    setSeeking(false);
    await apiJson("/scrabble/community/seek/cancel", { method: "POST", body: JSON.stringify({ clientId: selectedChild!.id }) }).catch(() => undefined);
  }

  async function respond(challengeId: string, accept: boolean) {
    try {
      const res = await apiJson<{ game?: { id: string } }>(`/scrabble/challenges/${challengeId}/respond`, {
        method: "POST",
        body: JSON.stringify({ clientId: selectedChild!.id, accept }),
      });
      if (accept && res.game?.id) router.push(`/parent/scrabble/${res.game.id}`);
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
    const iAmA = g.playerAId === selectedChild!.id;
    const myScore = iAmA ? g.scoreA : g.scoreB;
    const oppScore = iAmA ? g.scoreB : g.scoreA;
    const oppName = iAmA ? g.playerBName : g.playerAName;
    const result = g.status === "active" ? null : g.winner === "draw" ? "Draw" : (g.winner === "a") === iAmA ? "You won 🎉" : "They won";
    return (
      <TouchableOpacity key={g.id} onPress={() => router.push(`/parent/scrabble/${g.id}`)} activeOpacity={0.75}>
        <Card style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>vs {oppName}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {myScore}–{oppScore}
                {g.status === "active" ? (g.myTurn ? " · your move" : " · their move") : result ? ` · ${result}` : ""}
              </Text>
            </View>
            <Pill tone={g.status === "active" ? (g.myTurn ? "warning" : "info") : "neutral"}>
              {g.status === "active" ? (g.myTurn ? "your turn" : "live") : "over"}
            </Pill>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>🔤 Scrabble Arena</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{selectedChild.name} plays here</Text>
      </View>

      {/* Match type — applies to new computer games and challenges */}
      <View>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 }}>MATCH TYPE</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {[
            { key: "async", label: "Open / Async" },
            { key: "timed_blitz", label: "Blitz" },
            { key: "timed_standard", label: "Standard" },
          ].map((m) => {
            const activeSel = m.key === matchType;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMatchType(m.key)}
                style={{
                  borderWidth: 1,
                  borderColor: activeSel ? colors.accent : colors.border,
                  backgroundColor: activeSel ? colors.accent + "22" : colors.surface,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: activeSel ? colors.accent : colors.textSecondary, fontSize: 12, fontWeight: activeSel ? "800" : "600" }}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Solo practice */}
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>Practice solo</Text>
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>🤖 Play the computer (casual — no rating)</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { level: 1, label: "Beginner" },
              { level: 2, label: "Club" },
              { level: 3, label: "Strong" },
            ].map((b) => (
              <TouchableOpacity key={b.level} disabled={busy} onPress={() => playBot(b.level)} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}>
                <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 13 }}>{b.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TouchableOpacity onPress={() => router.push("/parent/scrabble/puzzle")} style={{ flex: 1, borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}>
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>🧩 Puzzle</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/parent/scrabble/word-power")} style={{ flex: 1, borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}>
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>📚 Word Power</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/parent/scrabble/word-rush")} style={{ flex: 1, borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}>
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>⚡ Rush</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>

      {/* Community — find an open game with any Whistle student (§5.5) */}
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>Community</Text>
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
            🌐 Get matched with any student looking for a game — safe, verified players only.
          </Text>
          {seeking ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "700", textAlign: "center" }}>Searching for an opponent…</Text>
              <TouchableOpacity onPress={cancelSeek} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 10, alignItems: "center" }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={findCommunityGame} style={{ backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ color: colors.accentText, fontWeight: "800", fontSize: 13 }}>🔎 Find an open game</Text>
            </TouchableOpacity>
          )}
        </Card>
      </View>

      {incoming.length > 0 && (
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>Invitations for you</Text>
          {incoming.map((c) => (
            <Card key={c.id} style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{c.challengerName} wants to play</Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <TouchableOpacity onPress={() => respond(c.id, true)} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}>
                  <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 13 }}>Accept & play</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => respond(c.id, false)} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}>
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
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>Same-center friends — the game starts straight away</Text>
        {opponents.sameCenter.length === 0 ? (
          <EmptyState message="No other students at your center yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {opponents.sameCenter.slice(0, 8).map((o) => (
              <Card key={o.id}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "600", flex: 1 }}>{o.name}</Text>
                  <TouchableOpacity disabled={busy} onPress={() => play(o.id)} style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
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
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>They get an invitation — the game starts when they accept</Text>
        {opponents.otherCenters.length === 0 ? (
          <EmptyState message="No students at other centers yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {otherShown.map((o) => (
              <Card key={o.id}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{o.name}</Text>
                    {o.center?.name ? <Text style={{ color: colors.textMuted, fontSize: 11 }}>📍 {o.center.name}</Text> : null}
                  </View>
                  <TouchableOpacity disabled={busy} onPress={() => play(o.id)} style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
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
