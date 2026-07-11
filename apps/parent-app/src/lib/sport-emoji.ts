// Sport → emoji for the coach app (mirrors admin-web/src/lib/sport-icons.ts).
// Emojis need no icon font and stay colourful on the dark theme.
const SPORT_EMOJI: Record<string, string> = {
  cricket: "🏏",
  football: "⚽",
  badminton: "🏸",
  tennis: "🎾",
  "table-tennis": "🏓",
  table_tennis: "🏓",
  pickleball: "🏓",
  squash: "🎾",
  basketball: "🏀",
  volleyball: "🏐",
  throwball: "🏐",
  swimming: "🏊",
  hockey: "🏑",
  kabaddi: "🤼",
  billiards: "🎱",
  chess: "♟️",
  athletics: "🏃",
  track_and_field: "🏃",
  running: "🏃",
};

export function sportEmoji(key: string | null | undefined): string {
  return SPORT_EMOJI[(key ?? "").toLowerCase()] ?? "🏆";
}

export const RANK_MEDALS = ["🥇", "🥈", "🥉"];
