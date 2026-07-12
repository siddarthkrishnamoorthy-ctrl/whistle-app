import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiJson } from "@/lib/api-client";
import { Card, LoadingView, colors } from "@/components/ui";
import { LETTER_VALUES } from "@/components/scrabble-board";

interface Session {
  seconds: number;
  racks: string[][];
}
interface CheckResult {
  valid: boolean;
  points: number;
  reason?: string;
}

// Word Rush (Scrabble §5.2): a timed sprint to find as many valid words as you
// can from a stream of racks — the word-game answer to Puzzle Rush.
export default function WordRushScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rackIdx, setRackIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [score, setScore] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setLoading(true);
    apiJson<Session>("/scrabble/word-rush/new")
      .then((s) => {
        setSession(s);
        setRemaining(s.seconds);
        setRackIdx(0);
        setScore(0);
        setFound([]);
        setInput("");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    start();
  }, [start]);

  // Countdown while a session is live.
  useEffect(() => {
    if (!session || remaining <= 0) return;
    tick.current = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [session, remaining > 0]);

  if (loading || !session) return <LoadingView />;

  const over = remaining <= 0;
  const rack = session.racks[rackIdx] ?? [];

  async function submit() {
    const word = input.trim().toLowerCase();
    setInput("");
    if (!word || over) return;
    if (found.includes(word)) {
      setFlash("Already found!");
      return;
    }
    const res = await apiJson<CheckResult>("/scrabble/word-rush/check", {
      method: "POST",
      body: JSON.stringify({ rack, word }),
    }).catch(() => ({ valid: false, points: 0, reason: "…" }) as CheckResult);
    if (res.valid) {
      setScore((s) => s + res.points);
      setFound((f) => [word, ...f]);
      setFlash(`+${res.points} · ${word.toUpperCase()}`);
    } else {
      setFlash(res.reason ?? "Not valid");
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>⚡ Word Rush</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>As many words as you can, fast!</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: over ? colors.danger : colors.accent, fontSize: 26, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
            {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, "0")}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>score {score}</Text>
        </View>
      </View>

      {over ? (
        <Card style={{ gap: 10, borderColor: colors.accent + "55", borderWidth: 1 }}>
          <Text style={{ color: colors.accent, fontSize: 22, fontWeight: "900", textAlign: "center" }}>Time! {score} points</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>{found.length} words found</Text>
          <TouchableOpacity onPress={start} style={{ backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 11, alignItems: "center" }}>
            <Text style={{ color: colors.accentText, fontWeight: "800" }}>Play again ↻</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <>
          {/* Current rack */}
          <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
            {rack.map((t, i) => (
              <View key={i} style={{ width: 40, height: 44, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#efe1b8" }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#1a1a1a" }}>{t.toUpperCase()}</Text>
                <Text style={{ position: "absolute", bottom: 2, right: 3, fontSize: 9, color: "#5a4a1a" }}>{LETTER_VALUES[t] ?? ""}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={submit}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Type a word from these tiles…"
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: colors.textPrimary, fontSize: 16 }}
            />
            <TouchableOpacity onPress={submit} style={{ backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" }}>
              <Text style={{ color: colors.accentText, fontWeight: "800" }}>Go</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            {flash ? <Text style={{ color: flash.startsWith("+") ? colors.accent : colors.textMuted, fontSize: 13, fontWeight: "700" }}>{flash}</Text> : <View />}
            <TouchableOpacity onPress={() => setRackIdx((i) => (i + 1) % session.racks.length)}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "700" }}>New tiles ↻</Text>
            </TouchableOpacity>
          </View>

          {found.length > 0 && (
            <Card>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 6 }}>FOUND ({found.length})</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{found.map((w) => w.toUpperCase()).join("  ·  ")}</Text>
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}
