// Pure Elo/DUPR-style rating math (BRD Section 11.4) — no DB access, so match
// history can be replayed deterministically for audit/bug-fix backfills
// (BRD 11.8: "Rating math must be a pure function ... recomputable/replayable").

export const RATING_MIN = 2.0;
export const RATING_MAX = 8.0;

// Elo's classic /400 divisor is calibrated for a ~0-3000 scale. Our scale is
// 2.00-8.00 (a 6-point spread), so BRD 11.4.1 recalibrates it: a 1.00 rating
// point gap should give "≈25% swing" in expected win probability (expected
// score ≈0.75 at a 1.0 gap instead of a neutral 0.5). Solving
// 0.75 = 1/(1+10^(-1/D)) gives D≈2.1; we use 2.0 as a clean constant, which
// yields ≈0.76 at a 1.0 gap — within the BRD's stated "≈" tolerance.
const RATING_DIVISOR = 2.0;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / RATING_DIVISOR));
}

export function clampRating(rating: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, rating));
}

// BRD 11.4.3 margin-of-victory adjustment: nudges the binary 1.0/0.0 actual
// score toward 0.75/0.25 for a close result. marginRatio is a caller-supplied
// normalized closeness: 0 = razor close, 1 = blowout. The BRD calls this "a
// configurable margin-to-adjustment curve" without specifying the exact
// curve — this is a simple, documented linear interpolation between 0.75
// (close) and 1.0 (blowout), which satisfies the stated intent.
export function marginAwareActualScore(won: boolean, marginRatio: number): number {
  const clamped = Math.min(1, Math.max(0, marginRatio));
  const winnerScore = 0.75 + 0.25 * clamped;
  return won ? winnerScore : 1 - winnerScore;
}

// K decays 10% after every 5 rated matches, floor 0.15 (BRD 11.4.1). Applied
// incrementally (once per 5-match boundary crossed) rather than recomputed
// from scratch each time, so replaying stored RatingTransactions in order
// reproduces the exact same sequence of K values.
export function decayKFactorIfDue(currentK: number, matchesPlayedAfterThisMatch: number): number {
  if (matchesPlayedAfterThisMatch % 5 !== 0) return currentK;
  return Math.max(0.15, currentK * 0.9);
}

export type SkillLevelSeed = "beginner" | "intermediate" | "advanced" | "elite";

// BRD 11.3 — starting rating/K-factor mapped from the student's existing
// academy Skill Level, so a student never starts from zero.
export const SKILL_LEVEL_SEED: Record<SkillLevelSeed, { rating: number; kFactor: number }> = {
  beginner: { rating: 2.5, kFactor: 0.6 },
  intermediate: { rating: 3.5, kFactor: 0.5 },
  advanced: { rating: 4.5, kFactor: 0.4 },
  elite: { rating: 5.0, kFactor: 0.35 },
};

// BRD 11.2 "Reliability/Confidence" — thresholds aren't given an exact value
// beyond the two examples ("2 matches" = Low, "40 matches" = High); this
// picks reasonable cutoffs consistent with the provisional-period default (5).
export function confidenceFor(matchesPlayed: number): "low" | "medium" | "high" {
  if (matchesPlayed < 5) return "low";
  if (matchesPlayed < 20) return "medium";
  return "high";
}

// Addendum v3 Section 3.1 — numeric Reliability Score, additive to (not a
// replacement for) the Low/Medium/High confidence badge above. The addendum
// specifies it's "computed from matches_played and recency" without an exact
// formula (same "configurable curve" latitude as the margin-aware score in
// 11.4.3), so this is a documented, simple choice: a saturating curve on
// matches played (approaches 100% but never quite gets there, matching DUPR's
// own framing that no rating is ever fully "final"), scaled down if the
// player's rating hasn't updated in a while (a stale-but-high match count
// shouldn't read as maximally reliable). Computed at read-time rather than
// stored, so it can never drift from matchesPlayed/lastUpdatedAt.
export function reliabilityPct(matchesPlayed: number, lastUpdatedAt: Date, asOf: Date = new Date()): number {
  const matchesComponent = 1 - Math.pow(0.85, matchesPlayed);
  const daysSinceUpdate = Math.max(0, (asOf.getTime() - lastUpdatedAt.getTime()) / (1000 * 60 * 60 * 24));
  // Full weight for 6 months of recency, linearly floored at 0.5 by 12 months.
  const recencyFactor = daysSinceUpdate <= 180 ? 1 : Math.max(0.5, 1 - (daysSinceUpdate - 180) / 360);
  return Math.round(matchesComponent * recencyFactor * 100);
}

export interface SideUpdateInput {
  clientId: string;
  preRating: number;
  kFactorCurrent: number;
  matchesPlayed: number;
  contributionWeight: number;
}

export interface SideUpdateResult extends SideUpdateInput {
  postRating: number;
  expectedScore: number;
  actualScore: number;
  newKFactorCurrent: number;
  newMatchesPlayed: number;
}

// Computes the per-player rating update for one side of a fixture (BRD
// 11.4.2 team adaptation: team rating = average of featured players; each
// player's own rating then moves by their own K × contributionWeight ×
// (actual - expected), where "expected"/"actual" are the TEAM-level values
// shared by every player on that side — not recomputed per player).
export function applySideUpdate(
  players: SideUpdateInput[],
  expected: number,
  actual: number
): SideUpdateResult[] {
  return players.map((p) => {
    const newMatchesPlayed = p.matchesPlayed + 1;
    const delta = p.kFactorCurrent * p.contributionWeight * (actual - expected);
    const postRating = clampRating(p.preRating + delta);
    const newKFactorCurrent = decayKFactorIfDue(p.kFactorCurrent, newMatchesPlayed);
    return {
      ...p,
      postRating,
      expectedScore: expected,
      actualScore: actual,
      newKFactorCurrent,
      newMatchesPlayed,
    };
  });
}

export function averageRating(players: { preRating: number }[]): number {
  return players.reduce((sum, p) => sum + p.preRating, 0) / players.length;
}
