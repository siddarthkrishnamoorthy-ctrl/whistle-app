"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/modal";
import { Field, SelectField } from "@/components/ui";
import { useApiList } from "@/lib/hooks";
import type { Center, Plan, WhistleClass } from "@/lib/types";

export interface CreateClientPayload {
  name: string;
  email?: string;
  phone?: string;
  centerId?: string;
  planId?: string;
  classId?: string;
}

export function NewClientModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (dto: CreateClientPayload) => Promise<void>;
}) {
  const { data: centers } = useApiList<Center>("/centers");
  const { data: plans } = useApiList<Plan>("/plans");
  const { data: classes } = useApiList<WhistleClass>("/classes");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [centerId, setCenterId] = useState("");
  const [planId, setPlanId] = useState("");
  const [classId, setClassId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setCenterId("");
    setPlanId("");
    setClassId("");
    setError(null);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreated({
        name: name.trim(),
        email: email || undefined,
        phone: phone || undefined,
        centerId: centerId || undefined,
        planId: planId || undefined,
        classId: classId || undefined,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add client.");
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
      title="New Client"
      subtitle="Enroll a client and assign a plan"
      wide
      footer={
        <ModalFooter
          onCancel={() => {
            reset();
            onClose();
          }}
          onSubmit={handleSubmit}
          submitLabel="Add Client"
          submitting={submitting}
        />
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
        <SelectField label="Center" value={centerId} onChange={(e) => setCenterId(e.target.value)}>
          <option value="">—</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Mobile" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">No plan yet</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </SelectField>
        <SelectField label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">—</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </SelectField>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
