"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/modal";
import { Field, SelectField } from "@/components/ui";
import type { PlanType } from "@/lib/types";

export interface CreatePlanPayload {
  title: string;
  type: PlanType;
  durationValue?: number;
  durationUnit?: string;
  fee: number;
  sessionsIncluded?: number;
  makeupsIncluded?: number;
  autoRenewDefault?: boolean;
}

export function NewPlanModal({
  open,
  onClose,
  defaultType,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultType: PlanType;
  onCreated: (dto: CreatePlanPayload) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PlanType>(defaultType);
  const [durationValue, setDurationValue] = useState("1");
  const [durationUnit, setDurationUnit] = useState("month");
  const [fee, setFee] = useState("");
  const [sessionsIncluded, setSessionsIncluded] = useState("");
  const [makeupsIncluded, setMakeupsIncluded] = useState("0");
  const [autoRenewDefault, setAutoRenewDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setType(defaultType);
    setDurationValue("1");
    setDurationUnit("month");
    setFee("");
    setSessionsIncluded("");
    setMakeupsIncluded("0");
    setAutoRenewDefault(false);
    setError(null);
  }

  async function handleSubmit() {
    if (!title.trim() || !fee) {
      setError("Title and Fee are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreated({
        title: title.trim(),
        type,
        durationValue: durationValue ? Number(durationValue) : undefined,
        durationUnit: durationUnit || undefined,
        fee: Number(fee),
        sessionsIncluded: sessionsIncluded ? Number(sessionsIncluded) : undefined,
        makeupsIncluded: makeupsIncluded ? Number(makeupsIncluded) : undefined,
        autoRenewDefault,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create plan.");
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
      title="New Subscription Plan"
      subtitle="Define pricing, duration and linked classes."
      footer={
        <ModalFooter
          onCancel={() => {
            reset();
            onClose();
          }}
          onSubmit={handleSubmit}
          submitLabel="Next"
          submitting={submitting}
        />
      }
    >
      <Field label="Title *" placeholder="e.g. Monthly Pro" value={title} onChange={(e) => setTitle(e.target.value)} />

      <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value as PlanType)}>
        <option value="subscription">Subscription</option>
        <option value="trial">Trial</option>
        <option value="one_time">One-time</option>
      </SelectField>

      <div className="grid grid-cols-3 gap-3">
        <Field
          label="Duration"
          type="number"
          min={1}
          value={durationValue}
          onChange={(e) => setDurationValue(e.target.value)}
        />
        <SelectField label="Unit" value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)}>
          <option value="day">Day(s)</option>
          <option value="week">Week(s)</option>
          <option value="month">Month(s)</option>
          <option value="year">Year(s)</option>
        </SelectField>
        <Field label="Fee (₹) *" type="number" min={0} placeholder="0" value={fee} onChange={(e) => setFee(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Sessions included"
          type="number"
          min={0}
          value={sessionsIncluded}
          onChange={(e) => setSessionsIncluded(e.target.value)}
        />
        <Field
          label="Make-up sessions"
          type="number"
          min={0}
          value={makeupsIncluded}
          onChange={(e) => setMakeupsIncluded(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={autoRenewDefault}
          onChange={(e) => setAutoRenewDefault(e.target.checked)}
          className="accent-accent"
        />
        Auto-renew by default
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
