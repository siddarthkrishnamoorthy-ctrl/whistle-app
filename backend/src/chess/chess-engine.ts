// Whistle chess engine — pure, dependency-free move validation on FEN.
// Full rules of chess: piece movement, castling, en passant, promotion,
// check, checkmate, stalemate, the 50-move rule and basic insufficient
// material. Every game surface (friendly, Match Center fixture, tournament
// match) runs through applyMove(), so an illegal move can never be stored.

export interface ChessState {
  board: (string | null)[]; // 64 squares, a8=0 … h1=63; piece letters, upper = white
  turn: "w" | "b";
  castling: string; // subset of "KQkq" or "-"
  ep: number | null; // en-passant target square index
  halfmove: number;
  fullmove: number;
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const FILES = "abcdefgh";

export function sqToIndex(sq: string): number {
  const file = FILES.indexOf(sq[0]);
  const rank = Number(sq[1]);
  return (8 - rank) * 8 + file;
}

export function indexToSq(i: number): string {
  return `${FILES[i % 8]}${8 - Math.floor(i / 8)}`;
}

export function parseFen(fen: string): ChessState {
  const [placement, turn, castling, ep, halfmove, fullmove] = fen.trim().split(/\s+/);
  const board: (string | null)[] = [];
  for (const row of placement.split("/")) {
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) board.push(null);
      else board.push(ch);
    }
  }
  return {
    board,
    turn: turn === "b" ? "b" : "w",
    castling: castling ?? "-",
    ep: ep && ep !== "-" ? sqToIndex(ep) : null,
    halfmove: Number(halfmove ?? 0),
    fullmove: Number(fullmove ?? 1),
  };
}

export function toFen(s: ChessState): string {
  let placement = "";
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = s.board[r * 8 + f];
      if (!p) empty++;
      else {
        if (empty) { placement += empty; empty = 0; }
        placement += p;
      }
    }
    if (empty) placement += empty;
    if (r < 7) placement += "/";
  }
  return `${placement} ${s.turn} ${s.castling || "-"} ${s.ep != null ? indexToSq(s.ep) : "-"} ${s.halfmove} ${s.fullmove}`;
}

const isWhite = (p: string) => p === p.toUpperCase();
const colorOf = (p: string): "w" | "b" => (isWhite(p) ? "w" : "b");
const fileOf = (i: number) => i % 8;
const rankOf = (i: number) => Math.floor(i / 8);

// Squares attacked BY `by` — used for check detection and castling paths.
function attacked(board: (string | null)[], square: number, by: "w" | "b"): boolean {
  const f0 = fileOf(square);
  const r0 = rankOf(square);
  // Knights
  for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
    const f = f0 + df, r = r0 + dr;
    if (f < 0 || f > 7 || r < 0 || r > 7) continue;
    const p = board[r * 8 + f];
    if (p && colorOf(p) === by && p.toLowerCase() === "n") return true;
  }
  // Sliding + king + pawn via rays
  const rays: [number, number, string][] = [
    [1, 0, "rq"], [-1, 0, "rq"], [0, 1, "rq"], [0, -1, "rq"],
    [1, 1, "bq"], [1, -1, "bq"], [-1, 1, "bq"], [-1, -1, "bq"],
  ];
  for (const [df, dr, kinds] of rays) {
    let f = f0 + df, r = r0 + dr, step = 1;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const p = board[r * 8 + f];
      if (p) {
        if (colorOf(p) === by) {
          const k = p.toLowerCase();
          if (kinds.includes(k)) return true;
          if (step === 1 && k === "k") return true;
          if (step === 1 && k === "p") {
            // A pawn of color `by` on this adjacent diagonal square attacks us
            // if we're diagonally FORWARD of it (white attacks upward = lower rank index).
            const forward = by === "w" ? -1 : 1;
            if (Math.abs(df) === 1 && dr === -forward) return true;
          }
        }
        break;
      }
      f += df; r += dr; step++;
    }
  }
  return false;
}

function kingIndex(board: (string | null)[], color: "w" | "b"): number {
  const k = color === "w" ? "K" : "k";
  return board.indexOf(k);
}

export function inCheck(s: ChessState, color: "w" | "b"): boolean {
  return attacked(s.board, kingIndex(s.board, color), color === "w" ? "b" : "w");
}

interface Move {
  from: number;
  to: number;
  promotion?: string; // q r b n
  castle?: "K" | "Q";
  ep?: boolean;
}

// Pseudo-legal moves for the piece on `from` (king safety filtered later).
function pieceMoves(s: ChessState, from: number): Move[] {
  const p = s.board[from];
  if (!p) return [];
  const color = colorOf(p);
  const moves: Move[] = [];
  const f0 = fileOf(from), r0 = rankOf(from);
  const push = (to: number, extra?: Partial<Move>) => moves.push({ from, to, ...extra });
  const enemy = (i: number) => s.board[i] && colorOf(s.board[i]!) !== color;
  const empty = (i: number) => !s.board[i];
  const kind = p.toLowerCase();

  if (kind === "p") {
    const dir = color === "w" ? -1 : 1; // white moves toward rank index 0
    const startRank = color === "w" ? 6 : 1;
    const promoRank = color === "w" ? 0 : 7;
    const one = (r0 + dir) * 8 + f0;
    if (r0 + dir >= 0 && r0 + dir <= 7 && empty(one)) {
      if (rankOf(one) === promoRank) for (const pr of ["q", "r", "b", "n"]) push(one, { promotion: pr });
      else push(one);
      const two = (r0 + 2 * dir) * 8 + f0;
      if (r0 === startRank && empty(two)) push(two);
    }
    for (const df of [-1, 1]) {
      const f = f0 + df, r = r0 + dir;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const t = r * 8 + f;
      if (enemy(t)) {
        if (r === promoRank) for (const pr of ["q", "r", "b", "n"]) push(t, { promotion: pr });
        else push(t);
      } else if (s.ep === t) {
        push(t, { ep: true });
      }
    }
    return moves;
  }

  if (kind === "n") {
    for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
      const f = f0 + df, r = r0 + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const t = r * 8 + f;
      if (empty(t) || enemy(t)) push(t);
    }
    return moves;
  }

  if (kind === "k") {
    for (const df of [-1, 0, 1]) for (const dr of [-1, 0, 1]) {
      if (!df && !dr) continue;
      const f = f0 + df, r = r0 + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const t = r * 8 + f;
      if (empty(t) || enemy(t)) push(t);
    }
    // Castling: rights present, path empty, king not through/into check.
    const opp = color === "w" ? "b" : "w";
    const home = color === "w" ? 60 : 4; // e1 / e8
    if (from === home && !attacked(s.board, home, opp)) {
      const rights = s.castling;
      const kSide = color === "w" ? rights.includes("K") : rights.includes("k");
      const qSide = color === "w" ? rights.includes("Q") : rights.includes("q");
      if (kSide && empty(home + 1) && empty(home + 2) &&
          !attacked(s.board, home + 1, opp) && !attacked(s.board, home + 2, opp)) {
        push(home + 2, { castle: "K" });
      }
      if (qSide && empty(home - 1) && empty(home - 2) && empty(home - 3) &&
          !attacked(s.board, home - 1, opp) && !attacked(s.board, home - 2, opp)) {
        push(home - 2, { castle: "Q" });
      }
    }
    return moves;
  }

  // Sliding pieces
  const dirs =
    kind === "r" ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
    : kind === "b" ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]; // queen
  for (const [df, dr] of dirs) {
    let f = f0 + df, r = r0 + dr;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const t = r * 8 + f;
      if (empty(t)) push(t);
      else { if (enemy(t)) push(t); break; }
      f += df; r += dr;
    }
  }
  return moves;
}

function applyRaw(s: ChessState, m: Move): ChessState {
  const board = [...s.board];
  const p = board[m.from]!;
  const color = colorOf(p);
  let ep: number | null = null;
  let halfmove = s.halfmove + 1;
  if (p.toLowerCase() === "p" || board[m.to]) halfmove = 0;

  board[m.to] = m.promotion ? (color === "w" ? m.promotion.toUpperCase() : m.promotion.toLowerCase()) : p;
  board[m.from] = null;
  if (m.ep) {
    // Captured pawn sits behind the target square.
    const dir = color === "w" ? 1 : -1;
    board[m.to + dir * 8] = null;
    halfmove = 0;
  }
  if (m.castle) {
    const home = color === "w" ? 60 : 4;
    if (m.castle === "K") { board[home + 1] = board[home + 3]; board[home + 3] = null; }
    else { board[home - 1] = board[home - 4]; board[home - 4] = null; }
  }
  // Double pawn push sets the en-passant target.
  if (p.toLowerCase() === "p" && Math.abs(rankOf(m.to) - rankOf(m.from)) === 2) {
    ep = (rankOf(m.from) + (color === "w" ? -1 : 1)) * 8 + fileOf(m.from);
  }
  // Castling-rights bookkeeping.
  let castling = s.castling.replace("-", "");
  const drop = (c: string) => (castling = castling.replace(c, ""));
  if (p === "K") { drop("K"); drop("Q"); }
  if (p === "k") { drop("k"); drop("q"); }
  for (const sq of [m.from, m.to]) {
    if (sq === 63) drop("K");
    if (sq === 56) drop("Q");
    if (sq === 7) drop("k");
    if (sq === 0) drop("q");
  }
  return {
    board,
    turn: s.turn === "w" ? "b" : "w",
    castling: castling || "-",
    ep,
    halfmove,
    fullmove: s.turn === "b" ? s.fullmove + 1 : s.fullmove,
  };
}

export function legalMovesFrom(fen: string, fromSq: string): string[] {
  const s = parseFen(fen);
  const from = sqToIndex(fromSq);
  const p = s.board[from];
  if (!p || colorOf(p) !== s.turn) return [];
  return pieceMoves(s, from)
    .filter((m) => !inCheck(applyRaw(s, m), s.turn))
    .map((m) => indexToSq(m.to));
}

function hasAnyLegalMove(s: ChessState): boolean {
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (!p || colorOf(p) !== s.turn) continue;
    for (const m of pieceMoves(s, i)) {
      if (!inCheck(applyRaw(s, m), s.turn)) return true;
    }
  }
  return false;
}

function insufficientMaterial(board: (string | null)[]): boolean {
  const pieces = board.filter(Boolean).map((p) => p!.toLowerCase());
  const nonKings = pieces.filter((p) => p !== "k");
  if (nonKings.length === 0) return true;
  if (nonKings.length === 1 && (nonKings[0] === "b" || nonKings[0] === "n")) return true;
  return false;
}

export interface MoveResult {
  ok: boolean;
  error?: string;
  fen?: string;
  status?: "active" | "checkmate" | "stalemate" | "draw";
  check?: boolean;
  winner?: "white" | "black" | "draw";
}

export function applyMove(fen: string, fromSq: string, toSq: string, promotion?: string): MoveResult {
  const s = parseFen(fen);
  const from = sqToIndex(fromSq);
  const to = sqToIndex(toSq);
  const p = s.board[from];
  if (!p) return { ok: false, error: "No piece on that square." };
  if (colorOf(p) !== s.turn) return { ok: false, error: "It's not that piece's turn." };
  const candidates = pieceMoves(s, from).filter((m) => m.to === to);
  if (candidates.length === 0) return { ok: false, error: "That piece can't move there." };
  let move = candidates[0];
  if (candidates.some((m) => m.promotion)) {
    const pr = (promotion ?? "q").toLowerCase();
    const chosen = candidates.find((m) => m.promotion === pr);
    if (!chosen) return { ok: false, error: "Invalid promotion piece." };
    move = chosen;
  }
  const next = applyRaw(s, move);
  if (inCheck(next, s.turn)) return { ok: false, error: "That move would leave your king in check." };

  const opponent = next.turn;
  const opponentInCheck = inCheck(next, opponent);
  let status: MoveResult["status"] = "active";
  let winner: MoveResult["winner"];
  if (!hasAnyLegalMove(next)) {
    if (opponentInCheck) {
      status = "checkmate";
      winner = s.turn === "w" ? "white" : "black";
    } else {
      status = "stalemate";
      winner = "draw";
    }
  } else if (next.halfmove >= 100 || insufficientMaterial(next.board)) {
    status = "draw";
    winner = "draw";
  }
  return { ok: true, fen: toFen(next), status, check: opponentInCheck, winner };
}
