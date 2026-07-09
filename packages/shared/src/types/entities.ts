import type { UserRole } from "./common";

// Shared request/response shapes for the NestJS API (backend/src/auth/*).
// The full data model lives in backend/prisma/schema.prisma — that's the
// source of truth; these are just the wire-format contracts the three apps
// need to talk to it.

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  academyId: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface SignupRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Coach/Parent app wire shapes — mirrors the subset of backend/prisma/schema.prisma
// each mobile app actually reads. Kept minimal (only fields the apps render);
// admin-web has its own richer copies in apps/admin-web/src/lib/types.ts.

export interface ClientRef {
  id: string;
  name: string;
  photoUrl?: string | null;
  academyId?: string;
  academy?: { id: string; name: string };
  center?: { id: string; name: string } | null;
  linkCode?: string | null;
  interschoolConsent?: boolean;
}

export interface StaffRef {
  userId: string;
  user: { id: string; name: string };
}

export interface ClassSummary {
  id: string;
  title: string;
  sportKey: string;
  sport: { key: string; name: string };
  center: { id: string; name: string };
  coach?: StaffRef | null;
  level?: string | null;
  mode?: string | null;
  capacity?: number | null;
  gradeId?: string | null;
  school?: { id: string; name: string; lessonPlanAssignmentMode?: string | null } | null;
  _count?: { enrollments: number };
  timings?: { days: string[]; startTime: string; endTime: string }[];
}

export interface ScheduledSession {
  id: string;
  classId: string;
  class?: ClassSummary;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: "not_started" | "ongoing" | "completed";
  _count?: { attendanceRecords: number };
}

export interface Enquiry {
  id: string;
  childName: string;
  parentName: string;
  phone?: string | null;
  sportKey?: string | null;
  status: string;
  temperature?: "hot" | "warm" | "cold" | null;
  createdAt: string;
}

export interface Drill {
  id: string;
  title: string;
  sportKey: string;
  skillCategory?: string | null;
  level?: string | null;
  durationMin?: number | null;
  description?: string | null;
  media?: { type: "video" | "diagram"; url: string }[];
}

export interface LessonPlanStep {
  id?: string;
  drillId?: string;
  drillTitle?: string;
  title?: string;
  durationMin?: number;
  notes?: string;
}

export interface LessonPlan {
  id: string;
  title: string;
  sportKey?: string | null;
  sessionFlow?: LessonPlanStep[];
  status?: string;
}

export interface Assessment {
  id: string;
  clientId: string;
  drillId?: string | null;
  drill?: { id: string; title: string; sportKey: string } | null;
  recorder?: { id: string; name: string } | null;
  assessedAt: string;
  timeTakenSec?: number | string | null;
  repsCompleted?: number | null;
  accuracyPct?: number | string | null;
  distanceM?: number | string | null;
  speedMps?: number | string | null;
  errorCount?: number | null;
  enduranceTimeSec?: number | string | null;
  staminaIndex?: number | string | null;
  overallRating?: number | string | null;
  coachNote?: string | null;
}

export interface Rating {
  clientId: string;
  sportKey: string;
  formatType: string;
  currentRating: number | string;
  matchesPlayed: number;
  isProvisional: boolean;
  confidence: "low" | "medium" | "high";
  reliabilityPct?: number;
}

export interface RatingTransaction {
  id: string;
  createdAt: string;
  preRating: number | string;
  postRating: number | string;
  delta: number | string;
  fixture?: { id: string; scheduledAt: string; matchType: string } | null;
}

export interface InterschoolEvent {
  id: string;
  hostAcademyId: string;
  name: string;
  sports: string[];
  formatType: string;
  ageBands: string[];
  status: string;
  startDate: string;
  endDate: string;
  payToJoin?: boolean;
  pricePerHead?: number | string | null;
}

export interface EntrantClient {
  id: string;
  name: string;
  academyId: string;
}

export interface Fixture {
  id: string;
  eventId?: string | null;
  sportKey: string;
  sport?: { key: string; name: string };
  formatType: string;
  entrantA: string[];
  entrantB: string[];
  entrantAClients?: EntrantClient[];
  entrantBClients?: EntrantClient[];
  matchType: string;
  status: string;
  scheduledAt?: string | null;
  venue?: string | null;
  event?: { id: string; name: string } | null;
  resultSummary?: { winnerSide?: "A" | "B" | "draw"; scoreDisplay?: string; margin?: number | string } | null;
}
