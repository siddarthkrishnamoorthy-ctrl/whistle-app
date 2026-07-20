import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import ScrabbleBoard, { PendingTile } from "@/components/scrabble-board";

interface Puzzle {
  id: string;
  board: string[];
  rack: string[];
  theme: string;
  rating: number;
  bestScore: number;
}
interface AttemptResult {
  valid: boolean;
  solved?: boolean;
  error?: string;
  yourScore?: number;
  yourWords?: string[];
  bestScore: number;
  bestWord: string;
  quality?: number;
}

const THEME_LABEL: Record<string, string> = {
  highest_score: "Highest score",
  bingo_hunt: "Bingo hunt (use all 7)",
  short_words: "Short words",
  bonus_square: "Bonus squares",
};

// Word puzzle (Scrabble §5.2): find the best-scoring word from the given rack.
export default function ScrabblePuzzleScreen() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingTile[]>([]);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((exclude?: string) => {
    setLoading(true);
    setResult(null);
    setPending([]);
    apiJson<Puzzle>(`/scrabble/puzzles/next${exclude ? `?exclude=${exclude}` : ""}`)
      .then(setPuzzle)
      .catch(() => setPuzzle(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingView />;
  if (!puzzle) return <EmptyState message="No puzzles available yet." />;

  async function submit() {
    if (!puzzle || pending.length === 0) return;
    setBusy(true);
    try {
      const placements = pending.map((p) => ({ letter: p.letter, row: Math.floor(p.index / 15), col: p.index % 15, blank: p.blank }));
      const res = await apiJson<AttemptResult>(`/scrabble/puzzles/${puzzle.id}/attempt`, {
        method: "POST",
        body: JSON.stringify({ placements }),
      });
      setResult(res);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>🧩 Word Puzzle</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{THEME_LABEL[puzzle.theme] ?? puzzle.theme}</Text>
        </View>
        <Pill tone="info">{`target ${puzzle.bestScore}`}</Pill>
      </View>

      <Card>
        <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>
          Place the highest-scoring word you can find through the centre star.
        </Text>
      </Card>

      <ScrabbleBoard board={puzzle.board} blanks={[]} rack={puzzle.rack} canPlay={!result} pending={pending} onChange={setPending} />

      {!result ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity disabled={busy || pending.length === 0} onPress={submit} style={{ flex: 2, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 11, alignItems: "center", opacity: pending.length === 0 ? 0.5 : 1 }}>
            <Text style={{ color: colors.accentText, fontWeight: "800" }}>{busy ? "Checking…" : "✓ Submit word"}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={pending.length === 0} onPress={() => setPending([])} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 11, alignItems: "center", opacity: pending.length === 0 ? 0.5 : 1 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Card style={{ borderColor: result.solved ? colors.accent : colors.border, borderWidth: 1, gap: 6 }}>
          {!result.valid ? (
            <Text style={{ color: colors.danger, fontWeight: "700", textAlign: "center" }}>Not a legal word — {result.error}</Text>
          ) : result.solved ? (
            <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 16, textAlign: "center" }}>🌟 Optimal! {result.yourScore} points</Text>
          ) : (
            <Text style={{ color: colors.textPrimary, fontWeight: "700", textAlign: "center" }}>
              {result.yourWords?.join(", ")} scored {result.yourScore} ({result.quality}% of best)
            </Text>
          )}
          <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>
            Best play: {result.bestWord} for {result.bestScore}
          </Text>
          <TouchableOpacity onPress={() => load(puzzle.id)} style={{ marginTop: 4, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: colors.accentText, fontWeight: "800" }}>Next puzzle →</Text>
          </TouchableOpacity>
        </Card>
      )}
    </ScrollView>
  );
}
