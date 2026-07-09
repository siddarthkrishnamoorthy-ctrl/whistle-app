// Addendum v3 Section 5.3 — Whistle's self-serve pricing bands. Enterprise has
// no price_per_student_month: 5.2 routes any declared strength ≥1501 to a
// "Request a quote" path instead of self-serve pay/provision.
export const PRICING_TIER_SEEDS = [
  { name: "Starter", minStudents: 1, maxStudents: 150, pricePerStudentMonth: 15 },
  { name: "Growth", minStudents: 151, maxStudents: 500, pricePerStudentMonth: 12 },
  { name: "Scale", minStudents: 501, maxStudents: 1500, pricePerStudentMonth: 9 },
  { name: "Enterprise", minStudents: 1501, maxStudents: null, pricePerStudentMonth: null },
] as const;
