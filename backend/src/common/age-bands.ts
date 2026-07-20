// Age bands (2026-07) — a single pick that fixes an age range AND a school
// class range, so a drill and the lesson plan it feeds target the same cohort.
// Single source of truth on the backend; the admin web mirrors it in
// apps/admin-web/src/lib/age-bands.ts (keep the two in sync).

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

export interface AgeBandFields {
  ageBand: string | null;
  ageMin: number | null;
  ageMax: number | null;
  classMin: string | null;
  classMax: string | null;
  classLabel: string | null;
}

const EMPTY: AgeBandFields = { ageBand: null, ageMin: null, ageMax: null, classMin: null, classMax: null, classLabel: null };

// Resolve the persisted columns for a picked band. Empty/"" clears them.
// Unknown band names fall back to cleared rather than throwing, so a stale
// client value can never wedge a save.
export function ageBandFields(band?: string | null): AgeBandFields {
  if (!band) return { ...EMPTY };
  const b = AGE_BANDS.find((x) => x.band === band);
  if (!b) return { ...EMPTY };
  return { ageBand: b.band, ageMin: b.ageMin, ageMax: b.ageMax, classMin: b.classMin, classMax: b.classMax, classLabel: b.classLabel };
}
