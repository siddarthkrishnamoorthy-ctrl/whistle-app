import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useChildren } from "@/lib/children-context";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import ScrabbleBoard, { PendingTile } from "@/components/scrabble-board";

interface Game {
  id: string;
  status: string;
  winner: string | null;
  termination: string | null;
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  board: string[];
  blanks: number[];
  scoreA: number;
  scoreB: number;
  toMove: "a" | "b";
  myTurn: boolean;
  myRack: string[];
  oppRackCount: number;
  bagCount: number;
  matchType: string;
}

// Live Scrabble game — polls while active so the opponent's plays appear within
// a couple of seconds. One board surface reused everywhere (Scrabble §5.7).
export default function ScrabbleGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { selectedChild } = useChildren();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingTile[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    if (!gameId || !selectedChild) return;
    apiJson<Game>(`/scrabble/games/${gameId}?clientId=${selectedChild.id}`)
      .then(setGame)
      .catch(() => setGame(null))
      .finally(() => setLoading(false));
  }, [gameId, selectedChild]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 2500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  if (loading) return <LoadingView />;
  if (!game || !selectedChild) return <EmptyState message="Game not found." />;

  const iAmA = game.playerAId === selectedChild.id;
  const myScore = iAmA ? game.scoreA : game.scoreB;
  const oppScore = iAmA ? game.scoreB : game.scoreA;
  const oppName = iAmA ? game.playerBName : game.playerAName;
  const myName = iAmA ? game.playerAName : game.playerBName;
  const iWon = game.winner && ((game.winner === "a") === iAmA);

  const banner =
    game.status === "active"
      ? game.myTurn
        ? "Your move — place a word through the board."
        : `Waiting for ${oppName}…`
      : game.status === "completed"
        ? game.winner === "draw"
          ? "Game over — it's a draw!"
          : `Game over — ${iWon ? "you win! 🏆" : `${oppName} wins`}`
        : game.status === "resigned"
          ? `${iWon ? oppName : "You"} resigned — ${iWon ? "you win" : `${oppName} wins`}`
          : "Game over";

  async function submitMove(body: object, clearPending = true) {
    if (!game) return;
    setBusy(true);
    try {
      const updated = await apiJson<Game>(`/scrabble/games/${game.id}/moves`, {
        method: "POST",
        body: JSON.stringify({ playerId: selectedChild!.id, ...body }),
      });
      setGame(updated);
      if (clearPending) setPending([]);
    } catch (e) {
      Alert.alert("Not a legal move", e instanceof Error ? e.message : "Try another word.");
    } finally {
      setBusy(false);
    }
  }

  const play = () => {
    if (pending.length === 0) {
      Alert.alert("No tiles placed", "Tap a rack tile, then tap a board square to place it.");
      return;
    }
    const placements = pending.map((p) => ({ letter: p.letter, row: Math.floor(p.index / 15), col: p.index % 15, blank: p.blank }));
    submitMove({ type: "place", placements });
  };

  const pass = () =>
    Alert.alert("Pass your turn?", "You'll score nothing this turn.", [
      { text: "Keep playing", style: "cancel" },
      { text: "Pass", onPress: () => submitMove({ type: "pass" }) },
    ]);

  const exchange = () => {
    if (game!.myRack.length === 0) return;
    Alert.alert("Swap all your tiles?", "You'll draw a fresh rack and lose your turn.", [
      { text: "Cancel", style: "cancel" },
      { text: "Swap all", onPress: () => submitMove({ type: "exchange", tiles: game!.myRack }) },
    ]);
  };

  const resign = () =>
    Alert.alert("Resign?", "Your opponent wins the game.", [
      { text: "Keep playing", style: "cancel" },
      {
        text: "Resign",
        style: "destructive",
        onPress: async () => {
          try {
            const updated = await apiJson<Game>(`/scrabble/games/${game!.id}/resign`, {
              method: "POST",
              body: JSON.stringify({ playerId: selectedChild!.id }),
            });
            setGame(updated);
          } catch {
            /* refreshed by polling */
          }
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[
          { name: myName, score: myScore, live: game.myTurn, you: true },
          { name: oppName, score: oppScore, live: game.status === "active" && !game.myTurn, you: false },
        ].map((p, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: p.live ? colors.accent : colors.border,
              backgroundColor: p.live ? colors.accent + "1A" : colors.surface,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
              {p.you ? "You" : p.name}
            </Text>
            <Text style={{ color: p.live ? colors.accent : colors.textPrimary, fontSize: 24, fontWeight: "800" }}>{p.score}</Text>
          </View>
        ))}
      </View>

      <Card style={{ borderColor: game.myTurn ? "rgba(245,185,63,0.5)" : undefined, borderWidth: game.myTurn ? 1 : undefined }}>
        <Text
          style={{
            color: game.status === "active" ? (game.myTurn ? colors.accent : colors.textSecondary) : colors.accent,
            fontWeight: "700",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {banner}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 4 }}>
          🎒 {game.bagCount} tiles left · opponent holds {game.oppRackCount}
        </Text>
      </Card>

      <ScrabbleBoard
        board={game.board}
        blanks={game.blanks}
        rack={game.myRack}
        canPlay={game.myTurn && game.status === "active"}
        pending={pending}
        onChange={setPending}
      />

      {game.status === "active" && game.myTurn && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              disabled={busy}
              onPress={play}
              style={{ flex: 2, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 11, alignItems: "center" }}
            >
              <Text style={{ color: colors.accentText, fontWeight: "800" }}>{busy ? "Playing…" : "▶ Play word"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={busy || pending.length === 0}
              onPress={() => setPending([])}
              style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 11, alignItems: "center", opacity: pending.length === 0 ? 0.5 : 1 }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>Recall</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity disabled={busy} onPress={pass} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>Pass</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={exchange} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>Swap tiles</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {game.status === "active" && (game.playerAId === selectedChild.id || game.playerBId === selectedChild.id) && (
        <TouchableOpacity onPress={resign} style={{ alignSelf: "center", paddingVertical: 6, paddingHorizontal: 16 }}>
          <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "600" }}>🏳 Resign</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
