import { PrismaClient } from "@prisma/client";

// Sports are a shared, global catalogue (no academy_id — see TDD Section 5.1
// and BRD "extensible sports catalogue") — seed once, not per-academy.
const DEFAULT_SPORTS = [
  "Cricket",
  "Football",
  "Badminton",
  "Swimming",
  "Tennis",
  "Basketball",
  "Volleyball",
  "Hockey",
  "Table Tennis",
  "Track and Field",
  "Kabaddi",
  "Throwball",
  "Billiards",
];

const prisma = new PrismaClient();

async function main() {
  for (const name of DEFAULT_SPORTS) {
    const key = name.toLowerCase().replace(/\s+/g, "_");
    await prisma.sport.upsert({
      where: { key },
      update: {},
      create: { key, name },
    });
  }
  console.log(`Seeded ${DEFAULT_SPORTS.length} sports.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
