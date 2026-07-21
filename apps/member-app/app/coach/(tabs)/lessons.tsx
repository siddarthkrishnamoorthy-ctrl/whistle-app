import { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { ageBandForGrade } from "@/lib/age-bands";
import { Card, EmptyState, Pill, colors } from "@/components/ui";
import { formatDate, type ClassSummary, type ScheduledSession } from "@whistle/shared";

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
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
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
  // Age-band (grade-sequence) mode: let the coach pick which class's curriculum
  // to view; default to all.
  const shownTracks = selectedTrackId ? tracks.filter((t) => t.id === selectedTrackId) : tracks;

  // Calendar mode: group the upcoming sessions by class so Lessons shows each
  // class's NEXT lesson (curriculum) instead of re-listing every session — that
  // session list already lives on the Schedule tab.
  const calendarClasses = Object.values(
    calendarRows.reduce<Record<string, { classId: string; title: string; next: NextLesson | null; sessions: ScheduledSession[] }>>(
      (acc, { session, next }) => {
        const cid = session.classId;
        if (!acc[cid]) acc[cid] = { classId: cid, title: session.class?.title ?? "Class", next, sessions: [] };
        acc[cid].sessions.push(session);
        return acc;
      },
      {}
    )
  );

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
          {calendarClasses.length > 0 ? (
            <View>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
                Calendar classes — your next lesson
              </Text>
              <View style={{ gap: 8 }}>
                {calendarClasses.map((cc) => {
                  const next = cc.next;
                  const nextDate = cc.sessions[0]?.sessionDate;
                  return (
                    <Card key={cc.classId}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15, flex: 1 }}>{cc.title}</Text>
                        {next?.hasCurriculum && !next.syllabusComplete ? <Pill tone="info">next up</Pill> : null}
                      </View>
                      {next?.hasCurriculum ? (
                        next.syllabusComplete ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}>Syllabus complete 🎉</Text>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={next.lessonPlan ? () => router.push(`/coach/lesson-plans/${next.lessonPlan!.id}`) : undefined}
                            style={{ marginTop: 6 }}
                          >
                            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                              Lesson {next.sequenceNo} of {next.totalLessons}
                            </Text>
                            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginTop: 1 }}>
                              {next.lessonPlan?.title ?? "—"}
                            </Text>
                            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700", marginTop: 3 }}>▶ Open lesson plan</Text>
                          </TouchableOpacity>
                        )
                      ) : (
                        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>No curriculum linked to this class yet.</Text>
                      )}
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>
                        {cc.sessions.length} upcoming session{cc.sessions.length === 1 ? "" : "s"}
                        {nextDate ? ` · next ${formatDate(nextDate)}` : ""} · see the Schedule tab for dates
                      </Text>
                    </Card>
                  );
                })}
              </View>
            </View>
          ) : null}

          {tracks.length > 0 && (
            <View>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 6 }}>By age band — pick a class</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {[{ id: null as string | null, label: "All classes" }, ...tracks.map((t) => ({ id: t.id, label: `${t.grade.name} · ${t.sport.name}` }))].map((chip) => {
                  const active = selectedTrackId === chip.id;
                  return (
                    <TouchableOpacity
                      key={chip.id ?? "all"}
                      onPress={() => setSelectedTrackId(chip.id)}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? colors.accent : colors.border,
                        backgroundColor: active ? colors.accent : "transparent",
                      }}
                    >
                      <Text style={{ color: active ? colors.accentText : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>{chip.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {shownTracks.map((track) => (
            <View key={track.id}>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
                {track.grade.name} · {track.sport.name}
                {ageBandForGrade(track.grade.name) ? ` · ${ageBandForGrade(track.grade.name)} band` : ""}
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
                            onPress={() => router.push(`/coach/lesson-plans/${item.lessonPlan.id}`)}
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
