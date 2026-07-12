// Mirrors backend/prisma/schema.prisma enums exactly (snake_case values are
// serialized as-is over the REST API) — the Prisma schema is the source of
// truth; update both together.

export type UserRole = "admin" | "account_manager" | "venue_manager" | "head_coach" | "coach" | "parent" | "student" | "referee" | "platform_owner";

export type StaffRole = "admin" | "account_manager" | "venue_manager" | "head_coach" | "coach" | "referee";

export type SalaryBasis = "fixed" | "session" | "days_present";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "elite";

export type ClassMode = "offline" | "online" | "both";

export type ClassStatus = "active" | "inactive";

export type SessionStatus = "not_started" | "ongoing" | "completed";

export type EnrollmentStatus = "active" | "due" | "overdue" | "renewed" | "stopped";

export type EnquiryTemperature = "hot" | "warm" | "cold";

export type EnquiryStage = "lead" | "closed" | "junk";

export type AttendanceStatus = "present" | "late" | "absent";

export type InvoiceStatus = "pending" | "paid";

export type PlanType = "subscription" | "trial" | "one_time";

export type FormatType = "individual" | "pair" | "team";

export type EventStatus = "draft" | "scheduled" | "live" | "completed";

export type FixtureStatus = "draft" | "scheduled" | "live" | "pending_confirmation" | "completed" | "abandoned";

export type MatchType = "interschool" | "internal_ladder" | "practice";

export type RatingConfidence = "low" | "medium" | "high";

export const CURRENCY = "INR" as const;
export const CURRENCY_SYMBOL = "₹" as const; // Rupee sign, standardized per plan (deck mixed INR/GBP)
