// Scrabble engine (Scrabble Module §6.1). A pure, server-authoritative board +
// tile + scoring engine — the word-game equivalent of the chess engine. It
// validates placements (connectivity, centre-first, no gaps, every formed word
// legal), computes score with bonus squares + the 7-tile bingo, manages the
// tile bag and racks, and detects the standard end-of-game conditions.
//
// The whole game is a plain JSON GameState so it persists on the scrabble_games
// row and replays deterministically — no engine state lives in memory.

import { isValidWord } from "./scrabble-dictionary";

export const SIZE = 15;
export const CENTER = 112; // index of (7,7) on a 15×15 row-major board
export const RACK_SIZE = 7;
export const BINGO_BONUS = 50;

export const LETTER_VALUES: Record<string, number> = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3,
  n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10,
  "?": 0, // blank
};

// Standard English tile distribution (100 tiles incl. 2 blanks "?").
const DISTRIBUTION: Record<string, number> = {
  a: 9, b: 2, c: 2, d: 4, e: 12, f: 2, g: 3, h: 2, i: 9, j: 1, k: 1, l: 4, m: 2,
  n: 6, o: 8, p: 2, q: 1, r: 6, s: 4, t: 6, u: 4, v: 2, w: 2, x: 1, y: 2, z: 1,
  "?": 2,
};

// Bonus-square layout — the standard board. "TW" triple word, "DW" double word,
// "TL" triple letter, "DL" double letter, "" plain. Built once from the
// canonical coordinate lists (mirrored across both axes).
export const BONUS: string[] = (() => {
  const b = new Array(SIZE * SIZE).fill("");
  const put = (kind: string, cells: [number, number][]) => {
    for (const [r, c] of cells) {
      // Mirror across the centre lines to fill all four quadrants.
      for (const [rr, cc] of [
        [r, c],
        [r, SIZE - 1 - c],
        [SIZE - 1 - r, c],
        [SIZE - 1 - r, SIZE - 1 - c],
      ] as [number, number][]) {
        b[rr * SIZE + cc] = kind;
      }
    }
  };
  put("TW", [[0, 0], [0, 7], [7, 0]]);
  put("DW", [[1, 1], [2, 2], [3, 3], [4, 4], [7, 7]]);
  put("TL", [[1, 5], [5, 1], [5, 5]]);
  put("DL", [[0, 3], [2, 6], [3, 0], [3, 7], [6, 2], [6, 6], [7, 3]]);
  return b;
})();

export interface Placement {
  letter: string; // the letter this tile represents (a–z); for a blank, the chosen letter
  row: number;
  col: number;
  blank?: boolean; // true if played from a blank tile (scores 0)
}

export interface GameState {
  board: string[]; // 225 cells, "" empty, else a–z
  blanks: number[]; // indices played as blank tiles (score 0)
  bag: string[]; // remaining tiles, already shuffled
  rackA: string[];
  rackB: string[];
  scoreA: number;
  scoreB: number;
  toMove: "a" | "b";
  passStreak: number; // consecutive pass/exchange half-moves (2 ends the game)
}

// ── Bag & racks ──────────────────────────────────────────────────────────────

function fullBag(): string[] {
  const bag: string[] = [];
  for (const [letter, n] of Object.entries(DISTRIBUTION)) {
    for (let i = 0; i < n; i++) bag.push(letter);
  }
  return bag;
}

// Fisher–Yates using the provided rng (0..1). Randomness lives only here, at
// creation; the shuffled bag is then persisted so all draws are deterministic.
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function draw(bag: string[], rack: string[]): void {
  while (rack.length < RACK_SIZE && bag.length > 0) rack.push(bag.pop()!);
}

export function initialState(rng: () => number = Math.random): GameState {
  const bag = shuffle(fullBag(), rng);
  const rackA: string[] = [];
  const rackB: string[] = [];
  draw(bag, rackA);
  draw(bag, rackB);
  return {
    board: new Array(SIZE * SIZE).fill(""),
    blanks: [],
    bag,
    rackA,
    rackB,
    scoreA: 0,
    scoreB: 0,
    toMove: "a",
    passStreak: 0,
  };
}

// ── Word extraction ──────────────────────────────────────────────────────────

const idx = (r: number, c: number) => r * SIZE + c;
const inBounds = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

// Given the board (with the new tiles already written) and the set of newly
// placed indices, collect every maximal word (main line + any cross words) that
// includes at least one new tile. Returns the words with per-cell metadata for
// scoring.
interface ScoredCell {
  index: number;
  letter: string;
  isNew: boolean;
  isBlank: boolean;
}
function wordAt(board: string[], blankSet: Set<number>, newSet: Set<number>, startR: number, startC: number, dr: number, dc: number): ScoredCell[] | null {
  // Walk back to the start of the run.
  let r = startR;
  let c = startC;
  while (inBounds(r - dr, c - dc) && board[idx(r - dr, c - dc)] !== "") {
    r -= dr;
    c -= dc;
  }
  const cells: ScoredCell[] = [];
  while (inBounds(r, c) && board[idx(r, c)] !== "") {
    const i = idx(r, c);
    cells.push({ index: i, letter: board[i], isNew: newSet.has(i), isBlank: blankSet.has(i) });
    r += dr;
    c += dc;
  }
  return cells.length >= 2 ? cells : null;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

function scoreWord(cells: ScoredCell[]): number {
  let sum = 0;
  let wordMult = 1;
  for (const cell of cells) {
    const base = cell.isBlank ? 0 : LETTER_VALUES[cell.letter] ?? 0;
    let letterMult = 1;
    if (cell.isNew) {
      // Bonus squares apply only to tiles placed THIS turn.
      const b = BONUS[cell.index];
      if (b === "DL") letterMult = 2;
      else if (b === "TL") letterMult = 3;
      else if (b === "DW") wordMult *= 2;
      else if (b === "TW") wordMult *= 3;
    }
    sum += base * letterMult;
  }
  return sum * wordMult;
}

// ── Placement validation + application ───────────────────────────────────────

export interface PlaceResult {
  ok: boolean;
  error?: string;
  score?: number;
  words?: string[];
  state?: GameState;
  finished?: boolean;
  winner?: "a" | "b" | "draw" | null;
}

// Validate and apply a tile placement for the side to move. `placements` are the
// NEW tiles only. Returns the next state (turn handed over, tiles redrawn) and
// the score, or a rejection with a reason — nothing is mutated on failure.
export function applyPlacement(state: GameState, placements: Placement[]): PlaceResult {
  if (placements.length === 0) return { ok: false, error: "No tiles placed." };
  if (placements.length > RACK_SIZE) return { ok: false, error: "Too many tiles." };

  const rack = state.toMove === "a" ? [...state.rackA] : [...state.rackB];
  const board = [...state.board];
  const blankSet = new Set(state.blanks);
  const newSet = new Set<number>();

  // All placements in one row or one column.
  const rows = new Set(placements.map((p) => p.row));
  const cols = new Set(placements.map((p) => p.col));
  if (rows.size > 1 && cols.size > 1) return { ok: false, error: "Tiles must be in a single row or column." };

  // Remove used letters from a copy of the rack (blank consumes a "?").
  for (const p of placements) {
    const need = p.blank ? "?" : p.letter.toLowerCase();
    const at = rack.indexOf(need);
    if (at === -1) return { ok: false, error: `You don't have the tile "${need}".` };
    rack.splice(at, 1);
  }

  // Write tiles; reject overlaps and off-board.
  for (const p of placements) {
    if (!inBounds(p.row, p.col)) return { ok: false, error: "Placement off the board." };
    const i = idx(p.row, p.col);
    if (board[i] !== "") return { ok: false, error: "A tile is already on that square." };
    board[i] = p.letter.toLowerCase();
    newSet.add(i);
    if (p.blank) blankSet.add(i);
  }

  const isFirstMove = state.board.every((c) => c === "");
  if (isFirstMove) {
    if (!newSet.has(CENTER)) return { ok: false, error: "The first word must cover the centre star." };
    if (placements.length < 2) return { ok: false, error: "The first word must be at least two letters." };
  }

  // The main line must be contiguous (no gaps between the new tiles along the
  // axis of play, counting existing tiles as fill).
  const horizontal = rows.size === 1;
  const line = placements.map((p) => (horizontal ? p.col : p.row)).sort((a, b) => a - b);
  const fixed = horizontal ? [...rows][0] : [...cols][0];
  for (let k = line[0]; k <= line[line.length - 1]; k++) {
    const i = horizontal ? idx(fixed, k) : idx(k, fixed);
    if (board[i] === "") return { ok: false, error: "The word can't have a gap." };
  }

  // Collect every formed word (main + crosses). Each must be legal.
  const words: ScoredCell[][] = [];
  const seen = new Set<string>();
  const addWord = (cells: ScoredCell[] | null) => {
    if (!cells) return;
    const key = cells.map((c) => c.index).join(",");
    if (seen.has(key)) return;
    seen.add(key);
    words.push(cells);
  };
  // Main word along the axis of play.
  const first = placements[0];
  addWord(wordAt(board, blankSet, newSet, first.row, first.col, horizontal ? 0 : 1, horizontal ? 1 : 0));
  // Cross words at each new tile (perpendicular axis).
  for (const p of placements) {
    addWord(wordAt(board, blankSet, newSet, p.row, p.col, horizontal ? 1 : 0, horizontal ? 0 : 1));
  }
  if (words.length === 0) return { ok: false, error: "That doesn't form a word." };

  // Connectivity: after the first move, at least one formed word must reuse an
  // existing tile (i.e. some word has a non-new cell), OR a cross word formed.
  if (!isFirstMove) {
    const touches = words.some((w) => w.some((c) => !c.isNew));
    if (!touches) return { ok: false, error: "New words must connect to tiles already on the board." };
  }

  // Every formed word must be in the dictionary.
  const wordStrings = words.map((w) => w.map((c) => c.letter).join(""));
  const bad = wordStrings.find((w) => !isValidWord(w));
  if (bad) return { ok: false, error: `"${bad.toUpperCase()}" isn't in the word list.` };

  // Score = sum of each word, + bingo if all 7 tiles were used this turn.
  let score = words.reduce((s, w) => s + scoreWord(w), 0);
  if (placements.length === RACK_SIZE) score += BINGO_BONUS;

  // Refill the rack from the bag.
  draw(state.bag, rack);
  const bag = [...state.bag];

  const next: GameState = {
    board,
    blanks: [...blankSet],
    bag,
    rackA: state.toMove === "a" ? rack : state.rackA,
    rackB: state.toMove === "b" ? rack : state.rackB,
    scoreA: state.scoreA + (state.toMove === "a" ? score : 0),
    scoreB: state.scoreB + (state.toMove === "b" ? score : 0),
    toMove: state.toMove === "a" ? "b" : "a",
    passStreak: 0,
  };

  // End of game: the mover emptied their rack and the bag is empty.
  const finished = rack.length === 0 && bag.length === 0;
  let winner: "a" | "b" | "draw" | null = null;
  if (finished) winner = endGame(next);

  return { ok: true, score, words: wordStrings.map((w) => w.toUpperCase()), state: next, finished, winner };
}

// A pass or exchange — no score, turn passes, streak increments. Two in a row
// ends the game (standard Scrabble rule).
export function applyPass(state: GameState, exchangeTiles?: string[]): PlaceResult {
  const next: GameState = { ...state, board: [...state.board], bag: [...state.bag], rackA: [...state.rackA], rackB: [...state.rackB], blanks: [...state.blanks] };
  if (exchangeTiles && exchangeTiles.length > 0) {
    if (next.bag.length < exchangeTiles.length) return { ok: false, error: "Not enough tiles left in the bag to exchange." };
    const rack = next.toMove === "a" ? next.rackA : next.rackB;
    for (const t of exchangeTiles) {
      const at = rack.indexOf(t.toLowerCase());
      if (at === -1) return { ok: false, error: `You don't have the tile "${t}".` };
      rack.splice(at, 1);
    }
    // Return exchanged tiles to the bag, then redraw.
    next.bag.unshift(...exchangeTiles.map((t) => t.toLowerCase()));
    draw(next.bag, rack);
  }
  next.toMove = state.toMove === "a" ? "b" : "a";
  next.passStreak = state.passStreak + 1;
  const finished = next.passStreak >= 2;
  const winner = finished ? endGame(next) : null;
  return { ok: true, score: 0, words: [], state: next, finished, winner };
}

// End-game scoring: each player loses the value of tiles left on their rack; if
// one player went out (empty rack) they gain the sum of everyone else's tiles.
function endGame(s: GameState): "a" | "b" | "draw" {
  const rackVal = (rack: string[]) => rack.reduce((n, t) => n + (LETTER_VALUES[t] ?? 0), 0);
  const aLeft = rackVal(s.rackA);
  const bLeft = rackVal(s.rackB);
  if (s.rackA.length === 0) {
    s.scoreA += bLeft;
    s.scoreB -= bLeft;
  } else if (s.rackB.length === 0) {
    s.scoreB += aLeft;
    s.scoreA -= aLeft;
  } else {
    s.scoreA -= aLeft;
    s.scoreB -= bLeft;
  }
  return s.scoreA > s.scoreB ? "a" : s.scoreB > s.scoreA ? "b" : "draw";
}

// Convenience for clients: the board as rows of letters ("" empty).
export function boardRows(state: GameState): string[][] {
  const rows: string[][] = [];
  for (let r = 0; r < SIZE; r++) rows.push(state.board.slice(r * SIZE, r * SIZE + SIZE));
  return rows;
}
