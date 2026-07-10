import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, ListRow, Pill, colors } from "@/components/ui";
import { formatDate, formatTime, type ClassSummary, type ScheduledSession } from "@whistle/shared";

// Delivery mode per class: the mode chosen at class creation wins, then the
// school setting, then the academy default. A coach with two classes can see
// the calendar view for one and the grade sequence for the other.
type AssignmentMode = "calendar" | "grade_sequence";

type ClassRow = ClassSummary & {
  lessonPlanAssignmentMode?: AssignmentMode | null;
  school?: { id: string; name: string; lessonPlanAssignmentMode?: AssignmentMode | null } | null;
};

interface AcademySettings {
  settings?: { lessonPlanAssignmentMode?: AssignmentMode } | null;
}

interface NextLesson {
  hasCurriculum: boolean;
  syllabusComplete?: boolean;
  sequenceNo?: number;
  totalLessons?: number;
  lessonPlan?: { id: string; title: string } | null;
}

interface CurriculumTrack {
  id: string;
  title?: string | null;
  sportKey: string;
  gradeId: string;
  grade: { id: string; name: string };
  sport: { key: string; name: string };
  items: { id: string; sequenceNo: number; lessonPlan: { id: string; title: string } }[];
}

interface SessionWithLesson {
  session: ScheduledSession;
  next: NextLesson | null;
}

export default function LessonsScreen() {
  const { user } = useAuth();
  const [calendarRows, setCalendarRows] = useState<SessionWithLesson[]>([]);
  const [tracks, setTracks] = useState<(CurriculumTrack & { schoolName?: string })[]>([]);
  const [nextByTrack, setNextByTrack] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.academyId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);

      const load = async () => {
        const academy = await apiJson<AcademySettings>("/settings").catch(() => null);
        const academyMode: AssignmentMode = academy?.settings?.lessonPlanAssignmentMode ?? "calendar";

        const myClasses = (await apiJson<ClassRow[]>("/classes").catch(() => [] as ClassRow[])).filter(
          (c) => c.coach?.userId === user.id
        );
        const modeFor = (c: ClassRow): AssignmentMode =>
          c.lessonPlanAssignmentMode ?? (c.school?.lessonPlanAssignmentMode as AssignmentMode) ?? academyMode;
        const calendarClassIds = new Set(myClasses.filter((c) => modeFor(c) === "calendar").map((c) => c.id));
        const sequenceClasses = myClasses.filter((c) => modeFor(c) === "grade_sequence");

        // Calendar view: upcoming sessions of calendar-mode classes, each
        // paired with the class's next lesson from the sequencing engine.
        const sessions = (await apiJson<ScheduledSession[]>("/schedule").catch(() => [] as ScheduledSession[]))
          .filter((s) => s.class?.coach?.userId === user.id && calendarClassIds.has(s.classId))
          .slice(0, 15);
        const nextByClass = new Map<string, NextLesson | null>();
        for (const classId of new Set(sessions.map((s) => s.classId))) {
          nextByClass.set(classId, await apiJson<NextLesson>(`/classes/${classId}/next-lesson`).catch(() => null));
        }
        if (cancelled) return;
        setCalendarRows(sessions.map((session) => ({ session, next: nextByClass.get(session.classId) ?? null })));

        // Sequence view: grade-wise tracks for grade_sequence-mode classes.
        if (sequenceClasses.length > 0) {
          const all = await apiJson<CurriculumTrack[]>("/curriculum-tracks").catch(() => [] as CurriculumTrack[]);
          const myKeys = new Map(
            sequenceClasses.filter((c) => c.gradeId).map((c) => [`${c.gradeId}|${c.sportKey}`, c])
          );
          const mine = all
            .filter((t) => myKeys.has(`${t.gradeId}|${t.sportKey}`))
            .map((t) => ({ ...t, schoolName: myKeys.get(`${t.gradeId}|${t.sportKey}`)?.school?.name }));

          const nexts: Record<string, number> = {};
          for (const c of sequenceClasses) {
            const next = await apiJson<NextLesson>(`/classes/${c.id}/next-lesson`).catch(() => null);
            const track = mine.find((t) => t.gradeId === c.gradeId && t.sportKey === c.sportKey);
            if (track && next?.hasCurriculum && next.sequenceNo) nexts[track.id] = next.sequenceNo;
          }
          if (cancelled) return;
          setTracks(mine);
          setNextByTrack(nexts);
        } else {
          setTracks([]);
        }
      };

      load().finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [user])
  );

  const empty = calendarRows.length === 0 && tracks.length === 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>Lesson Plans</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Delivered per your academy/school's assignment mode
        </Text>
      </View>

      {loading ? (
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      ) : empty ? (
        <EmptyState message="No lesson plans assigned to your classes yet." />
      ) : (
        <>
          {calendarRows.length > 0 ? (
            <View>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
                From your class calendar
              </Text>
              <View style={{ gap: 8 }}>
                {calendarRows.map(({ session, next }) => (
                  <ListRow
                    key={session.id}
                    title={`${formatDate(session.sessionDate)} · ${formatTime(session.startTime)} — ${session.class?.title ?? "Class"}`}
                    subtitle={
                      next?.hasCurriculum
                        ? next.syllabusComplete
                          ? "Syllabus complete 🎉"
                          : `Lesson ${next.sequenceNo} of ${next.totalLessons}: ${next.lessonPlan?.title ?? "—"}`
                        : "No curriculum linked to this class yet"
                    }
                    right={next?.hasCurriculum && !next.syllabusComplete ? <Pill tone="info">next up</Pill> : undefined}
                    onPress={next?.lessonPlan ? () => router.push(`/lesson-plans/${next.lessonPlan!.id}`) : undefined}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {tracks.map((track) => (
            <View key={track.id}>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
                {track.grade.name} · {track.sport.name}
                {track.schoolName ? ` — ${track.schoolName}` : ""}
                {track.title ? ` (${track.title})` : ""}
              </Text>
              <Card>
                <View style={{ gap: 10 }}>
                  {track.items.map((item, idx) => {
                    const isNext = nextByTrack[track.id] === item.sequenceNo;
                    const isDone = nextByTrack[track.id] != null && item.sequenceNo < nextByTrack[track.id];
                    return (
                      <View key={item.id}>
                        {idx > 0 ? (
                          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 10 }} />
                        ) : null}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Text style={{ color: isNext ? colors.accent : colors.textMuted, fontWeight: "800", width: 26 }}>
                            {item.sequenceNo}.
                          </Text>
                          <Text
                            onPress={() => router.push(`/lesson-plans/${item.lessonPlan.id}`)}
                            style={{
                              flex: 1,
                              color: isNext ? colors.textPrimary : colors.textSecondary,
                              fontWeight: isNext ? "700" : "400",
                              fontSize: 14,
                            }}
                          >
                            {item.lessonPlan.title}
                          </Text>
                          {isDone ? <Pill tone="success">done</Pill> : isNext ? <Pill tone="warning">next up</Pill> : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
