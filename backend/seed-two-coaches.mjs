// Seeds two coach logins on the demo academy so the lesson-plan delivery modes
// can be tested end to end:
//   • coach.calendar@whistle.test  — a CALENDAR (timetable) class with sessions
//   • coach.classwise@whistle.test — a GRADE-SEQUENCE (age-band) class
// Both get a curriculum track (grade + sport) filled with lesson plans that
// each carry drills, so the coach can open a plan and see its session flow.
// Idempotent: re-running cleans its own prior rows first. Password: whistle123.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const PW = "whistle123";

const BANDS = {
  "Grade 5": { ageBand: "Development", ageMin: 9, ageMax: 11, classMin: "Class 4", classMax: "Class 6", classLabel: "Class 4 - Class 6" },
  "Grade 8": { ageBand: "Performance", ageMin: 12, ageMax: 14, classMin: "Class 7", classMax: "Class 9", classLabel: "Class 7 - Class 9" },
};

async function upsertCoach(academyId, centerId, email, name) {
  const passwordHash = await bcrypt.hash(PW, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role: "coach", academyId },
    create: { email, name, role: "coach", academyId, passwordHash },
  });
  await prisma.staffProfile.upsert({
    where: { userId: user.id },
    update: { centerId, skills: ["football"] },
    create: { userId: user.id, centerId, skills: ["football"] },
  });
  return user;
}

async function buildTrackWithPlans(academyId, sportKey, grade, weekTitles) {
  const band = BANDS[grade.name];
  // Fresh lesson plans for this grade (cleanup handled by caller).
  const plans = [];
  for (let i = 0; i < weekTitles.length; i++) {
    const drills = await prisma.drill.findMany({ where: { sportKey }, take: 2 });
    const sessionFlow = drills.map((d, idx) => ({
      order: idx,
      drillId: d.id,
      drillTitle: d.title,
      durationMin: d.durationMin ?? 15,
      category: d.skillCategory ?? undefined,
    }));
    const plan = await prisma.lessonPlan.create({
      data: {
        academyId,
        title: weekTitles[i],
        sportKey,
        level: "intermediate",
        ageBand: band.ageBand,
        ageMin: band.ageMin,
        ageMax: band.ageMax,
        classMin: band.classMin,
        classMax: band.classMax,
        classLabel: band.classLabel,
        goals: `Week ${i + 1}: build on the previous session's skills.`,
        objectives: ["Warm up", "Core skill focus", "Small-sided game"],
        whatToBring: [...new Set(drills.flatMap((d) => d.equipment ?? []))],
        targetDurationMin: sessionFlow.reduce((s, f) => s + f.durationMin, 0) || 60,
        sessionFlow,
        status: "active",
      },
    });
    plans.push(plan);
  }
  const track = await prisma.curriculumTrack.upsert({
    where: { academyId_sportKey_gradeId: { academyId, sportKey, gradeId: grade.id } },
    update: { title: `${grade.name} ${sportKey} pathway` },
    create: { academyId, sportKey, gradeId: grade.id, title: `${grade.name} ${sportKey} pathway` },
  });
  // reset items, then add ours in order
  await prisma.curriculumItem.deleteMany({ where: { curriculumTrackId: track.id } });
  for (let i = 0; i < plans.length; i++) {
    await prisma.curriculumItem.create({
      data: { curriculumTrackId: track.id, lessonPlanId: plans[i].id, sequenceNo: i + 1 },
    });
  }
  return { track, plans };
}

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: "admin@whistle.test" } });
  if (!admin?.academyId) throw new Error("admin@whistle.test / demo academy not found");
  const academyId = admin.academyId;

  let center = await prisma.center.findFirst({ where: { academyId } });
  if (!center) center = await prisma.center.create({ data: { academyId, name: "Demo Center" } });

  const sportKey = "football";
  const g5 = await prisma.grade.findFirst({ where: { academyId, name: "Grade 5" } });
  const g8 = await prisma.grade.findFirst({ where: { academyId, name: "Grade 8" } });
  if (!g5 || !g8) throw new Error("Grade 5 / Grade 8 not found for academy");

  // ── cleanup prior run ──────────────────────────────────────────────────
  const seedClassTitles = ["Demo: Calendar Football (Grade 5)", "Demo: Class-wise Football (Grade 8)"];
  const oldClasses = await prisma.class.findMany({ where: { title: { in: seedClassTitles } } });
  const oldClassIds = oldClasses.map((c) => c.id);
  if (oldClassIds.length) {
    const oldSessions = await prisma.scheduledSession.findMany({ where: { classId: { in: oldClassIds } }, select: { id: true } });
    const oldSessionIds = oldSessions.map((s) => s.id);
    // Remove every child that references the classes/sessions before deleting them.
    await prisma.sessionLessonDelivery.deleteMany({ where: { scheduledSessionId: { in: oldSessionIds } } }).catch(() => {});
    await prisma.attendanceRecord.deleteMany({ where: { scheduledSessionId: { in: oldSessionIds } } }).catch(() => {});
    await prisma.scheduledSession.deleteMany({ where: { classId: { in: oldClassIds } } });
    await prisma.classSequenceProgress.deleteMany({ where: { classId: { in: oldClassIds } } }).catch(() => {});
    await prisma.classPlan.deleteMany({ where: { classId: { in: oldClassIds } } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { classId: { in: oldClassIds } } }).catch(() => {});
    await prisma.class.deleteMany({ where: { id: { in: oldClassIds } } });
  }
  // Old seed lesson plans (identified by our week titles) — drop their curriculum items first.
  const oldPlans = await prisma.lessonPlan.findMany({
    where: { academyId, title: { startsWith: "Football Skills — Week" } },
  });
  await prisma.curriculumItem.deleteMany({ where: { lessonPlanId: { in: oldPlans.map((p) => p.id) } } });
  await prisma.lessonPlan.deleteMany({ where: { id: { in: oldPlans.map((p) => p.id) } } });

  // ── coaches ────────────────────────────────────────────────────────────
  const coachCal = await upsertCoach(academyId, center.id, "coach.calendar@whistle.test", "Coach Calendar");
  const coachSeq = await upsertCoach(academyId, center.id, "coach.classwise@whistle.test", "Coach Class-wise");

  // ── tracks + plans ───────────────────────────────────────────────────────
  const calBuild = await buildTrackWithPlans(academyId, sportKey, g5, [
    "Football Skills — Week 1: Ball Control",
    "Football Skills — Week 2: Passing",
    "Football Skills — Week 3: Shooting",
  ]);
  const seqBuild = await buildTrackWithPlans(academyId, sportKey, g8, [
    "Football Skills — Week 1: Positioning",
    "Football Skills — Week 2: Set Pieces",
    "Football Skills — Week 3: Match Play",
  ]);

  // ── classes ──────────────────────────────────────────────────────────────
  const calClass = await prisma.class.create({
    data: {
      centerId: center.id,
      title: seedClassTitles[0],
      sportKey,
      gradeId: g5.id,
      coachId: coachCal.id,
      lessonPlanAssignmentMode: "calendar",
      status: "active",
    },
  });
  const seqClass = await prisma.class.create({
    data: {
      centerId: center.id,
      title: seedClassTitles[1],
      sportKey,
      gradeId: g8.id,
      coachId: coachSeq.id,
      lessonPlanAssignmentMode: "grade_sequence",
      status: "active",
    },
  });

  // ── scheduled sessions for the calendar class (upcoming) ──────────────────
  // Within the coach app's 14-day schedule window (server date 2026-07-20).
  const dates = ["2026-07-22", "2026-07-24", "2026-07-27", "2026-07-29", "2026-08-01"];
  for (const d of dates) {
    await prisma.scheduledSession.create({
      data: {
        classId: calClass.id,
        sessionDate: new Date(`${d}T00:00:00Z`),
        startTime: new Date("1970-01-01T06:00:00Z"),
        endTime: new Date("1970-01-01T07:30:00Z"),
        status: "not_started",
      },
    });
  }

  console.log(JSON.stringify({
    academyId,
    calendarCoach: { email: "coach.calendar@whistle.test", class: calClass.title, sessions: dates.length, track: calBuild.plans.length + " lessons" },
    classwiseCoach: { email: "coach.classwise@whistle.test", class: seqClass.title, track: seqBuild.plans.length + " lessons" },
  }, null, 2));
}

main()
  .catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
