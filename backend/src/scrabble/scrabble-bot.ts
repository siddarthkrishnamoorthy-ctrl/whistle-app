// Scrabble computer opponent (Scrabble Module §5.1). Generates legal plays from
// the bot's rack against the current board and picks one by difficulty:
//   1 Beginner    — a modest play (low/among the weaker legal plays)
//   2 Club Player — the best of a sampled set
//   3 Strong      — the highest-scoring legal play found
// The word list is small, so an exhaustive-ish scan is cheap. Every candidate is
// validated through the real engine (applyPlacement) so the bot can never cheat.

import { applyPlacement, GameState, Placement, SIZE } from "./scrabble-engine";
import { dictionaryWords } from "./scrabble-dictionary";

export type BotLevel = 1 | 2 | 3;
export const BOT_NAMES: Record<BotLevel, string> = {
  1: "Computer · Beginner",
  2: "Computer · Club Player",
  3: "Computer · Strong",
};

interface Candidate {
  placements: Placement[];
  score: number;
}

const idx = (r: number, c: number) => r * SIZE + c;

// Can the rack (which may hold "?" blanks) supply this multiset of letters?
// Returns the resolved placements (blanks flagged) or null.
function resolveWithRack(rack: string[], want: Placement[]): Placement[] | null {
  const pool: Record<string, number> = {};
  let blanks = 0;
  for (const t of rack) {
    if (t === "?") blanks++;
    else pool[t] = (pool[t] ?? 0) + 1;
  }
  const out: Placement[] = [];
  for (const p of want) {
    const l = p.letter;
    if ((pool[l] ?? 0) > 0) {
      pool[l]--;
      out.push({ ...p });
    } else if (blanks > 0) {
      blanks--;
      out.push({ ...p, blank: true });
    } else {
      return null;
    }
  }
  return out;
}

function occupied(state: GameState, r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE && state.board[idx(r, c)] !== "";
}

// Does a run [start..end] along an axis touch the existing board (overlap or an
// orthogonal/inline neighbour)? Cheap pre-filter before the full engine check.
function anchored(state: GameState, r0: number, c0: number, len: number, horizontal: boolean): boolean {
  for (let k = 0; k < len; k++) {
    const r = horizontal ? r0 : r0 + k;
    const c = horizontal ? c0 + k : c0;
    if (occupied(state, r, c)) return true;
    if (occupied(state, r - 1, c) || occupied(state, r + 1, c) || occupied(state, r, c - 1) || occupied(state, r, c + 1)) return true;
  }
  return false;
}

function collectPlays(state: GameState, maxChecks = 6000): Candidate[] {
  const rack = state.toMove === "a" ? state.rackA : state.rackB;
  const words = [...dictionaryWords()];
  const isFirst = state.board.every((c) => c === "");
  const out: Candidate[] = [];
  let checks = 0;

  for (const word of words) {
    const len = word.length;
    if (len < 2 || len > SIZE) continue;
    for (const horizontal of [true, false]) {
      const maxStart = SIZE - len;
      for (let line = 0; line < SIZE; line++) {
        for (let start = 0; start <= maxStart; start++) {
          const r0 = horizontal ? line : start;
          const c0 = horizontal ? start : line;

          // Build the placements (only new tiles); overlaps must match.
          const want: Placement[] = [];
          let ok = true;
          for (let k = 0; k < len; k++) {
            const r = horizontal ? r0 : r0 + k;
            const c = horizontal ? c0 + k : c0;
            const cell = state.board[idx(r, c)];
            const wl = word[k];
            if (cell !== "") {
              if (cell !== wl) { ok = false; break; }
            } else {
              want.push({ letter: wl, row: r, col: c });
            }
          }
          if (!ok || want.length === 0) continue;

          // Cheap filters before the (heavier) full engine validation.
          if (isFirst) {
            if (!want.some((p) => idx(p.row, p.col) === 112)) continue; // must cover centre
          } else if (!anchored(state, r0, c0, len, horizontal)) {
            continue;
          }
          const resolved = resolveWithRack(rack, want);
          if (!resolved) continue;

          if (++checks > maxChecks) return out;
          const res = applyPlacement(state, resolved);
          if (res.ok) out.push({ placements: resolved, score: res.score ?? 0 });
        }
      }
    }
  }
  return out;
}

// Deterministic-ish tie-break jitter from the board fill, so equal-scoring plays
// don't always resolve the same way — without Math.random (mirrors the chess bot).
function jitter(state: GameState): number {
  let h = 2166136261;
  for (let i = 0; i < state.board.length; i++) {
    h ^= state.board[i].charCodeAt(0) || 1;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 997;
}

export function chooseBotMove(state: GameState, level: BotLevel): { placements: Placement[]; score: number } | null {
  const plays = collectPlays(state);
  if (plays.length === 0) return null;
  plays.sort((a, b) => b.score - a.score || (jitter(state) % 2 ? 1 : -1));

  if (level >= 3) return plays[0];
  if (level === 2) {
    // Best of the top third — strong but not perfect.
    const pool = plays.slice(0, Math.max(1, Math.ceil(plays.length / 3)));
    return pool[jitter(state) % pool.length];
  }
  // Beginner: a weaker play from the bottom half (still legal), keeping games winnable.
  const weak = plays.slice(Math.floor(plays.length / 2));
  const pool = weak.length ? weak : plays;
  return pool[jitter(state) % pool.length];
}
