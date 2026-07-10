// The per-sport scoring engine shared by the Tournament module and the
// Match Center (interschool) module — one source of truth for what counts
// as a valid final score (BRD 7.2), so both surfaces validate identically.
//
// Racket/volley sports: each game must be a legitimate final score (reach
// the target, win by 2, hard cap) — or a result can be entered as sets won
// (small numbers like 2-0 / 3-1 / 3-2). Open-scoring sports (football,
// cricket, basketball…) accept any decisive non-negative score.
export const GAME_SCORE_RULES: Record<string, { target: number; winBy: number; cap?: number; maxSets: number }> = {
  badminton: { target: 21, winBy: 2, cap: 30, maxSets: 3 },
  pickleball: { target: 11, winBy: 2, cap: 21, maxSets: 5 },
  "table-tennis": { target: 11, winBy: 2, cap: 21, maxSets: 7 },
  table_tennis: { target: 11, winBy: 2, cap: 21, maxSets: 7 },
  squash: { target: 11, winBy: 2, cap: 21, maxSets: 5 },
  tennis: { target: 6, winBy: 2, cap: 7, maxSets: 5 },
  volleyball: { target: 25, winBy: 2, maxSets: 5 },
  throwball: { target: 25, winBy: 2, maxSets: 5 },
};

// Is a-b a legitimate FINAL score for one game/set of this sport?
function validGame(rule: (typeof GAME_SCORE_RULES)[string], a: number, b: number): boolean {
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  if (winner === loser) return false;
  const capped = rule.cap != null && winner === rule.cap;
  const atTarget = winner === rule.target && winner - loser >= rule.winBy;
  const deuce = winner > rule.target && (rule.cap == null || winner < rule.cap) && winner - loser === rule.winBy;
  return capped || atTarget || deuce;
}

export function validateFinalScore(sportKey: string, scoreA: number, scoreB: number): string | null {
  if (scoreA < 0 || scoreB < 0) return "Scores cannot be negative.";
  const rule = GAME_SCORE_RULES[sportKey];
  if (!rule) return null; // open-scoring sport — any decisive score is fine
  const winner = Math.max(scoreA, scoreB);
  const loser = Math.min(scoreA, scoreB);
  // Small numbers read as sets/games won: winner takes 2 (best of 3) up to
  // floor(maxSets/2)+1 (e.g. 3 in a best of 5), loser has fewer.
  if (winner <= rule.maxSets && winner <= 7) {
    const maxNeeded = Math.floor(rule.maxSets / 2) + 1;
    if (winner < 2 || winner > maxNeeded || loser >= winner) {
      return `As a sets result, the winner takes 2–${maxNeeded} sets with fewer for the loser — e.g. 2-0 or ${maxNeeded}-${maxNeeded - 1}.`;
    }
    return null;
  }
  // Otherwise it's the points of a single game.
  if (validGame(rule, scoreA, scoreB)) return null;
  return `Not a valid ${sportKey.replace(/[-_]/g, " ")} game score: first to ${rule.target}, win by ${rule.winBy}${
    rule.cap ? `, capped at ${rule.cap}` : ""
  } — or enter sets won (e.g. 2-0).`;
}

// Validates a full scoreline string ("21-15, 18-21, 21-19") plus the claimed
// winner side — used for Match Center manual result entry, where results
// arrive as display text rather than a single numeric pair.
export function validateScoreline(
  sportKey: string,
  scoreDisplay: string,
  winnerSide: "A" | "B" | "draw"
): string | null {
  const parts = scoreDisplay
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "Enter the score, e.g. 21-15, 18-21, 21-19.";
  const sets: [number, number][] = [];
  for (const p of parts) {
    const m = p.match(/^(\d+)\s*[-–:]\s*(\d+)$/);
    if (!m) return `"${p}" isn't a score — use the form 21-15 (sets separated by commas).`;
    sets.push([Number(m[1]), Number(m[2])]);
  }

  const rule = GAME_SCORE_RULES[sportKey];
  if (!rule) {
    // Open-scoring sport: one decisive (or drawn) final score.
    if (sets.length > 1) return `Enter a single final score for ${sportKey.replace(/[-_]/g, " ")}, e.g. 3-1.`;
    const [a, b] = sets[0];
    const actual = a > b ? "A" : b > a ? "B" : "draw";
    if (actual !== winnerSide) return `The score ${a}-${b} doesn't match the selected winner.`;
    return null;
  }

  // Racket/volley sport: every set must be a legitimate final set score,
  // and the side taking more sets must match the claimed winner.
  const maxNeeded = Math.floor(rule.maxSets / 2) + 1;
  if (sets.length > rule.maxSets) return `Too many sets — best of ${rule.maxSets} for ${sportKey.replace(/[-_]/g, " ")}.`;
  for (const [a, b] of sets) {
    if (!validGame(rule, a, b)) {
      return `${a}-${b} isn't a valid ${sportKey.replace(/[-_]/g, " ")} set: first to ${rule.target}, win by ${rule.winBy}${
        rule.cap ? `, capped at ${rule.cap}` : ""
      }.`;
    }
  }
  const winsA = sets.filter(([a, b]) => a > b).length;
  const winsB = sets.length - winsA;
  if (winsA === winsB) return "A match needs a winner — add the deciding set.";
  if (Math.max(winsA, winsB) > maxNeeded) return `Too many sets won — first to ${maxNeeded} sets ends the match.`;
  const actual = winsA > winsB ? "A" : "B";
  if (winnerSide !== actual) return `Side ${actual} took more sets — the selected winner doesn't match the score.`;
  return null;
}
