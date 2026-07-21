// Stock the platform Drill Bank with a proper library per sport, so the owner's
// New Lesson Plan picker (and every tenant's Drill Bank) has a real selection to
// choose from — not just the 2 originally seeded per sport. Idempotent: it only
// (re)creates its own template drills, keyed by a hidden marker in the title.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Skip sports whose "drills" are a different concept (puzzles / word lists).
const SKIP_SPORTS = new Set(["chess", "scrabble"]);

const BAND = {
  beginner: { ageBand: "Foundation", ageMin: 6, ageMax: 8, classMin: "Class 1", classMax: "Class 3", classLabel: "Class 1 - Class 3" },
  intermediate: { ageBand: "Development", ageMin: 9, ageMax: 11, classMin: "Class 4", classMax: "Class 6", classLabel: "Class 4 - Class 6" },
  advanced: { ageBand: "Performance", ageMin: 12, ageMax: 14, classMin: "Class 7", classMax: "Class 9", classLabel: "Class 7 - Class 9" },
  elite: { ageBand: "Elite", ageMin: 15, ageMax: 17, classMin: "Class 10", classMax: "Class 12", classLabel: "Class 10 - Class 12" },
};

// name, skill level, minutes, equipment, category, description
const TEMPLATES = [
  ["Dynamic Warm-up & Mobility", "beginner", 10, ["Cones"], "Warm-up", "Dynamic stretches and joint mobility to prepare the body for the session."],
  ["Agility Ladder Footwork", "beginner", 12, ["Agility ladder"], "Agility", "Ladder patterns to sharpen foot speed, rhythm and coordination."],
  ["Fundamentals & Control", "beginner", 15, ["Balls"], "Skills", "High-repetition control fundamentals to build a solid base."],
  ["Passing & Receiving", "intermediate", 15, ["Balls", "Cones"], "Skills", "Short and long passing accuracy and clean first touch under light pressure."],
  ["Attacking & Finishing", "intermediate", 18, ["Balls", "Goals"], "Attack", "Finishing scenarios from varied angles and distances."],
  ["Small-Sided Game", "intermediate", 20, ["Bibs", "Goals"], "Game", "Conditioned small-sided game that applies the session's focus."],
  ["Defensive Positioning", "advanced", 15, ["Cones", "Bibs"], "Defence", "1v1 and team-shape work to defend space and delay attacks."],
  ["Speed & Conditioning Circuit", "advanced", 12, ["Cones"], "Conditioning", "Interval sprints and a conditioning circuit to build engine."],
  ["Match-Intensity Scenario", "elite", 20, ["Bibs", "Goals"], "Game", "Full-intensity, decision-heavy game scenario for advanced squads."],
  ["High-Performance Set Play", "elite", 18, ["Balls", "Cones", "Goals"], "Tactics", "Rehearsed set-play patterns executed at competition tempo."],
];

const TEMPLATE_NAMES = TEMPLATES.map((t) => t[0]);

async function main() {
  const sports = await prisma.sport.findMany();
  let created = 0;
  let sportsDone = 0;
  for (const sport of sports) {
    if (SKIP_SPORTS.has(sport.key)) continue;
    // remove our previously-seeded template drills for this sport (platform-owned)
    await prisma.drill.deleteMany({ where: { academyId: null, sportKey: sport.key, title: { in: TEMPLATE_NAMES } } });
    for (const [name, level, dur, equipment, category, description] of TEMPLATES) {
      const b = BAND[level];
      await prisma.drill.create({
        data: {
          academyId: null,
          title: name,
          sportKey: sport.key,
          skillCategory: category,
          level,
          ageBand: b.ageBand,
          ageMin: b.ageMin,
          ageMax: b.ageMax,
          classMin: b.classMin,
          classMax: b.classMax,
          classLabel: b.classLabel,
          durationMin: dur,
          equipment,
          description: `${sport.name}: ${description}`,
        },
      });
      created++;
    }
    sportsDone++;
  }
  const total = await prisma.drill.count({ where: { academyId: null } });
  console.log(JSON.stringify({ sportsStocked: sportsDone, drillsCreated: created, platformDrillsTotal: total, perSport: TEMPLATES.length }, null, 2));
}

main()
  .catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
