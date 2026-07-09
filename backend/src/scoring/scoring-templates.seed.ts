import type { FormatType } from "@prisma/client";

// BRD 12.2 out-of-the-box templates. Only 4 of the BRD's ~11 listed sports
// are seeded here (Cricket, Football, Badminton, Basketball) — enough to
// prove the config-driven engine across both patterns the BRD describes
// (team/margin-scoring vs individual/rally-point-to-games), without hand-
// building all 11 up front. BRD 12.6's acceptance criterion is that adding a
// new sport is possible "via a config screen or seed data" with no app
// change — the templates admin API (below) is that config screen, so more
// sports can be added the same way without touching this file.
export interface ScoringTemplateSeed {
  sportKey: string;
  formatType: FormatType;
  periodStructure: Record<string, unknown>;
  scoreFields: Record<string, unknown>[];
  winCondition: Record<string, unknown>;
  playerStatFields?: Record<string, unknown>[];
  displayFormat: string;
}

export const SCORING_TEMPLATE_SEEDS: ScoringTemplateSeed[] = [
  {
    sportKey: "cricket",
    formatType: "team",
    periodStructure: { unit: "overs", oversLimit: 20, innings: 2 },
    scoreFields: [
      { key: "runs", label: "Runs", type: "quickTap", options: [1, 2, 3, 4, 6] },
      { key: "wicket", label: "Wicket", type: "action" },
      { key: "extra", label: "Extra", type: "action", options: ["wide", "no_ball", "bye", "leg_bye"] },
      { key: "over_complete", label: "Over complete", type: "action" },
    ],
    winCondition: { rule: "most_runs_after_overs_or_allout", marginAware: true, marginUnit: "runs" },
    playerStatFields: [
      { key: "runsScored", label: "Runs scored" },
      { key: "ballsFaced", label: "Balls faced" },
      { key: "wicketsTaken", label: "Wickets taken" },
      { key: "catches", label: "Catches" },
    ],
    displayFormat: "{runs}/{wickets} ({overs} ov)",
  },
  {
    sportKey: "football",
    formatType: "team",
    periodStructure: { unit: "halves", count: 2, minutesPerHalf: 45 },
    scoreFields: [
      { key: "goal", label: "Goal", type: "action" },
      { key: "card", label: "Card", type: "action", options: ["yellow", "red"] },
      { key: "half_time", label: "Half/Full time", type: "action" },
    ],
    winCondition: { rule: "most_goals_after_regulation", marginAware: true, marginUnit: "goals" },
    playerStatFields: [
      { key: "goals", label: "Goals" },
      { key: "assists", label: "Assists" },
      { key: "cards", label: "Cards" },
    ],
    displayFormat: "{goalsA} – {goalsB}",
  },
  {
    sportKey: "badminton",
    formatType: "individual",
    periodStructure: { unit: "games", bestOf: 3, pointsToWin: 21, winBy: 2, cap: 30 },
    scoreFields: [
      { key: "point", label: "Point", type: "action", options: ["A", "B"] },
      { key: "game_won", label: "Game won", type: "action" },
    ],
    winCondition: { rule: "best_of_n_games", marginAware: false },
    playerStatFields: [{ key: "pointsWonOnServe", label: "Points won on serve" }],
    displayFormat: "{game1}, {game2}, {game3}",
  },
  {
    sportKey: "badminton",
    formatType: "pair",
    periodStructure: { unit: "games", bestOf: 3, pointsToWin: 21, winBy: 2, cap: 30 },
    scoreFields: [
      { key: "point", label: "Point", type: "action", options: ["A", "B"] },
      { key: "game_won", label: "Game won", type: "action" },
    ],
    winCondition: { rule: "best_of_n_games", marginAware: false },
    playerStatFields: [{ key: "pointsWonOnServe", label: "Points won on serve" }],
    displayFormat: "{game1}, {game2}, {game3}",
  },
  {
    sportKey: "basketball",
    formatType: "team",
    periodStructure: { unit: "quarters", count: 4, minutesPerQuarter: 10 },
    scoreFields: [
      { key: "points", label: "2pt/3pt/Free throw", type: "quickTap", options: [1, 2, 3] },
      { key: "foul", label: "Foul", type: "action" },
      { key: "quarter_end", label: "Quarter end", type: "action" },
    ],
    winCondition: { rule: "most_points_after_regulation", marginAware: true, marginUnit: "points" },
    playerStatFields: [
      { key: "points", label: "Points" },
      { key: "fouls", label: "Fouls" },
    ],
    displayFormat: "{pointsA} – {pointsB}",
  },
];
