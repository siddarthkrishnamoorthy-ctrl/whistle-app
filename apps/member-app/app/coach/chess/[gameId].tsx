import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import ChessBoard, { fenTurn } from "@/components/chess-board";

interface Game {
  id: string;
  whiteId: string;
  blackId: string;
  whiteName: string;
  blackName: string;
  fen: string;
  status: string;
  winner: string | null;
  moves: { from: string; to: string }[];
}

// Coach view of a Match Center chess game — supervisor mode: the coach
// mirrors the over-the-board moves for whichever side is to play (the same
// scorer model as every other sport), or the students play on their own
// devices through the parent app. Results auto-complete the fixture.
export default function CoachChessGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    if (!gameId) return;
    apiJson<Game>(`/chess/games/${gameId}`)
      .then(setGame)
      .catch(() => setGame(null))
      .finally(() => setLoading(false));
  }, [gameId]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 2500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  if (loading) return <LoadingView />;
  if (!game) return <EmptyState message="Game not found." />;

  const turn = fenTurn(game.fen);
  const turnId = turn === "w" ? game.whiteId : game.blackId;
  const turnName = turn === "w" ? game.whiteName : game.blackName;

  const banner =
    game.status === "active"
      ? `${turnName} to move (${turn === "w" ? "White" : "Black"})`
      : game.status === "checkmate"
        ? `Checkmate — ${game.winner === "white" ? game.whiteName : game.blackName} wins! Result saved to the fixture.`
        : game.status === "resigned"
          ? `${game.winner === "white" ? game.whiteName : game.blackName} wins by resignation`
          : "Draw — result saved to the fixture.";

  async function move(from: string, to: string) {
    try {
      const updated = await apiJson<Game>(`/chess/games/${game!.id}/move`, {
        method: "POST",
        body: JSON.stringify({ playerId: turnId, from, to }),
      });
      setGame(updated);
    } catch (e) {
      Alert.alert("Invalid move", e instanceof Error ? e.message : "Try another move.");
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>
            ♔ {game.whiteName} vs ♚ {game.blackName}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
            Move {game.moves.length + 1} · supervisor board — enter each side's move
          </Text>
        </View>
        <Pill tone={game.status === "active" ? "warning" : "success"}>{game.status === "active" ? "live" : "over"}</Pill>
      </View>

      <Card>
        <Text style={{ color: game.status === "active" ? colors.textSecondary : colors.accent, fontWeight: "700", fontSize: 14, textAlign: "center" }}>
          {banner}
        </Text>
      </Card>

      <ChessBoard
        fen={game.fen}
        canMove={game.status === "active"}
        getTargets={async (from) => {
          const res = await apiJson<{ targets: string[] }>(`/chess/games/${game.id}/legal-moves?from=${from}`);
          return res.targets;
        }}
        onMove={move}
      />

      {game.moves.length > 0 && (
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 6 }}>MOVES</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
            {game.moves.map((m, i) => `${i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}${m.from}${m.to}`).join("  ")}
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}
