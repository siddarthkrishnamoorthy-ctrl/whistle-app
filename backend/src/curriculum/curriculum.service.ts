import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateTrackDto } from "./dto/create-track.dto";
import type { AddItemDto } from "./dto/add-item.dto";
import type { ReorderItemsDto } from "./dto/reorder-items.dto";

@Injectable()
export class CurriculumService {
  constructor(private prisma: PrismaService) {}

  findTracks(academyId: string, sportKey?: string, gradeId?: string) {
    return this.prisma.curriculumTrack.findMany({
      where: { academyId, ...(sportKey ? { sportKey } : {}), ...(gradeId ? { gradeId } : {}) },
      include: {
        grade: true,
        sport: true,
        items: { orderBy: { sequenceNo: "asc" }, include: { lessonPlan: { select: { id: true, title: true } } } },
      },
    });
  }

  async createTrack(academyId: string, dto: CreateTrackDto) {
    const grade = await this.prisma.grade.findUnique({ where: { id: dto.gradeId } });
    if (!grade || grade.academyId !== academyId) throw new ForbiddenException("Grade not in this academy.");
    return this.prisma.curriculumTrack.create({
      data: { academyId, sportKey: dto.sportKey, gradeId: dto.gradeId, title: dto.title },
    });
  }

  private async findTrackOrThrow(academyId: string, trackId: string) {
    const track = await this.prisma.curriculumTrack.findUnique({ where: { id: trackId } });
    if (!track) throw new NotFoundException("Curriculum track not found.");
    if (track.academyId !== academyId) throw new ForbiddenException();
    return track;
  }

  // BRD 4.5 — "moving Lesson 7 to position 3 automatically renumbers 3
  // through 7, never leaving a gap or duplicate." Implemented by shifting
  // every existing item at or after the insert position up by one before
  // placing the new item, keeping sequence_no a contiguous 1..N run.
  async addItem(academyId: string, trackId: string, dto: AddItemDto) {
    await this.findTrackOrThrow(academyId, trackId);
    const lessonPlan = await this.prisma.lessonPlan.findUnique({ where: { id: dto.lessonPlanId } });
    if (!lessonPlan || lessonPlan.academyId !== academyId) throw new ForbiddenException("Lesson plan not in this academy.");

    const existingCount = await this.prisma.curriculumItem.count({ where: { curriculumTrackId: trackId } });
    const position = Math.min(dto.sequenceNo ?? existingCount + 1, existingCount + 1);

    // Shifted highest-sequence-first, one row at a time: a single bulk
    // updateMany here can hit the (curriculumTrackId, sequenceNo) unique
    // constraint mid-statement, since Postgres doesn't guarantee it applies
    // the increment to rows in descending order (e.g. seq 1 could be bumped
    // to 2 before the existing seq-2 row is moved out of the way).
    const toShift = await this.prisma.curriculumItem.findMany({
      where: { curriculumTrackId: trackId, sequenceNo: { gte: position } },
      orderBy: { sequenceNo: "desc" },
    });

    return this.prisma.$transaction(async (tx) => {
      for (const item of toShift) {
        await tx.curriculumItem.update({ where: { id: item.id }, data: { sequenceNo: item.sequenceNo + 1 } });
      }
      return tx.curriculumItem.create({
        data: { curriculumTrackId: trackId, lessonPlanId: dto.lessonPlanId, sequenceNo: position },
      });
    });
  }

  // BRD 4.10 — drag-and-drop reorder; server re-derives a contiguous 1..N
  // from the submitted order, so the client only needs to send an ordering,
  // never sequence numbers itself.
  async reorderItems(academyId: string, trackId: string, dto: ReorderItemsDto) {
    await this.findTrackOrThrow(academyId, trackId);
    const items = await this.prisma.curriculumItem.findMany({ where: { curriculumTrackId: trackId } });
    const byLessonPlan = new Map(items.map((i) => [i.lessonPlanId, i]));
    if (dto.lessonPlanIds.length !== items.length || dto.lessonPlanIds.some((id) => !byLessonPlan.has(id))) {
      throw new BadRequestException("Reorder list must include exactly the track's current lesson plans.");
    }
    // Two-phase update: an arbitrary permutation can't be applied as direct
    // target assignments in one pass without risking an intermediate
    // (curriculumTrackId, sequenceNo) collision (e.g. swapping items 1↔2).
    // Shifting everything to a non-overlapping negative range first, then
    // to final values, guarantees no collision regardless of the target order.
    return this.prisma.$transaction(async (tx) => {
      for (const lessonPlanId of dto.lessonPlanIds) {
        const item = byLessonPlan.get(lessonPlanId)!;
        await tx.curriculumItem.update({ where: { id: item.id }, data: { sequenceNo: -(item.sequenceNo + 1) } });
      }
      for (const [i, lessonPlanId] of dto.lessonPlanIds.entries()) {
        await tx.curriculumItem.update({ where: { id: byLessonPlan.get(lessonPlanId)!.id }, data: { sequenceNo: i + 1 } });
      }
      return tx.curriculumItem.findMany({ where: { curriculumTrackId: trackId }, orderBy: { sequenceNo: "asc" } });
    });
  }

  async removeItem(academyId: string, trackId: string, itemId: string) {
    await this.findTrackOrThrow(academyId, trackId);
    const item = await this.prisma.curriculumItem.findUnique({ where: { id: itemId } });
    if (!item || item.curriculumTrackId !== trackId) throw new NotFoundException("Curriculum item not found.");

    // Same unique-constraint hazard as addItem/reorderItems — shift the
    // gap closed one row at a time, ascending, so each decrement lands on
    // a slot the previous iteration just vacated.
    const toShift = await this.prisma.curriculumItem.findMany({
      where: { curriculumTrackId: trackId, sequenceNo: { gt: item.sequenceNo } },
      orderBy: { sequenceNo: "asc" },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.curriculumItem.delete({ where: { id: itemId } });
      for (const shiftItem of toShift) {
        await tx.curriculumItem.update({ where: { id: shiftItem.id }, data: { sequenceNo: shiftItem.sequenceNo - 1 } });
      }
      return { removed: true };
    });
  }

  // Lazily links a grade-anchored Class to its (Sport, Grade) Curriculum
  // Track and ensures a cursor exists — BRD 4.6: "this link is automatic
  // when grade_id is set on the Class." Returns null for a Class with no
  // gradeId (pure sports-academy classes never enter this system).
  private async getOrCreateProgress(academyId: string, classId: string) {
    const klass = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!klass) throw new NotFoundException("Class not found.");
    if (!klass.gradeId) return null;

    const track = await this.prisma.curriculumTrack.upsert({
      where: { academyId_sportKey_gradeId: { academyId, sportKey: klass.sportKey, gradeId: klass.gradeId } },
      create: { academyId, sportKey: klass.sportKey, gradeId: klass.gradeId },
      update: {},
    });
    return this.prisma.classSequenceProgress.upsert({
      where: { classId },
      create: { classId, curriculumTrackId: track.id, nextSequenceNo: 1 },
      update: {},
    });
  }

  // BRD 4.10 GET /classes/:id/next-lesson — powers the Coach App "Today's
  // lesson" card and the Parent App progress chip.
  async nextLesson(academyId: string, classId: string) {
    const progress = await this.getOrCreateProgress(academyId, classId);
    if (!progress) return { hasCurriculum: false };

    const totalLessons = await this.prisma.curriculumItem.count({
      where: { curriculumTrackId: progress.curriculumTrackId },
    });
    const item = await this.prisma.curriculumItem.findUnique({
      where: { curriculumTrackId_sequenceNo: { curriculumTrackId: progress.curriculumTrackId, sequenceNo: progress.nextSequenceNo } },
      include: { lessonPlan: true },
    });
    return {
      hasCurriculum: true,
      syllabusComplete: !item,
      sequenceNo: progress.nextSequenceNo,
      totalLessons,
      lessonPlan: item?.lessonPlan ?? null,
    };
  }

  // BRD 4.10 GET /classes/:id/syllabus-progress — backs the "Lesson 4 of 12" bar.
  async syllabusProgress(academyId: string, classId: string) {
    const progress = await this.getOrCreateProgress(academyId, classId);
    if (!progress) return { hasCurriculum: false };

    const items = await this.prisma.curriculumItem.findMany({
      where: { curriculumTrackId: progress.curriculumTrackId },
      orderBy: { sequenceNo: "asc" },
      include: { lessonPlan: { select: { id: true, title: true } }, deliveries: { where: { session: { classId } } } },
    });
    return {
      hasCurriculum: true,
      nextSequenceNo: progress.nextSequenceNo,
      totalLessons: items.length,
      deliveredCount: items.filter((i) => i.deliveries.length > 0).length,
      items: items.map((i) => ({
        sequenceNo: i.sequenceNo,
        lessonPlanId: i.lessonPlan.id,
        lessonPlanTitle: i.lessonPlan.title,
        delivered: i.deliveries.length > 0,
      })),
    };
  }

  // Called from ScheduleService.complete() (extended behaviour, BRD 4.10).
  // Returns silently for classes with no curriculum — pure sports-academy
  // sessions complete exactly as before this addendum.
  async advanceCursorForSession(academyId: string, sessionId: string, classId: string, oneOff: boolean) {
    if (oneOff) return;
    const progress = await this.getOrCreateProgress(academyId, classId);
    if (!progress) return;

    const item = await this.prisma.curriculumItem.findUnique({
      where: { curriculumTrackId_sequenceNo: { curriculumTrackId: progress.curriculumTrackId, sequenceNo: progress.nextSequenceNo } },
    });
    if (!item) return; // BRD 4.6 #4 — syllabus already exhausted; nothing to advance or deliver.

    await this.prisma.$transaction([
      this.prisma.sessionLessonDelivery.create({ data: { sessionId, curriculumItemId: item.id } }),
      this.prisma.classSequenceProgress.update({
        where: { classId },
        data: { nextSequenceNo: { increment: 1 }, updatedAt: new Date() },
      }),
    ]);
  }
}
