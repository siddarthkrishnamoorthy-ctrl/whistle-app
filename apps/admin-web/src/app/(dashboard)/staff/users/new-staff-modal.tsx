"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/modal";
import { Field, SelectField } from "@/components/ui";
import { useApiList } from "@/lib/hooks";
import type { Center, Sport, StaffProfile } from "@/lib/types";
import type { SalaryBasis, StaffRole } from "@whistle/shared";

export interface CreateStaffPayload {
  fullName: string;
  email: string;
  temporaryPassword: string;
  role: StaffRole;
  skills?: string[];
  centerId?: string;
  reportingManagerId?: string;
  salaryBasis?: SalaryBasis;
  salaryAmount?: number;
  moduleAccess?: string[];
}

const ROLES: { key: StaffRole; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "coach", label: "Coach" },
  { key: "account_manager", label: "Account Manager" },
  { key: "venue_manager", label: "Venue Manager" },
  { key: "referee", label: "Referee / Scorer" },
];

// App modules an admin can grant. Empty selection = everything the role
// already allows; e.g. tick "Scoring" to hand match scoring to a coach.
const MODULES = [
  { key: "classes", label: "Classes" },
  { key: "schedule", label: "Schedule" },
  { key: "assessments", label: "Assessments" },
  { key: "lessons", label: "Lesson Plans" },
  { key: "drills", label: "Drill Bank" },
  { key: "match_center", label: "Match Center" },
  { key: "standings", label: "Whistle Standings" },
  { key: "scoring", label: "Scoring" },
];

export function NewStaffModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (dto: CreateStaffPayload) => Promise<void>;
}) {
  const { data: sports } = useApiList<Sport>("/sports");
  const { data: centers } = useApiList<Center>("/centers");
  const { data: staff } = useApiList<StaffProfile>("/staff");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("coach");
  const [skills, setSkills] = useState<string[]>([]);
  const [moduleAccess, setModuleAccess] = useState<string[]>([]);
  const [centerId, setCenterId] = useState("");
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [salaryBasis, setSalaryBasis] = useState<SalaryBasis | "">("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFullName("");
    setEmail("");
    setTemporaryPassword("");
    setRole("coach");
    setSkills([]);
    setModuleAccess([]);
    setCenterId("");
    setReportingManagerId("");
    setSalaryBasis("");
    setSalaryAmount("");
    setError(null);
  }

  function toggleSkill(key: string) {
    setSkills((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }

  async function handleSubmit() {
    if (!fullName.trim() || !email.trim() || temporaryPassword.length < 6) {
      setError("Name, email and a password (6+ chars) are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreated({
        fullName: fullName.trim(),
        email: email.trim(),
        temporaryPassword,
        role,
        skills: skills.length > 0 ? skills : undefined,
        centerId: centerId || undefined,
        reportingManagerId: reportingManagerId || undefined,
        salaryBasis: salaryBasis || undefined,
        salaryAmount: salaryAmount ? Number(salaryAmount) : undefined,
        moduleAccess: moduleAccess.length > 0 ? moduleAccess : undefined,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add staff member.");
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
      title="Add Staff"
      subtitle="Invite a coach, manager or admin"
      wide
      footer={
        <ModalFooter
          onCancel={() => {
            reset();
            onClose();
          }}
          onSubmit={handleSubmit}
          submitLabel="Add Staff"
          submitting={submitting}
        />
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name *" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Field label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <Field
        label="Temporary password *"
        type="text"
        placeholder="Shared with the staff member to log in"
        value={temporaryPassword}
        onChange={(e) => setTemporaryPassword(e.target.value)}
      />

      <div>
        <span className="mb-1.5 block text-sm text-text-secondary">Role *</span>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRole(r.key)}
              className={`rounded-md border px-3 py-2 text-sm ${
                role === r.key ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm text-text-secondary">Skills</span>
        <div className="flex flex-wrap gap-2">
          {sports.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSkill(s.key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                skills.includes(s.key) ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm text-text-secondary">
          Module access <span className="text-text-muted">(leave empty for everything the role allows)</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {MODULES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() =>
                setModuleAccess((prev) => (prev.includes(m.key) ? prev.filter((x) => x !== m.key) : [...prev, m.key]))
              }
              className={`rounded-full border px-3 py-1 text-xs ${
                moduleAccess.includes(m.key)
                  ? "border-admin-action bg-admin-action/20 text-admin-action"
                  : "border-border text-text-secondary"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Center" value={centerId} onChange={(e) => setCenterId(e.target.value)}>
          <option value="">—</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Reporting manager" value={reportingManagerId} onChange={(e) => setReportingManagerId(e.target.value)}>
          <option value="">—</option>
          {staff.map((s) => (
            <option key={s.userId} value={s.userId}>
              {s.user.name}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Salary basis" value={salaryBasis} onChange={(e) => setSalaryBasis(e.target.value as SalaryBasis)}>
          <option value="">Not set</option>
          <option value="fixed">Fixed (monthly)</option>
          <option value="session">Per session</option>
          <option value="days_present">Per day present</option>
        </SelectField>
        <Field
          label="Salary amount (₹)"
          type="number"
          min={0}
          value={salaryAmount}
          onChange={(e) => setSalaryAmount(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
