import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useChildren } from "@/lib/children-context";
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

// Live game screen — polls while active so the opponent's moves appear
// within a couple of seconds (one chess surface reused everywhere, BRD 5.7).
export default function ChessGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { selectedChild } = useChildren();
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
  const myChildPlays = selectedChild && (game.whiteId === selectedChild.id || game.blackId === selectedChild.id);
  const myTurn = Boolean(selectedChild && turnId === selectedChild.id && game.status === "active");
  const iAmBlack = selectedChild?.id === game.blackId;
  const turnName = turn === "w" ? game.whiteName : game.blackName;

  const banner =
    game.status === "active"
      ? myTurn
        ? "Your move!"
        : `Waiting for ${turnName}…`
      : game.status === "checkmate"
        ? `Checkmate — ${game.winner === "white" ? game.whiteName : game.blackName} wins! 🏆`
        : game.status === "resigned"
          ? `${game.winner === "white" ? game.blackName : game.whiteName} resigned — ${game.winner === "white" ? game.whiteName : game.blackName} wins`
          : game.status === "stalemate"
            ? "Stalemate — draw"
            : "Draw";

  async function move(from: string, to: string) {
    try {
      const updated = await apiJson<Game>(`/chess/games/${game!.id}/move`, {
        method: "POST",
        body: JSON.stringify({ playerId: selectedChild!.id, from, to }),
      });
      setGame(updated);
    } catch (e) {
      Alert.alert("Invalid move", e instanceof Error ? e.message : "Try another move.");
    }
  }

  async function resign() {
    Alert.alert("Resign?", "Your opponent wins the game.", [
      { text: "Keep playing", style: "cancel" },
      {
        text: "Resign",
        style: "destructive",
        onPress: async () => {
          try {
            const updated = await apiJson<Game>(`/chess/games/${game!.id}/resign`, {
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
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>
            ♔ {game.whiteName} vs ♚ {game.blackName}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
            Move {game.moves.length + 1} · {turn === "w" ? "White" : "Black"} to play
          </Text>
        </View>
        <Pill tone={game.status === "active" ? (myTurn ? "warning" : "info") : "success"}>
          {game.status === "active" ? (myTurn ? "your move" : "live") : "over"}
        </Pill>
      </View>

      <Card
        style={{
          borderColor: myTurn ? "rgba(245,185,63,0.5)" : undefined,
          borderWidth: myTurn ? 1 : undefined,
        }}
      >
        <Text
          style={{
            color: game.status === "active" ? (myTurn ? colors.accent : colors.textSecondary) : colors.accent,
            fontWeight: "700",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {banner}
        </Text>
      </Card>

      <ChessBoard fen={game.fen} canMove={myTurn} flipped={iAmBlack} getTargets={async (from) => {
        const res = await apiJson<{ targets: string[] }>(`/chess/games/${game.id}/legal-moves?from=${from}`);
        return res.targets;
      }} onMove={move} />

      {myChildPlays && game.status === "active" && (
        <TouchableOpacity onPress={resign} style={{ alignSelf: "center", paddingVertical: 6, paddingHorizontal: 16 }}>
          <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "600" }}>🏳 Resign</Text>
        </TouchableOpacity>
      )}

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
