// Age bands (2026-07) — one pick that fixes an age range AND a school class
// range. Mirrors backend/src/common/age-bands.ts (keep the two in sync). Picking
// a band in the Drill Bank / Lesson Plan builder auto-populates the age group +
// class fields so drills and the plans they feed target the same cohort.

export interface AgeBand {
  band: string;
  ageMin: number;
  ageMax: number;
  classMin: string;
  classMax: string;
  classLabel: string;
}

export const AGE_BANDS: AgeBand[] = [
  { band: "Little Champs", ageMin: 3, ageMax: 5, classMin: "Pre-KG", classMax: "UKG", classLabel: "Pre-KG / LKG / UKG" },
  { band: "Foundation", ageMin: 6, ageMax: 8, classMin: "Class 1", classMax: "Class 3", classLabel: "Class 1 - Class 3" },
  { band: "Development", ageMin: 9, ageMax: 11, classMin: "Class 4", classMax: "Class 6", classLabel: "Class 4 - Class 6" },
  { band: "Performance", ageMin: 12, ageMax: 14, classMin: "Class 7", classMax: "Class 9", classLabel: "Class 7 - Class 9" },
  { band: "Elite", ageMin: 15, ageMax: 17, classMin: "Class 10", classMax: "Class 12", classLabel: "Class 10 - Class 12" },
];

export function findAgeBand(band?: string | null): AgeBand | undefined {
  return band ? AGE_BANDS.find((b) => b.band === band) : undefined;
}

// "3-5 yrs · Pre-KG / LKG / UKG" — compact label for cards.
export function ageBandSummary(band?: string | null): string | null {
  const b = findAgeBand(band);
  return b ? `${b.ageMin}-${b.ageMax} yrs · ${b.classLabel}` : null;
}
