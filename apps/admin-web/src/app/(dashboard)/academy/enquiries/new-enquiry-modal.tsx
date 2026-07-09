"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/modal";
import { Field, SelectField, TextareaField } from "@/components/ui";
import { useApiList } from "@/lib/hooks";
import type { Center, EnquiryTemperature, Sport } from "@/lib/types";

export interface CreateEnquiryPayload {
  name: string;
  parentName?: string;
  email?: string;
  gender?: string;
  birthday?: string;
  phone?: string;
  sportKey?: string;
  level?: string;
  centerId?: string;
  status: EnquiryTemperature;
  followUpDate?: string;
  note?: string;
}

export function NewEnquiryModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (dto: CreateEnquiryPayload) => Promise<void>;
}) {
  const { data: sports } = useApiList<Sport>("/sports");
  const { data: centers } = useApiList<Center>("/centers");

  const [name, setName] = useState("");
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [birthday, setBirthday] = useState("");
  const [phone, setPhone] = useState("");
  const [sportKey, setSportKey] = useState("");
  const [level, setLevel] = useState("");
  const [centerId, setCenterId] = useState("");
  const [status, setStatus] = useState<EnquiryTemperature>("warm");
  const [followUpDate, setFollowUpDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setParentName("");
    setEmail("");
    setGender("");
    setBirthday("");
    setPhone("");
    setSportKey("");
    setLevel("");
    setCenterId("");
    setStatus("warm");
    setFollowUpDate("");
    setNote("");
    setError(null);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreated({
        name: name.trim(),
        parentName: parentName || undefined,
        email: email || undefined,
        gender: gender || undefined,
        birthday: birthday || undefined,
        phone: phone || undefined,
        sportKey: sportKey || undefined,
        level: level || undefined,
        centerId: centerId || undefined,
        status,
        followUpDate: followUpDate || undefined,
        note: note || undefined,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add enquiry.");
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
      title="Add Enquiry"
      subtitle="Capture a lead with follow-up reminders"
      wide
      footer={
        <ModalFooter
          onCancel={() => {
            reset();
            onClose();
          }}
          onSubmit={handleSubmit}
          submitLabel="Add Enquiry"
          submitting={submitting}
        />
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name *" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Parent name" value={parentName} onChange={(e) => setParentName(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <SelectField label="Gender" value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </SelectField>
        <Field label="Birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        <Field label="Mobile" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <div className="grid grid-cols-3 gap-3">
        <SelectField label="Skill" value={sportKey} onChange={(e) => setSportKey(e.target.value)}>
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
        </SelectField>
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
        <div>
          <span className="mb-1.5 block text-sm text-text-secondary">Status *</span>
          <div className="flex gap-2">
            {(["hot", "warm", "cold"] as EnquiryTemperature[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-full border px-4 py-1.5 text-sm capitalize ${
                  status === s ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <Field label="Follow-up date" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
      </div>

      <TextareaField
        label="Note"
        rows={2}
        placeholder="Add a note about this enquiry…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
