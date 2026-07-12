import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import ChessBoard from "@/components/chess-board";

// Tactics puzzles (Chess BRD 5.2). One position, one correct move. There's no
// chess engine on the device, so the board offers every square as a possible
// destination and the server validates the attempt against the solution.

interface Puzzle {
  id: string;
  fen: string;
  theme: string;
  rating: number;
  sideToMove: "white" | "black";
  moveCount: number;
}

const FILES = "abcdefgh";
const ALL_SQUARES = FILES.split("").flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`));

const THEME_LABEL: Record<string, string> = {
  mate_in_1: "Mate in 1",
  win_material: "Win material",
  fork: "Fork",
  pin: "Pin",
  hanging_piece: "Hanging piece",
};

export default function ChessPuzzleScreen() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<"idle" | "solved" | "wrong">("idle");
  const [solution, setSolution] = useState<string[] | null>(null);

  const load = useCallback((exclude?: string) => {
    setLoading(true);
    setOutcome("idle");
    setSolution(null);
    apiJson<Puzzle>(`/chess/puzzles/next${exclude ? `?exclude=${exclude}` : ""}`)
      .then(setPuzzle)
      .catch(() => setPuzzle(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function attempt(from: string, to: string) {
    if (!puzzle) return;
    try {
      const res = await apiJson<{ solved: boolean; solution: string[] }>(`/chess/puzzles/${puzzle.id}/solve`, {
        method: "POST",
        body: JSON.stringify({ moves: [{ from, to }] }),
      });
      setSolution(res.solution);
      setOutcome(res.solved ? "solved" : "wrong");
    } catch {
      setOutcome("wrong");
    }
  }

  if (loading) return <LoadingView />;
  if (!puzzle) return <EmptyState message="No puzzles available right now." />;

  const answer = solution?.[0];
  const answerPretty = answer ? `${answer.slice(0, 2)} → ${answer.slice(2, 4)}` : "";

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>🧩 Tactics puzzle</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {puzzle.sideToMove === "white" ? "White" : "Black"} to move · find the best move
          </Text>
        </View>
        <Pill tone="info">{THEME_LABEL[puzzle.theme] ?? puzzle.theme}</Pill>
      </View>

      <Card style={{ alignItems: "center" }}>
        <ChessBoard
          fen={puzzle.fen}
          canMove={outcome === "idle"}
          flipped={puzzle.sideToMove === "black"}
          // No on-device engine — offer every square; the server validates.
          getTargets={async (from) => ALL_SQUARES.filter((s) => s !== from)}
          onMove={attempt}
        />
      </Card>

      {outcome === "solved" && (
        <Card style={{ borderColor: colors.success }}>
          <Text style={{ color: colors.success, fontWeight: "800", fontSize: 16 }}>Solved! 🎉</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
            {answerPretty} was the winning move.
          </Text>
        </Card>
      )}
      {outcome === "wrong" && (
        <Card style={{ borderColor: colors.warning }}>
          <Text style={{ color: colors.warning, fontWeight: "800", fontSize: 16 }}>Not quite</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
            The winning move was {answerPretty}. Try the next one!
          </Text>
        </Card>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        {outcome !== "idle" && (
          <TouchableOpacity
            onPress={() => load(puzzle.id)}
            style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 11, alignItems: "center" }}
          >
            <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 14 }}>Next puzzle →</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flex: outcome === "idle" ? 1 : 0.5, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 11, alignItems: "center" }}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 14 }}>Back to Arena</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
