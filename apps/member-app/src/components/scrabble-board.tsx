import { useMemo, useState } from "react";
import { Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { colors } from "@/components/ui";

// Tap-to-place Scrabble board. Pick a rack tile, tap an empty square to place
// it (pending), tap a pending tile to recall it. The parent submits the pending
// placements; the server re-validates every word so the board can't cheat.

const SIZE = 15;
const CENTER = 112;
export const LETTER_VALUES: Record<string, number> = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3,
  n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10, "?": 0,
};

// Bonus-square layout, mirrored across both axes — matches the engine.
const BONUS: string[] = (() => {
  const b = new Array(SIZE * SIZE).fill("");
  const put = (kind: string, cells: [number, number][]) => {
    for (const [r, c] of cells)
      for (const [rr, cc] of [[r, c], [r, SIZE - 1 - c], [SIZE - 1 - r, c], [SIZE - 1 - r, SIZE - 1 - c]] as [number, number][])
        b[rr * SIZE + cc] = kind;
  };
  put("TW", [[0, 0], [0, 7], [7, 0]]);
  put("DW", [[1, 1], [2, 2], [3, 3], [4, 4], [7, 7]]);
  put("TL", [[1, 5], [5, 1], [5, 5]]);
  put("DL", [[0, 3], [2, 6], [3, 0], [3, 7], [6, 2], [6, 6], [7, 3]]);
  return b;
})();
const BONUS_COLOR: Record<string, string> = {
  TW: "#b3402f", DW: "#d98a8a", TL: "#2f6fb3", DL: "#8ab6d9", "": "#12331f",
};
const BONUS_LABEL: Record<string, string> = { TW: "TW", DW: "DW", TL: "TL", DL: "DL" };

export interface PendingTile {
  index: number;
  letter: string;
  rackIdx: number;
  blank: boolean;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

export default function ScrabbleBoard({
  board,
  blanks,
  rack,
  canPlay,
  pending,
  onChange,
}: {
  board: string[];
  blanks: number[];
  rack: string[];
  canPlay: boolean;
  pending: PendingTile[];
  onChange: (p: PendingTile[]) => void;
}) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 24, 380);
  const cell = size / SIZE;
  const [selRack, setSelRack] = useState<number | null>(null);
  // When a blank tile is dropped, we ask which letter it stands for.
  const [blankPick, setBlankPick] = useState<{ index: number; rackIdx: number } | null>(null);
  const blankSet = useMemo(() => new Set(blanks), [blanks]);
  const pendingByIndex = useMemo(() => new Map(pending.map((p) => [p.index, p])), [pending]);
  const usedRackIdx = useMemo(() => new Set(pending.map((p) => p.rackIdx)), [pending]);

  function tapCell(index: number) {
    if (!canPlay) return;
    const existingPending = pendingByIndex.get(index);
    if (existingPending) {
      // Recall this tile back to the rack.
      onChange(pending.filter((p) => p.index !== index));
      return;
    }
    if (board[index] !== "") return; // occupied by a committed tile
    if (selRack == null) return;
    const tile = rack[selRack];
    if (tile === "?") {
      // Blank tile — ask which letter it should represent before placing.
      setBlankPick({ index, rackIdx: selRack });
      setSelRack(null);
      return;
    }
    onChange([...pending, { index, letter: tile, rackIdx: selRack, blank: false }]);
    setSelRack(null);
  }

  function chooseBlankLetter(letter: string) {
    if (!blankPick) return;
    onChange([...pending, { index: blankPick.index, letter, rackIdx: blankPick.rackIdx, blank: true }]);
    setBlankPick(null);
  }

  const letterAt = (i: number) => board[i] || pendingByIndex.get(i)?.letter || "";
  const isPending = (i: number) => pendingByIndex.has(i);
  const isBlank = (i: number) => blankSet.has(i) || pendingByIndex.get(i)?.blank;

  return (
    <View style={{ gap: 12, alignItems: "center" }}>
      <View style={{ width: size, height: size, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
        {Array.from({ length: SIZE }, (_, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {Array.from({ length: SIZE }, (_, c) => {
              const i = r * SIZE + c;
              const l = letterAt(i);
              const bonus = BONUS[i];
              const pend = isPending(i);
              const bg = l ? (pend ? "#e6b800" : "#efe1b8") : BONUS_COLOR[bonus];
              return (
                <TouchableOpacity
                  key={c}
                  activeOpacity={0.8}
                  onPress={() => tapCell(i)}
                  style={{ width: cell, height: cell, alignItems: "center", justifyContent: "center", backgroundColor: bg, borderWidth: 0.5, borderColor: "rgba(0,0,0,0.25)" }}
                >
                  {l ? (
                    <Text style={{ fontSize: cell * 0.55, fontWeight: "800", color: "#1a1a1a" }}>{l.toUpperCase()}</Text>
                  ) : i === CENTER ? (
                    <Text style={{ fontSize: cell * 0.6, color: "#e9edcc" }}>★</Text>
                  ) : bonus ? (
                    <Text style={{ fontSize: cell * 0.34, fontWeight: "700", color: "rgba(255,255,255,0.85)" }}>{BONUS_LABEL[bonus]}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Rack — tap a tile to pick it up, tap a board square to drop it. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", minHeight: 46 }}>
        {rack.map((t, idx) => {
          const used = usedRackIdx.has(idx);
          const sel = selRack === idx;
          if (used) return <View key={idx} style={{ width: 38, height: 42 }} />;
          return (
            <TouchableOpacity
              key={idx}
              disabled={!canPlay}
              activeOpacity={0.8}
              onPress={() => setSelRack(sel ? null : idx)}
              style={{
                width: 38,
                height: 42,
                borderRadius: 6,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: sel ? "#e6b800" : "#efe1b8",
                borderWidth: sel ? 2 : 1,
                borderColor: sel ? colors.accent : "rgba(0,0,0,0.35)",
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1a1a1a" }}>{t === "?" ? " " : t.toUpperCase()}</Text>
              <Text style={{ position: "absolute", bottom: 2, right: 3, fontSize: 9, color: "#5a4a1a" }}>
                {t === "?" ? "" : LETTER_VALUES[t] ?? ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Blank-tile letter picker — choose what the blank stands for. */}
      {blankPick ? (
        <View style={{ width: "100%", gap: 6, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center" }}>Blank tile — pick a letter</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
            {ALPHABET.map((l) => (
              <TouchableOpacity
                key={l}
                onPress={() => chooseBlankLetter(l)}
                style={{ width: 30, height: 32, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#efe1b8" }}
              >
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#1a1a1a" }}>{l.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setBlankPick(null)} style={{ width: 30, height: 32, borderRadius: 6, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 15, color: colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}
