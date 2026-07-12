// Live chess clock (Chess BRD 5.7). Time is tracked server-side: the clock
// budgets (whiteMs/blackMs) plus the moment the current turn started
// (turnStartedAt) are the source of truth, so a flag can be claimed from any
// request without a running timer. All fields null = an untimed game.

export const TIME_CONTROLS = [
  { key: "untimed", label: "Untimed", initialMs: null, incrementMs: null },
  { key: "1+0", label: "Bullet · 1 min", initialMs: 60_000, incrementMs: 0 },
  { key: "3+2", label: "Blitz · 3|2", initialMs: 180_000, incrementMs: 2_000 },
  { key: "5+0", label: "Blitz · 5 min", initialMs: 300_000, incrementMs: 0 },
  { key: "5+3", label: "Blitz · 5|3", initialMs: 300_000, incrementMs: 3_000 },
  { key: "10+0", label: "Rapid · 10 min", initialMs: 600_000, incrementMs: 0 },
  { key: "10+5", label: "Rapid · 10|5", initialMs: 600_000, incrementMs: 5_000 },
  { key: "15+10", label: "Rapid · 15|10", initialMs: 900_000, incrementMs: 10_000 },
  { key: "30+0", label: "Classical · 30 min", initialMs: 1_800_000, incrementMs: 0 },
];

export interface ParsedControl {
  initialMs: number | null;
  incrementMs: number | null;
}

// Accepts a preset key ("5+3") or a raw "M+I" (minutes+increment seconds).
export function parseTimeControl(tc?: string | null): ParsedControl {
  if (!tc || tc === "untimed") return { initialMs: null, incrementMs: null };
  const preset = TIME_CONTROLS.find((c) => c.key === tc);
  if (preset) return { initialMs: preset.initialMs, incrementMs: preset.incrementMs };
  // "M+I" — minutes (decimals allowed, e.g. 0.5+0) plus increment seconds.
  const m = /^(\d+(?:\.\d+)?)\+(\d+)$/.exec(tc.trim());
  if (!m) return { initialMs: null, incrementMs: null };
  return { initialMs: Math.round(Number(m[1]) * 60_000), incrementMs: Number(m[2]) * 1_000 };
}

export interface ClockGame {
  fen: string;
  status: string;
  initialMs: number | null;
  whiteMs: number | null;
  blackMs: number | null;
  turnStartedAt: Date | null;
  incrementMs: number | null;
}

// How much time the side-to-move has left RIGHT NOW (budget minus the time
// already spent on the current, un-played move). Never negative.
export function liveRemaining(g: ClockGame, now = new Date()): { whiteMs: number | null; blackMs: number | null; flagged: "white" | "black" | null } {
  if (g.initialMs == null || g.whiteMs == null || g.blackMs == null) {
    return { whiteMs: null, blackMs: null, flagged: null };
  }
  const toMove = g.fen.split(/\s+/)[1] === "w" ? "white" : "black";
  const elapsed = g.turnStartedAt && g.status === "active" ? Math.max(0, now.getTime() - g.turnStartedAt.getTime()) : 0;
  let whiteMs = g.whiteMs;
  let blackMs = g.blackMs;
  if (toMove === "white") whiteMs = g.whiteMs - elapsed;
  else blackMs = g.blackMs - elapsed;
  const flagged = g.status === "active" ? (whiteMs <= 0 ? "white" : blackMs <= 0 ? "black" : null) : null;
  return { whiteMs: Math.max(0, whiteMs), blackMs: Math.max(0, blackMs), flagged };
}
