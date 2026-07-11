import { useState } from "react";
import { Text, TouchableOpacity, View, useWindowDimensions } from "react-native";

// Tap-to-move chess board rendered from a FEN string. Selection asks the
// server for that piece's legal targets (via props.getTargets) so the board
// can never suggest an illegal move — the server re-validates anyway.
const GLYPH: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};
const FILES = "abcdefgh";

function fenBoard(fen: string): (string | null)[] {
  const board: (string | null)[] = [];
  for (const row of fen.split(/\s+/)[0].split("/")) {
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) board.push(null);
      else board.push(ch);
    }
  }
  return board;
}

export function fenTurn(fen: string): "w" | "b" {
  return fen.split(/\s+/)[1] === "b" ? "b" : "w";
}

export default function ChessBoard({
  fen,
  canMove,
  getTargets,
  onMove,
  flipped,
}: {
  fen: string;
  canMove: boolean;
  getTargets: (from: string) => Promise<string[]>;
  onMove: (from: string, to: string) => Promise<void>;
  flipped?: boolean;
}) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 40, 420);
  const cell = size / 8;
  const [selected, setSelected] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const board = fenBoard(fen);
  const turn = fenTurn(fen);

  const squareName = (row: number, col: number) => {
    const r = flipped ? 7 - row : row;
    const c = flipped ? 7 - col : col;
    return `${FILES[c]}${8 - r}`;
  };
  const pieceAt = (sq: string) => {
    const col = FILES.indexOf(sq[0]);
    const row = 8 - Number(sq[1]);
    return board[row * 8 + col];
  };

  async function tap(sq: string) {
    if (!canMove) return;
    if (selected && targets.includes(sq)) {
      const from = selected;
      setSelected(null);
      setTargets([]);
      await onMove(from, sq);
      return;
    }
    const p = pieceAt(sq);
    const mine = p && ((turn === "w" && p === p.toUpperCase()) || (turn === "b" && p === p.toLowerCase()));
    if (mine) {
      setSelected(sq);
      setTargets(await getTargets(sq).catch(() => []));
    } else {
      setSelected(null);
      setTargets([]);
    }
  }

  return (
    <View style={{ width: size, height: size, borderRadius: 10, overflow: "hidden", alignSelf: "center" }}>
      {Array.from({ length: 8 }, (_, row) => (
        <View key={row} style={{ flexDirection: "row" }}>
          {Array.from({ length: 8 }, (_, col) => {
            const sq = squareName(row, col);
            const dark = (row + col) % 2 === 1;
            const p = pieceAt(sq);
            const isSel = selected === sq;
            const isTarget = targets.includes(sq);
            return (
              <TouchableOpacity
                key={col}
                activeOpacity={0.8}
                onPress={() => tap(sq)}
                style={{
                  width: cell,
                  height: cell,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSel ? "#f5b93f" : dark ? "#6a7746" : "#e9edcc",
                }}
              >
                {isTarget && !p && (
                  <View style={{ width: cell * 0.3, height: cell * 0.3, borderRadius: cell, backgroundColor: "rgba(245,185,63,0.75)" }} />
                )}
                {p && (
                  <Text
                    style={{
                      fontSize: cell * 0.72,
                      lineHeight: cell,
                      color: p === p.toUpperCase() ? "#ffffff" : "#1a1a1a",
                      textShadowColor: p === p.toUpperCase() ? "#1a1a1a" : "transparent",
                      textShadowRadius: p === p.toUpperCase() ? 2 : 0,
                      ...(isTarget ? { textDecorationLine: "underline" } : {}),
                    }}
                  >
                    {GLYPH[p]}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}
