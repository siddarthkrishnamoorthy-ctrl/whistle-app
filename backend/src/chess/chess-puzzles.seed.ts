// Starter tactics puzzles (Chess BRD 5.2). v1 puzzles are one-movers —
// mate-in-1 or win-material — with the solution as a list of UCI moves
// (from+to, e.g. "e2e8"). The player's moves are the even indices; any odd
// index would be a forced opponent reply. Kept deliberately small and
// hand-verified so the feature is demonstrable without a puzzle database.

export const CHESS_PUZZLE_SEEDS: { fen: string; solution: string[]; theme: string; rating: number }[] = [
  // Queen back-rank mate: Qe8#.
  { fen: "6k1/5ppp/8/8/8/8/4Q3/6K1 w - - 0 1", solution: ["e2e8"], theme: "mate_in_1", rating: 900 },
  // Rook back-rank mate: Ra8#.
  { fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", solution: ["a1a8"], theme: "mate_in_1", rating: 900 },
  // Queen mate supported by the pawn: Qg7# (pawn f6 defends g7).
  { fen: "7k/8/5PQ1/8/8/8/8/6K1 w - - 0 1", solution: ["g6g7"], theme: "mate_in_1", rating: 1000 },
  // Queen mate supported by the king: Qg7# (king f6 defends g7).
  { fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1", solution: ["g1g7"], theme: "mate_in_1", rating: 1050 },
  // Win the hanging queen: exd5.
  { fen: "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1", solution: ["e4d5"], theme: "win_material", rating: 800 },
];
