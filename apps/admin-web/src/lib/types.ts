// Mirrors backend/prisma/schema.prisma model shapes as returned over the API
// (camelCase field names, Decimal fields serialize as strings over JSON).

export interface Sport {
  key: string;
  name: string;
  icon: string | null;
}

export interface Center {
  id: string;
  academyId: string;
  name: string;
  address: string | null;
  geoLat: string | null;
  geoLng: string | null;
  geoRadiusM: number | null;
}

export type PlanType = "subscription" | "trial" | "one_time";

export interface Plan {
  id: string;
  academyId: string;
  title: string;
  type: PlanType;
  durationValue: number | null;
  durationUnit: string | null;
  fee: string;
  sessionsIncluded: number | null;
  makeupsIncluded: number;
  autoRenewDefault: boolean;
  visibility: string;
  classesCount?: number;
  clientsCount?: number;
  classPlans?: { class: WhistleClass }[];
}

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "elite";
export type ClassMode = "offline" | "online" | "both";
export type ClassStatus = "active" | "inactive";

export interface ClassTiming {
  days: string[];
  startTime: string;
  endTime: string;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export interface StaffProfile {
  userId: string;
  skills: string[];
  salaryBasis: string | null;
  salaryAmount: string | null;
  reportingManagerId: string | null;
  centerId: string | null;
  user: StaffUser;
  center: Center | null;
}

export interface WhistleClass {
  id: string;
  centerId: string;
  title: string;
  sportKey: string;
  level: SkillLevel | null;
  mode: ClassMode | null;
  capacity: number | null;
  coachId: string | null;
  status: ClassStatus;
  timings: ClassTiming[] | null;
  sport: Sport;
  center: Center;
  coach: StaffProfile | null;
  classPlans?: { plan: Plan }[];
  lessonPlans?: LessonPlan[];
  enrollments?: Enrollment[];
  _count?: { enrollments: number; classPlans: number };
  gradeId?: string | null;
  section?: string | null;
}

export interface EnrollmentClient {
  id: string;
  name: string;
}

export interface Enrollment {
  id: string;
  clientId: string;
  planId: string;
  classId: string;
  status: string;
  client: EnrollmentClient;
  plan: Plan;
}

export type AttendanceStatus = "present" | "late" | "absent";

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  clientId: string | null;
  status: AttendanceStatus;
}

export type SessionStatus = "not_started" | "ongoing" | "completed";

export interface ScheduledSession {
  id: string;
  classId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  class: WhistleClass;
  attendanceRecords?: AttendanceRecord[];
  _count?: { attendanceRecords: number };
}

export interface Drill {
  id: string;
  academyId: string;
  title: string;
  sportKey: string;
  skillCategory: string | null;
  ageGroups: string[];
  level: SkillLevel | null;
  durationMin: number | null;
  equipment: string[];
  description: string | null;
  media: { type: "video" | "diagram"; url: string }[] | null;
  standardParameters: Record<string, boolean> | null;
  sport: Sport;
}

export interface SessionFlowStep {
  order: number;
  drillId: string;
  drillTitle: string;
  durationMin: number;
  category?: string;
}

export interface LessonPlan {
  id: string;
  // null = Whistle's platform repository (owner-curated master)
  academyId: string | null;
  classId: string | null;
  semesterId: string | null;
  title: string;
  sportKey: string | null;
  level: string | null;
  goals: string | null;
  objectives: string[];
  whatToBring: string[];
  targetDurationMin: number | null;
  sessionFlow: SessionFlowStep[];
  status: "active" | "upcoming" | "completed";
  class: WhistleClass | null;
  sport: Sport | null;
}

export interface Semester {
  id: string;
  academyId: string;
  title: string;
  durationWeeks: number | null;
  focusAreas: string[];
  objective: string | null;
  status: "planned" | "in_progress" | "completed";
  lessonPlans: LessonPlan[];
  lessonPlansTotal: number;
  lessonPlansDone: number;
}

export type EnquiryTemperature = "hot" | "warm" | "cold";
export type EnquiryStage = "lead" | "closed" | "junk";

export interface ActivityEntry {
  text: string;
  at: string;
  by?: string;
}

export interface Enquiry {
  id: string;
  academyId: string;
  name: string;
  parentName: string | null;
  email: string | null;
  gender: string | null;
  birthday: string | null;
  phone: string | null;
  sportKey: string | null;
  level: string | null;
  centerId: string | null;
  status: EnquiryTemperature;
  stage: EnquiryStage;
  assignedTo: string | null;
  followUpDate: string | null;
  note: string | null;
  activityLog: ActivityEntry[];
  convertedClientId: string | null;
  sport: Sport | null;
  assignedStaff: { id: string; name: string } | null;
}

export type EnrollmentStatus = "active" | "due" | "overdue" | "renewed" | "stopped";

export interface FullEnrollment {
  id: string;
  clientId: string;
  planId: string;
  classId: string;
  startDate: string;
  endDate: string;
  sessionsUsed: number;
  sessionsLeft: number | null;
  autoRenew: boolean;
  status: EnrollmentStatus;
  client: Client;
  plan: Plan;
  class: WhistleClass;
}

export interface ClientInvoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  status: "pending" | "paid";
  issuedAt: string;
  plan?: { id: string; title: string } | null;
}

export interface Client {
  id: string;
  academyId: string;
  centerId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  photoUrl: string | null;
  linkCode: string | null;
  interschoolConsent: boolean;
  center?: Center | null;
  enrollments?: FullEnrollment[];
  invoices?: ClientInvoice[];
  guardians?: { user: { id: string; name: string; email: string | null; phone: string | null } }[];
  balanceDue?: number;
  status?: string;
}

export interface InvoiceSummary {
  totalInvoiced: number;
  received: number;
  outstanding: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  status: "pending" | "paid";
  issuedAt: string;
  batchId?: string | null;
  client: { id: string; name: string };
  plan: { id: string; title: string } | null;
}

// Bulk payment: N invoices settled by one consolidated payment.
export interface InvoiceBatch {
  id: string;
  title: string;
  payerName: string | null;
  totalAmount: string;
  status: "pending" | "paid";
  paidAt: string | null;
  createdAt: string;
  invoices: { id: string; invoiceNumber: string; amount: string; status: string; client: { id: string; name: string } }[];
}

export interface AttendanceSummary {
  sessionsToday: number;
  markedPresent: number;
  absent: number;
  attendanceRate: number;
}

export interface AcademySettings {
  id: string;
  name: string;
  contactEmail: string | null;
  phone: string | null;
  website: string | null;
  settings: {
    policies?: { deductOnAbsence?: string; priorNoticeHours?: number; allowMakeupSessions?: boolean };
    paymentGateways?: { razorpay?: { connected: boolean }; googlePay?: { connected: boolean } };
  } | null;
  centers: Center[];
}

export interface ChatUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: ChatUser;
}

export interface ChatThread {
  id: string;
  type: "direct" | "group";
  name: string | null;
  members: ChatUser[];
  lastMessage: ChatMessage | null;
}

export interface NoticeBoardPost {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: ChatUser;
}

export interface WhatsappSettings {
  automatedReminders: boolean;
  invoiceGenerationAlerts: boolean;
  classCancellationNotices: boolean;
}

export interface ReportTotals {
  [key: string]: number;
}

export interface ReportResult<Row> {
  rows: Row[];
  totals: ReportTotals | null;
  implemented?: boolean;
}

// ─── Interschool Events & Rating Engine ────────────────────────────────

export type EventFormatType = "individual" | "pair" | "team";
export type EventStatus = "draft" | "scheduled" | "live" | "completed" | "closed";
export type InvitationStatus = "pending" | "accepted" | "declined";
export type EligibilityStatus = "pending" | "eligible" | "ineligible";
export type FixtureStatus = "draft" | "scheduled" | "live" | "pending_confirmation" | "completed" | "abandoned";
export type MatchType = "interschool" | "internal_ladder" | "practice";

export interface AcademyRef {
  id: string;
  name: string;
}

export interface InterschoolSettings {
  id: string;
  name: string;
  networkOptIn: boolean;
  showReliabilityScore: boolean;
}

export interface MemberSchool {
  id: string;
  name: string;
  centers: { id: string; name: string }[];
  schoolRatings: { sportKey: string; aggregateRating: string | null }[];
}

export interface InterschoolEvent {
  id: string;
  hostAcademyId: string;
  name: string;
  sports: string[];
  formatType: EventFormatType;
  ageBands: string[];
  startDate: string;
  endDate: string;
  status: EventStatus;
  entryRules: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  payToJoin: boolean;
  pricePerHead: string | null;
  hostAcademy: AcademyRef;
  invitations?: EventInvitation[];
  fixtures?: Fixture[];
  _count?: { fixtures: number; invitations: number; rosters: number };
}

export interface EventInvitation {
  id: string;
  eventId: string;
  invitedAcademyId: string;
  status: InvitationStatus;
  responseDeadline: string | null;
  event?: InterschoolEvent;
  invitedAcademy?: AcademyRef;
}

export interface EventRoster {
  id: string;
  eventId: string;
  academyId: string;
  sportKey: string;
  clientId: string;
  eligibilityStatus: EligibilityStatus;
  consentConfirmed: boolean;
  client: { id: string; name: string; dob: string | null };
  academy: AcademyRef;
  invoice?: { id: string; invoiceNumber: string; amount: string; status: "pending" | "paid" } | null;
}

export interface Fixture {
  id: string;
  eventId: string | null;
  sportKey: string;
  formatType: EventFormatType;
  entrantA: string[];
  entrantB: string[];
  scheduledAt: string | null;
  venue: string | null;
  matchType: MatchType;
  status: FixtureStatus;
  abandonReason: string | null;
  resultConfirmations: Record<string, { confirmedBy: string; confirmedAt: string }> | null;
  resultSummary: { winnerSide: "A" | "B" | "draw"; scoreDisplay: string; marginRatio?: number; enteredManually?: boolean } | null;
  sport?: Sport;
  event?: { id: string; name: string; hostAcademyId?: string } | null;
  scoringSessions?: ScoringSession[];
  playerMatchStats?: PlayerMatchStat[];
  entrantAClients?: { id: string; name: string; academyId: string }[];
  entrantBClients?: { id: string; name: string; academyId: string }[];
}

export interface ScoringSession {
  id: string;
  fixtureId: string;
  sportKey: string;
  formatType: string;
  periodState: Record<string, unknown>;
  officiatedBy: string | null;
  startedAt: string | null;
  endedAt: string | null;
  isOfflineCreated: boolean;
  syncedAt: string | null;
  events: ScoreEvent[];
}

export interface ScoreEvent {
  id: string;
  scoringSessionId: string;
  clientEventId: string;
  actionType: string;
  payload: Record<string, unknown> | null;
  enteredBy: string | null;
  clientTimestamp: string;
  serverReceivedAt: string;
}

export interface PlayerMatchStat {
  fixtureId: string;
  clientId: string;
  statFields: Record<string, unknown> | null;
  contributionWeight: string;
}

export interface ScoringTemplate {
  sportKey: string;
  formatType: EventFormatType;
  periodStructure: Record<string, unknown>;
  scoreFields: { key: string; label: string; type: string; options?: unknown[] }[];
  winCondition: { rule: string; marginAware?: boolean; marginUnit?: string };
  playerStatFields: { key: string; label: string }[] | null;
  displayFormat: string;
  sport?: Sport;
}

export interface Rating {
  clientId: string;
  sportKey: string;
  formatType: EventFormatType;
  currentRating: string;
  matchesPlayed: number;
  isProvisional: boolean;
  confidence: "low" | "medium" | "high";
  kFactorCurrent: string;
  lastUpdatedAt: string;
  reliabilityPct?: number;
  client?: { id: string; name: string; academyId: string; academy?: { name: string } };
}

export interface RatingTransaction {
  id: string;
  clientId: string;
  sportKey: string;
  formatType: string;
  fixtureId: string | null;
  overrideReason: string | null;
  overriddenBy: string | null;
  preRating: string;
  postRating: string;
  expectedScore: string;
  actualScore: string;
  kFactorUsed: string;
  contributionWeight: string;
  createdAt: string;
  fixture?: { id: string; scheduledAt: string | null; matchType: MatchType; entrantA: string[]; entrantB: string[] } | null;
}

// ─── Addendum v3 — Grade-Wise Curriculum Engine ────────────────────────────

export interface Grade {
  id: string;
  academyId: string;
  name: string;
  sortOrder: number;
}

export interface TimetablePreviewRow {
  rowIndex: number;
  grade: string;
  section: string;
  day: string;
  startTime: string;
  endTime: string;
  sport: string;
  center: string;
  coach: string;
  resolvedGradeId: string | null;
  resolvedSportKey: string | null;
  resolvedCenterId: string | null;
  resolvedCoachId: string | null;
  normalizedDay: string | null;
  unresolvedFields: string[];
  conflict: boolean;
}

export interface Timetable {
  id: string;
  academyId: string;
  termLabel: string | null;
  status: "processing" | "active" | "error";
  uploadedAt: string;
  previewData: { rows: TimetablePreviewRow[] } | null;
}

export interface CurriculumItem {
  id: string;
  curriculumTrackId: string;
  lessonPlanId: string;
  sequenceNo: number;
  lessonPlan: { id: string; title: string };
}

export interface CurriculumTrack {
  id: string;
  academyId: string;
  sportKey: string;
  gradeId: string;
  title: string | null;
  grade: Grade;
  sport: Sport;
  items: CurriculumItem[];
}

export interface NextLesson {
  hasCurriculum: boolean;
  syllabusComplete?: boolean;
  sequenceNo?: number;
  totalLessons?: number;
  lessonPlan?: LessonPlan | null;
}

export interface SyllabusProgress {
  hasCurriculum: boolean;
  nextSequenceNo?: number;
  totalLessons?: number;
  deliveredCount?: number;
  items?: { sequenceNo: number; lessonPlanId: string; lessonPlanTitle: string; delivered: boolean }[];
}

// Addendum v3 5.3/5.6 — Whistle's own SaaS billing of academies.
export interface PricingTier {
  id: string;
  name: string;
  minStudents: number;
  maxStudents: number | null;
  pricePerStudentMonth: string | null;
  currency: string;
}

export type PlatformSubscriptionStatus = "trial" | "active" | "past_due" | "cancelled" | "pending_quote";

export interface PlatformSubscription {
  id: string;
  academyId: string;
  declaredStrength: number;
  pricingTierId: string;
  billingCycle: "monthly" | "annual";
  status: PlatformSubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  tier: PricingTier;
}

export interface PlatformInvoice {
  id: string;
  academyId: string;
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  declaredStrengthSnapshot: number;
  actualActiveStudentsSnapshot: number;
  billableStudentCount: number;
  amount: string;
  status: "pending" | "paid" | "overdue";
  issuedAt: string;
}

export interface PlatformBillingUsage {
  subscription: PlatformSubscription;
  actualActiveStudents: number;
  billableStudentCount: number;
  estimatedAmount: number;
  recentInvoices: PlatformInvoice[];
}
