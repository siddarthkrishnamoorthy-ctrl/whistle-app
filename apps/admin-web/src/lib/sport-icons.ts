// Sport → emoji for tournament surfaces. Emojis stay colorful on the dark
// theme and need no extra icon font on the public pages.
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
  athletics: "🏃",
  track_and_field: "🏃",
  running: "🏃",
};

export function sportEmoji(key: string | null | undefined): string {
  return SPORT_EMOJI[(key ?? "").toLowerCase()] ?? "🏆";
}

export const RANK_MEDALS = ["🥇", "🥈", "🥉"];
