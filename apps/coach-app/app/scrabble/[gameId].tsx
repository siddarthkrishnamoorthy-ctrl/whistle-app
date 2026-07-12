import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, colors } from "@/components/ui";
import ScrabbleBoard, { PendingTile } from "@/components/scrabble-board";

interface Game {
  id: string;
  status: string;
  winner: string | null;
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  board: string[];
  blanks: number[];
  scoreA: number;
  scoreB: number;
  toMove: "a" | "b";
  myRack: string[];
  bagCount: number;
}

// Coach-hosted Scrabble fixture board (Scrabble §5.7): the coach facilitates an
// in-person match, entering each side's play in turn. Fetches the side-to-move's
// rack so the coach can place their tiles, then hands over automatically.
export default function CoachScrabbleGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingTile[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!gameId) return;
    try {
      // First read (spectator) tells us whose turn it is; the second reveals
      // that side's rack so the coach can place their tiles.
      const spec = await apiJson<Game>(`/scrabble/games/${gameId}`);
      const actingId = spec.toMove === "a" ? spec.playerAId : spec.playerBId;
      const full = await apiJson<Game>(`/scrabble/games/${gameId}?clientId=${actingId}`);
      setGame(full);
    } catch {
      setGame(null);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  if (loading) return <LoadingView />;
  if (!game) return <EmptyState message="Game not found." />;

  const actingId = game.toMove === "a" ? game.playerAId : game.playerBId;
  const actingName = game.toMove === "a" ? game.playerAName : game.playerBName;
  const over = game.status !== "active";

  async function submitMove(body: object) {
    if (!game) return;
    setBusy(true);
    try {
      await apiJson<Game>(`/scrabble/games/${game.id}/moves`, {
        method: "POST",
        body: JSON.stringify({ playerId: actingId, ...body }),
      });
      setPending([]);
      await load();
    } catch (e) {
      Alert.alert("Not a legal move", e instanceof Error ? e.message : "Try another word.");
    } finally {
      setBusy(false);
    }
  }

  const play = () => {
    if (pending.length === 0) {
      Alert.alert("No tiles placed", "Tap a rack tile, then a board square.");
      return;
    }
    submitMove({ type: "place", placements: pending.map((p) => ({ letter: p.letter, row: Math.floor(p.index / 15), col: p.index % 15, blank: p.blank })) });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[
          { name: game.playerAName, score: game.scoreA, live: game.toMove === "a" && !over },
          { name: game.playerBName, score: game.scoreB, live: game.toMove === "b" && !over },
        ].map((p, i) => (
          <View key={i} style={{ flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: p.live ? colors.accent : colors.border, backgroundColor: p.live ? colors.accent + "1A" : colors.surface }}>
            <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>{p.name}</Text>
            <Text style={{ color: p.live ? colors.accent : colors.textPrimary, fontSize: 24, fontWeight: "800" }}>{p.score}</Text>
          </View>
        ))}
      </View>

      <Card>
        <Text style={{ color: over ? colors.accent : colors.textSecondary, fontWeight: "700", fontSize: 13, textAlign: "center" }}>
          {over
            ? game.winner === "draw"
              ? "Game over — draw"
              : `Game over — ${game.winner === "a" ? game.playerAName : game.playerBName} wins 🏆`
            : `${actingName} to play — enter their word`}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 4 }}>🎒 {game.bagCount} tiles left</Text>
      </Card>

      <ScrabbleBoard board={game.board} blanks={game.blanks} rack={game.myRack} canPlay={!over} pending={pending} onChange={setPending} />

      {!over && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity disabled={busy} onPress={play} style={{ flex: 2, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 11, alignItems: "center" }}>
              <Text style={{ color: colors.accentText, fontWeight: "800" }}>{busy ? "Playing…" : "▶ Play word"}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy || pending.length === 0} onPress={() => setPending([])} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 11, alignItems: "center", opacity: pending.length === 0 ? 0.5 : 1 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>Recall</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity disabled={busy} onPress={() => submitMove({ type: "pass" })} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 9, alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>Pass this turn</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
