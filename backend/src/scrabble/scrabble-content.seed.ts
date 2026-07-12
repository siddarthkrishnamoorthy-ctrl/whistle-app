// Starter content for the Scrabble module: word puzzles (Scrabble §5.2) and a
// Word Power vocabulary list (§5.3). Puzzle racks are defined here; the service
// computes each puzzle's optimal play through the real engine at seed time, so
// the stored best word/score always matches the live dictionary.

export const SCRABBLE_PUZZLE_RACKS: { rack: string[]; theme: string; rating: number }[] = [
  { rack: ["c", "a", "t", "s", "e", "r", "n"], theme: "highest_score", rating: 900 },
  { rack: ["b", "o", "a", "r", "d", "e", "s"], theme: "highest_score", rating: 1000 },
  { rack: ["p", "l", "a", "y", "e", "r", "s"], theme: "bingo_hunt", rating: 1150 },
  { rack: ["s", "t", "r", "o", "n", "g", "e"], theme: "bingo_hunt", rating: 1200 },
  { rack: ["q", "u", "i", "e", "t", "e", "r"], theme: "highest_score", rating: 1100 },
];

export const SCRABBLE_WORD_LISTS: {
  title: string;
  description: string;
  entries: { word: string; definition: string; example?: string }[];
}[] = [
  {
    title: "High-Value Scrabble Words",
    description: "Short words that use the heavy tiles (Q, X, Z, J) — the backbone of a big Scrabble score.",
    entries: [
      { word: "qi", definition: "The circulating life force in Chinese philosophy.", example: "Playing QI unloads the tricky Q without needing a U." },
      { word: "za", definition: "Slang for a slice of pizza.", example: "ZA on a triple-letter square is a cheap 22 points." },
      { word: "jo", definition: "A sweetheart or dear one (Scots).", example: "JO is a handy two-letter word for the J." },
      { word: "xu", definition: "A former monetary unit of Vietnam.", example: "XU and XI are the go-to X dumps." },
      { word: "zax", definition: "A tool for cutting roofing slate.", example: "ZAX scores 19 before any bonus squares." },
    ],
  },
  {
    title: "Commonly Confused Words",
    description: "Everyday words students often misspell — vocabulary and spelling practice with real curricular value.",
    entries: [
      { word: "their", definition: "Belonging to them.", example: "The students brought their own boards." },
      { word: "there", definition: "In, at, or to that place.", example: "Put the tiles over there." },
      { word: "quiet", definition: "Making little or no noise.", example: "The exam hall was completely quiet." },
      { word: "quite", definition: "To a certain or fairly significant extent.", example: "That was quite a high-scoring word." },
      { word: "loose", definition: "Not firmly fixed in place.", example: "A loose tile fell off the rack." },
    ],
  },
];
