"use client";

// Online tournament chess board — the two registrants play from /play;
// checkmate/resignation reports straight into the bracket (Chess BRD 5.7).

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { tJson, tournamentSession } from "@/lib/tournament-client";

interface Game {
  id: string;
  whiteId: string;
  blackId: string;
  whiteName: string;
  blackName: string;
  fen: string;
  status: string;
  winner: string | null;
  moves: { from: string; to: string }[];
}

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

export default function TournamentChessPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const me = tournamentSession()?.user?.id;

  const load = useCallback(() => {
    tJson<Game>(`/tournaments/chess/games/${gameId}`).then(setGame).catch(() => undefined);
  }, [gameId]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 2500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  if (!game) return <main className="flex min-h-screen items-center justify-center text-slate-400">Loading board…</main>;

  const board = fenBoard(game.fen);
  const turn = game.fen.split(/\s+/)[1] === "b" ? "b" : "w";
  const turnId = turn === "w" ? game.whiteId : game.blackId;
  const myTurn = game.status === "active" && me === turnId;
  const iAmBlack = me === game.blackId && me !== game.whiteId;
  const turnName = turn === "w" ? game.whiteName : game.blackName;

  const banner =
    game.status === "active"
      ? myTurn
        ? "Your move!"
        : `Waiting for ${turnName}…`
      : game.status === "checkmate"
        ? `Checkmate — ${game.winner === "white" ? game.whiteName : game.blackName} wins! Result saved to the bracket.`
        : game.status === "resigned"
          ? `${game.winner === "white" ? game.whiteName : game.blackName} wins by resignation`
          : "Draw";

  async function tap(sq: string) {
    if (!myTurn) return;
    setError(null);
    if (selected && targets.includes(sq)) {
      const from = selected;
      setSelected(null);
      setTargets([]);
      try {
        const updated = await tJson<Game>(`/tournaments/chess/games/${game!.id}/move`, {
          method: "POST",
          body: JSON.stringify({ from, to: sq }),
        });
        setGame(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Invalid move.");
      }
      return;
    }
    const col = FILES.indexOf(sq[0]);
    const row = 8 - Number(sq[1]);
    const p = board[row * 8 + col];
    const mine = p && ((turn === "w" && p === p.toUpperCase()) || (turn === "b" && p === p.toLowerCase()));
    if (mine) {
      setSelected(sq);
      const res = await tJson<{ targets: string[] }>(`/tournaments/chess/games/${game!.id}/legal-moves?from=${sq}`).catch(() => ({ targets: [] }));
      setTargets(res.targets);
    } else {
      setSelected(null);
      setTargets([]);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 text-slate-200">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-400/80">♟ Tournament chess</p>
          <h1 className="text-xl font-extrabold text-white">
            ♔ {game.whiteName} vs ♚ {game.blackName}
          </h1>
          <p className="text-xs text-slate-500">
            Move {game.moves.length + 1} · {turn === "w" ? "White" : "Black"} to play
          </p>
        </div>
        <a href="/play" className="text-xs text-amber-300 hover:underline">← Back to /play</a>
      </header>

      <div className={`mb-4 rounded-xl border px-4 py-2.5 text-center text-sm font-bold ${myTurn ? "border-amber-400/60 bg-amber-400/10 text-amber-300" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
        {banner}
      </div>
      {error && <p className="mb-3 text-center text-sm text-red-400">⚠ {error}</p>}

      <div className="mx-auto grid w-full max-w-md grid-cols-8 overflow-hidden rounded-lg" style={{ aspectRatio: "1" }}>
        {Array.from({ length: 64 }, (_, i) => {
          const row = iAmBlack ? 7 - Math.floor(i / 8) : Math.floor(i / 8);
          const col = iAmBlack ? 7 - (i % 8) : i % 8;
          const sq = `${FILES[col]}${8 - row}`;
          const p = board[row * 8 + col];
          const dark = (row + col) % 2 === 1;
          const isSel = selected === sq;
          const isTarget = targets.includes(sq);
          return (
            <button
              key={i}
              onClick={() => tap(sq)}
              className="relative flex items-center justify-center"
              style={{ backgroundColor: isSel ? "#f5b93f" : dark ? "#6a7746" : "#e9edcc", aspectRatio: "1" }}
            >
              {isTarget && !p && <span className="h-1/3 w-1/3 rounded-full bg-amber-400/80" />}
              {p && (
                <span
                  className="select-none leading-none"
                  style={{
                    fontSize: "min(5.5vw, 34px)",
                    color: p === p.toUpperCase() ? "#fff" : "#1a1a1a",
                    textShadow: p === p.toUpperCase() ? "0 0 2px #1a1a1a" : "none",
                  }}
                >
                  {GLYPH[p]}
                </span>
              )}
              {isTarget && p && <span className="absolute inset-0 border-2 border-amber-400/90" />}
            </button>
          );
        })}
      </div>

      {game.status === "active" && (me === game.whiteId || me === game.blackId) && (
        <button
          onClick={async () => {
            if (!confirm("Resign this game?")) return;
            const updated = await tJson<Game>(`/tournaments/chess/games/${game.id}/resign`, { method: "POST", body: "{}" }).catch(() => null);
            if (updated) setGame(updated);
          }}
          className="mx-auto mt-4 block text-sm font-semibold text-red-400 hover:underline"
        >
          🏳 Resign
        </button>
      )}

      {game.moves.length > 0 && (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Moves</p>
          <p className="text-xs leading-6 text-slate-300">
            {game.moves.map((m, i) => `${i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}${m.from}${m.to}`).join("  ")}
          </p>
        </div>
      )}
    </main>
  );
}
