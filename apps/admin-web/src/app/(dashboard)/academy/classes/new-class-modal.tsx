"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/modal";
import { Field, SelectField } from "@/components/ui";
import { useApiList } from "@/lib/hooks";
import type { Center, ClassMode, Grade, SkillLevel, Sport, StaffProfile } from "@/lib/types";

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export interface CreateClassPayload {
  title: string;
  sportKey: string;
  centerId: string;
  level?: SkillLevel;
  mode?: ClassMode;
  capacity?: number;
  coachId?: string;
  timings?: { days: string[]; startTime: string; endTime: string }[];
  gradeId?: string;
  section?: string;
  schoolId?: string;
  lessonPlanAssignmentMode?: "calendar" | "grade_sequence";
}

interface SchoolOption {
  id: string;
  name: string;
}

export function NewClassModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (dto: CreateClassPayload) => Promise<void>;
}) {
  const { data: sports } = useApiList<Sport>("/sports");
  const { data: centers } = useApiList<Center>("/centers");
  const { data: staff } = useApiList<StaffProfile>("/staff");
  const { data: grades } = useApiList<Grade>("/grades");
  const { data: schools } = useApiList<SchoolOption>("/schools");
  const coaches = staff.filter((s) => s.user.role === "coach" || s.user.role === "head_coach");

  const [title, setTitle] = useState("");
  const [sportKey, setSportKey] = useState("");
  const [level, setLevel] = useState<SkillLevel>("beginner");
  const [mode, setMode] = useState<ClassMode>("offline");
  const [centerId, setCenterId] = useState("");
  const [capacity, setCapacity] = useState("");
  const [coachId, setCoachId] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("07:30");
  const [gradeId, setGradeId] = useState("");
  const [section, setSection] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [lessonPlanMode, setLessonPlanMode] = useState<"calendar" | "grade_sequence">("calendar");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setSportKey("");
    setLevel("beginner");
    setMode("offline");
    setCenterId("");
    setCapacity("");
    setCoachId("");
    setDays([]);
    setGradeId("");
    setSection("");
    setSchoolId("");
    setLessonPlanMode("calendar");
    setError(null);
  }

  function toggleDay(day: string) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSubmit() {
    if (!title.trim() || !sportKey || !centerId) {
      setError("Title, Skill and Center are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreated({
        title: title.trim(),
        sportKey,
        centerId,
        level,
        mode,
        capacity: capacity ? Number(capacity) : undefined,
        coachId: coachId || undefined,
        timings: days.length > 0 ? [{ days, startTime, endTime }] : undefined,
        gradeId: gradeId || undefined,
        section: section || undefined,
        schoolId: schoolId || undefined,
        lessonPlanAssignmentMode: lessonPlanMode,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create class.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New Class"
      subtitle="Set up a class, schedule and plans"
      wide
      footer={
        <ModalFooter
          onCancel={() => {
            reset();
            onClose();
          }}
          onSubmit={handleSubmit}
          submitLabel="Create Class"
          submitting={submitting}
        />
      }
    >
      <Field label="Title *" placeholder="e.g. Cricket – Junior Squad" value={title} onChange={(e) => setTitle(e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Skill *" value={sportKey} onChange={(e) => setSportKey(e.target.value)}>
          <option value="">Select a sport…</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Level" value={level} onChange={(e) => setLevel(e.target.value as SkillLevel)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="elite">Elite</option>
        </SelectField>
      </div>

      <div>
        <span className="mb-1.5 block text-sm text-text-secondary">How do you conduct your class?</span>
        <div className="flex gap-2">
          {(["offline", "online", "both"] as ClassMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full border px-4 py-1.5 text-sm capitalize ${
                mode === m ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Center *" value={centerId} onChange={(e) => setCenterId(e.target.value)}>
          <option value="">Select a center…</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <Field label="Capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Assigned coach" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
          <option value="">Unassigned</option>
          {coaches.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.user.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Lesson plan scheduling for this class *"
          value={lessonPlanMode}
          onChange={(e) => setLessonPlanMode(e.target.value as "calendar" | "grade_sequence")}
        >
          <option value="calendar">Via class calendar — coach sees plans on scheduled sessions</option>
          <option value="grade_sequence">Grade-wise sequential — coach follows the curriculum order</option>
        </SelectField>

        <SelectField label="School (partner school class)" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
          <option value="">No school — academy class</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Grade (school customers)" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
          <option value="">No grade — sports academy class</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </SelectField>
        {gradeId && <Field label="Section" placeholder="e.g. A" value={section} onChange={(e) => setSection(e.target.value)} />}
      </div>

      <div>
        <span className="mb-1.5 block text-sm text-text-secondary">Weekly timing</span>
        <div className="mb-2 flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => toggleDay(d.key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                days.includes(d.key) ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Field label="End time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
