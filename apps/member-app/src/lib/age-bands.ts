// Age bands (2026-07) — mirrors backend/src/common/age-bands.ts and the admin
// web. Used on the coach Lessons tab to label sequential (age-band) curriculum.

export interface AgeBand {
  band: string;
  ageMin: number;
  ageMax: number;
  classLabel: string;
}

export const AGE_BANDS: AgeBand[] = [
  { band: "Little Champs", ageMin: 3, ageMax: 5, classLabel: "Pre-KG / LKG / UKG" },
  { band: "Foundation", ageMin: 6, ageMax: 8, classLabel: "Class 1 - Class 3" },
  { band: "Development", ageMin: 9, ageMax: 11, classLabel: "Class 4 - Class 6" },
  { band: "Performance", ageMin: 12, ageMax: 14, classLabel: "Class 7 - Class 9" },
  { band: "Elite", ageMin: 15, ageMax: 17, classLabel: "Class 10 - Class 12" },
];

export function findAgeBand(band?: string | null): AgeBand | undefined {
  return band ? AGE_BANDS.find((b) => b.band === band) : undefined;
}

// Map a grade / class name (KG, Grade 1-12) to its age band, so grade-sequenced
// curriculum can be labelled by the band it targets.
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
