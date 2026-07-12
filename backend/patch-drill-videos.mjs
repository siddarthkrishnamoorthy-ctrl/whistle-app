// One-off: backfill YouTube demo videos onto any existing library/academy
// drills that were seeded before the master library carried media. Idempotent.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const LIBRARY_VIDEOS = {
  cricket: ["I9YU6vKV5B8", "1n6DPBQhOsw"],
  football: ["6dpBcJllYYw", "ymkZ4dCbnBI"],
  badminton: ["IX0V56ZuG9w", "8j2lWKegYbc"],
  swimming: ["cyVOWXtqAlA", "8oT7bJq5jNs"],
  tennis: ["6yFDF1EYWY8", "8vGqkG3xw3E"],
  basketball: ["Ai6cY6exp_w", "1z8vT6nQKKM"],
  volleyball: ["6R1sQnhBpjM", "x0V0lD8u9ZI"],
  hockey: ["vlz6cUeYCbo", "Z1cM4cVYq5g"],
  table_tennis: ["YZnGCBM0PQU", "WOnbUZgTPBQ"],
  track_and_field: ["4beg5TDVrGY", "IX0V56ZuG9w"],
};
const DEFAULT = ["4beg5TDVrGY", "6dpBcJllYYw"];

const hasVideo = (media) =>
  Array.isArray(media) && media.some((m) => m?.type === "video" && String(m?.url ?? "").includes("youtube"));

const drills = await prisma.drill.findMany();
let patched = 0;
for (const d of drills) {
  if (hasVideo(d.media)) continue;
  const [warmVid, coreVid] = LIBRARY_VIDEOS[d.sportKey] ?? DEFAULT;
  const vid = /warm-?up/i.test(d.title) ? warmVid : coreVid;
  const media = [
    ...(Array.isArray(d.media) ? d.media.filter((m) => m?.type !== "video") : []),
    { type: "video", url: `https://www.youtube.com/watch?v=${vid}` },
  ];
  await prisma.drill.update({ where: { id: d.id }, data: { media } });
  patched++;
}
console.log(`Patched ${patched} drill(s) that were missing a YouTube video (of ${drills.length} total).`);
await prisma.$disconnect();
