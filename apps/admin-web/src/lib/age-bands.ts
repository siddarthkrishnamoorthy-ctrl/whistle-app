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

// Map a grade / class name (e.g. "KG", "Grade 5", "Class 11") to its age band,
// so the curriculum (organised by grade) can auto-surface the lesson plans built
// for that cohort. Kindergarten-ish names -> Little Champs; numbered grades map
// by the band class ranges (1-3, 4-6, 7-9, 10-12).
export function ageBandForGrade(gradeName?: string | null): string | null {
  if (!gradeName) return null;
  const g = gradeName.trim().toLowerCase();
  if (/pre-?kg|lkg|ukg|\bkg\b|nursery|kindergarten|playgroup|montessori/.test(g)) return "Little Champs";
  const m = g.match(/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 3) return "Foundation";
    if (n <= 6) return "Development";
    if (n <= 9) return "Performance";
    if (n <= 12) return "Elite";
  }
  return null;
}
