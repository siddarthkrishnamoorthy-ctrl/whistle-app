"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/modal";
import { Field, SelectField, TextareaField } from "@/components/ui";
import { useApiList } from "@/lib/hooks";
import { AGE_BANDS, findAgeBand } from "@/lib/age-bands";
import type { Sport, WhistleClass } from "@/lib/types";

export interface CreateLessonPlanPayload {
  title: string;
  classId?: string;
  sportKey?: string;
  level?: string;
  ageBand?: string;
  goals?: string;
  targetDurationMin?: number;
}

export function NewLessonPlanModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (dto: CreateLessonPlanPayload) => Promise<void>;
}) {
  const { data: sports } = useApiList<Sport>("/sports");
  const { data: classes } = useApiList<WhistleClass>("/classes");

  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [sportKey, setSportKey] = useState("");
  const [level, setLevel] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [goals, setGoals] = useState("");
  const [targetDurationMin, setTargetDurationMin] = useState("90");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setClassId("");
    setSportKey("");
    setLevel("");
    setAgeBand("");
    setGoals("");
    setTargetDurationMin("90");
    setError(null);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Session title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreated({
        title: title.trim(),
        classId: classId || undefined,
        sportKey: sportKey || undefined,
        level: level || undefined,
        ageBand: ageBand || undefined,
        goals: goals || undefined,
        targetDurationMin: targetDurationMin ? Number(targetDurationMin) : undefined,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create lesson plan.");
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
      title="Lesson Plan Builder"
      subtitle="Set the session details — you'll add drills next."
      wide
      footer={
        <ModalFooter
          onCancel={() => {
            reset();
            onClose();
          }}
          onSubmit={handleSubmit}
          submitLabel="Continue"
          submitting={submitting}
        />
      }
    >
      <Field
        label="Session Title *"
        placeholder="Enter Lesson Plan Name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <SelectField label="Assign to class" value={classId} onChange={(e) => setClassId(e.target.value)}>
        <option value="">Unassigned for now</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Sport" value={sportKey} onChange={(e) => setSportKey(e.target.value)}>
          <option value="">—</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Level" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">—</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="elite">Elite</option>
        </SelectField>
      </div>

      <div>
        <SelectField label="Age band" value={ageBand} onChange={(e) => setAgeBand(e.target.value)}>
          <option value="">No age band</option>
          {AGE_BANDS.map((b) => (
            <option key={b.band} value={b.band}>
              {b.band}
            </option>
          ))}
        </SelectField>
        {(() => {
          const b = findAgeBand(ageBand);
          return b ? (
            <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-surface-alt px-2 py-1 text-text-secondary">
                Age group <b className="text-text-primary">{b.ageMin}-{b.ageMax} yrs</b>
              </span>
              <span className="rounded-md bg-surface-alt px-2 py-1 text-text-secondary">
                Class <b className="text-text-primary">{b.classLabel}</b>
              </span>
              <span className="self-center text-text-muted">auto-filled from the band</span>
            </div>
          ) : null;
        })()}
      </div>

      <TextareaField
        label="Session Goals"
        rows={2}
        placeholder="What should this session achieve?"
        value={goals}
        onChange={(e) => setGoals(e.target.value)}
      />

      <Field
        label="Target duration (min)"
        type="number"
        min={1}
        value={targetDurationMin}
        onChange={(e) => setTargetDurationMin(e.target.value)}
      />

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
