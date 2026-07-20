import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useChildren } from "@/lib/children-context";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";

interface WordList {
  id: string;
  title: string;
  description: string | null;
  wordCount: number;
}
interface DueWord {
  wordEntryId: string;
  word: string;
  definition: string;
  example: string | null;
  box: number;
}
interface DueResp {
  dueCount: number;
  total: number;
  words: DueWord[];
}

// Word Power tests (Scrabble §5.3): spaced-repetition vocabulary drills — the
// word-game analogue of Chess Tests. A "test" is simply every word due today.
export default function WordPowerScreen() {
  const { selectedChild } = useChildren();
  const [lists, setLists] = useState<WordList[]>([]);
  const [due, setDue] = useState<DueResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    Promise.all([
      apiJson<WordList[]>("/scrabble/word-lists").catch(() => []),
      apiJson<DueResp>(`/scrabble/tests/due?clientId=${selectedChild.id}`).catch(() => ({ dueCount: 0, total: 0, words: [] })),
    ])
      .then(([l, d]) => {
        setLists(l);
        setDue(d);
      })
      .finally(() => setLoading(false));
  }, [selectedChild]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingView />;
  if (!selectedChild) return <EmptyState message="Link your player first." />;

  async function startList(listId: string) {
    setBusy(true);
    try {
      await apiJson(`/scrabble/tests/start`, { method: "POST", body: JSON.stringify({ clientId: selectedChild!.id, listId }) });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function answer(correct: boolean) {
    if (!due?.words[0]) return;
    setBusy(true);
    try {
      await apiJson(`/scrabble/tests/${due.words[0].wordEntryId}/answer`, {
        method: "POST",
        body: JSON.stringify({ clientId: selectedChild!.id, correct }),
      });
      setReveal(false);
      // Optimistically drop the answered word; refresh in the background.
      setDue((d) => (d ? { ...d, dueCount: Math.max(0, d.dueCount - 1), words: d.words.slice(1) } : d));
      load();
    } finally {
      setBusy(false);
    }
  }

  const current = due?.words[0];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>📚 Word Power</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Build vocabulary with spaced repetition — {selectedChild.name} keeps words that are due.
        </Text>
      </View>

      {/* Active review session */}
      {current ? (
        <Card style={{ gap: 12, borderColor: colors.accent + "55", borderWidth: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700" }}>DUE NOW · {due?.dueCount}</Text>
            <Pill tone="info">{`box ${current.box}`}</Pill>
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 30, fontWeight: "900", textAlign: "center", letterSpacing: 1 }}>
            {current.word.toUpperCase()}
          </Text>
          {reveal ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center" }}>{current.definition}</Text>
              {current.example ? (
                <Text style={{ color: colors.textMuted, fontSize: 12, fontStyle: "italic", textAlign: "center" }}>“{current.example}”</Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <TouchableOpacity disabled={busy} onPress={() => answer(false)} style={{ flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 999, paddingVertical: 11, alignItems: "center" }}>
                  <Text style={{ color: colors.danger, fontWeight: "700" }}>Still learning</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={busy} onPress={() => answer(true)} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 11, alignItems: "center" }}>
                  <Text style={{ color: colors.accentText, fontWeight: "800" }}>I knew it ✓</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setReveal(true)} style={{ backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 11, alignItems: "center" }}>
              <Text style={{ color: colors.accentText, fontWeight: "800" }}>Show meaning</Text>
            </TouchableOpacity>
          )}
        </Card>
      ) : (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>
            {due?.total ? "🎉 Nothing due right now — great work! Come back later for the next review." : "Start a word list below to begin."}
          </Text>
        </Card>
      )}

      {/* Word lists to add */}
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>Word lists</Text>
        <View style={{ gap: 8 }}>
          {lists.map((l) => (
            <Card key={l.id}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{l.title}</Text>
                  {l.description ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{l.description}</Text> : null}
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{l.wordCount} words</Text>
                </View>
                <TouchableOpacity disabled={busy} onPress={() => startList(l.id)} style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
                  <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
