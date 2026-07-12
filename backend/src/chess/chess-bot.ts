// Whistle chess bot (2026-07) — "Play vs Computer" (Chess BRD 5.1). A small,
// dependency-free opponent built on top of the pure engine: it enumerates
// every legal move and picks one by a material heuristic whose depth scales
// with the chosen level. No external Stockfish needed — this keeps bot games
// self-contained and casual (they never affect a player's rating).

import { applyMove, indexToSq, legalMovesFrom, parseFen } from "./chess-engine";

export type BotLevel = 1 | 2 | 3; // Beginner | Club Player | Strong

interface Move {
  from: string;
  to: string;
  promotion?: string;
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Material balance from White's perspective (positive = White ahead).
function evalFen(fen: string): number {
  const { board } = parseFen(fen);
  let score = 0;
  for (const cell of board) {
    if (!cell) continue;
    const v = PIECE_VALUE[cell.toLowerCase()] ?? 0;
    score += cell === cell.toUpperCase() ? v : -v;
  }
  return score;
}

// Every legal move for the side to move in this position.
export function allLegalMoves(fen: string): Move[] {
  const { board, turn } = parseFen(fen);
  const moves: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const isWhite = p === p.toUpperCase();
    if ((turn === "w") !== isWhite) continue;
    const from = indexToSq(i);
    for (const to of legalMovesFrom(fen, from)) {
      // A pawn reaching the last rank always promotes; default to a queen
      // (the engine accepts an explicit promotion piece if we ever expose it).
      const promoting = p.toLowerCase() === "p" && (to[1] === "8" || to[1] === "1");
      moves.push(promoting ? { from, to, promotion: "q" } : { from, to });
    }
  }
  return moves;
}

// Deterministic-enough pseudo-randomness without Math.random() (which is
// unavailable in some sandboxes): mixes the fen + a salt into a 0..1 float.
function jitter(fen: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < fen.length; i++) {
    h ^= fen.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

// Pick the bot's move for the position. Returns null if there is no legal
// move (the caller has already detected mate/stalemate via the engine).
export function chooseBotMove(fen: string, level: BotLevel): Move | null {
  const moves = allLegalMoves(fen);
  if (moves.length === 0) return null;
  const { turn } = parseFen(fen);
  const side = turn === "w" ? 1 : -1; // maximise material from the bot's side

  // Level 1 — Beginner: any legal move (still legal, just unfocused).
  if (level === 1) {
    return moves[Math.floor(jitter(fen, 7) * moves.length)];
  }

  const scored = moves.map((m, idx) => {
    const res = applyMove(fen, m.from, m.to, m.promotion);
    if (!res.ok || !res.fen) return { m, score: -Infinity };
    // Immediate checkmate is always best.
    if (res.status === "checkmate") return { m, score: 1e6 };
    if (res.status === "stalemate" || res.status === "draw") return { m, score: 0 };

    let score = side * evalFen(res.fen);
    // Level 3 — Strong: look one move deeper. Assume the opponent replies
    // with the move that hurts the bot most (2-ply minimax on material).
    if (level === 3) {
      const replies = allLegalMoves(res.fen);
      let worst = Infinity;
      for (const r of replies) {
        const after = applyMove(res.fen, r.from, r.to, r.promotion);
        if (!after.ok || !after.fen) continue;
        if (after.status === "checkmate") {
          worst = -1e6; // opponent mates us — avoid this line
          break;
        }
        worst = Math.min(worst, side * evalFen(after.fen));
      }
      if (replies.length > 0 && worst !== Infinity) score = worst;
    }
    // Tiny tie-breaking jitter so the bot isn't perfectly repetitive.
    return { m, score: score + jitter(fen, idx) * 0.01 };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].m;
}

export const BOT_NAMES: Record<BotLevel, string> = {
  1: "Computer · Beginner",
  2: "Computer · Club Player",
  3: "Computer · Strong",
};
