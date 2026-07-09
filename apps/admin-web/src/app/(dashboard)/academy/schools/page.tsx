"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Field, SelectField, Table } from "@/components/ui";
import { Modal, ModalFooter } from "@/components/modal";

interface School {
  id: string;
  name: string;
  address?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  lessonPlanAssignmentMode?: "calendar" | "grade_sequence" | null;
  _count?: { classes: number };
}

const MODE_LABEL: Record<string, string> = {
  "": "Inherit academy default",
  calendar: "Class calendar",
  grade_sequence: "Grade-wise sequential",
};

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [mode, setMode] = useState<"" | "calendar" | "grade_sequence">("");
  const [submitting, setSubmitting] = useState(false);

  const refetch = useCallback(() => {
    apiJson<School[]>("/schools")
      .then(setSchools)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load schools."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refetch, [refetch]);

  async function createSchool() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await apiJson("/schools", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || undefined,
          contactName: contactName.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          lessonPlanAssignmentMode: mode || undefined,
        }),
      });
      setName("");
      setAddress("");
      setContactName("");
      setContactPhone("");
      setMode("");
      setModalOpen(false);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add school.");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeMode(school: School, value: string) {
    await apiJson(`/schools/${school.id}`, {
      method: "PATCH",
      body: JSON.stringify({ lessonPlanAssignmentMode: value || null }),
    }).catch(() => undefined);
    refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Schools</h1>
          <p className="text-sm text-text-secondary">
            Partner schools you run programs for — each chooses how its coaches receive lesson plans
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          + Add School
        </button>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : schools.length === 0 ? (
        <Card>
          <EmptyState message="No schools yet. Add one, then assign classes to it from the Classes page." />
        </Card>
      ) : (
        <Table columns={["School", "Contact", "Classes", "Lesson plan scheduling"]}>
          {schools.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-text-primary">{s.name}</div>
                {s.address && <div className="text-xs text-text-secondary">{s.address}</div>}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {s.contactName ?? "—"}
                {s.contactPhone ? ` · ${s.contactPhone}` : ""}
              </td>
              <td className="px-4 py-3 text-text-secondary">{s._count?.classes ?? 0}</td>
              <td className="px-4 py-3">
                <select
                  value={s.lessonPlanAssignmentMode ?? ""}
                  onChange={(e) => changeMode(s, e.target.value)}
                  className="rounded-md border border-border bg-surface-alt px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  {Object.entries(MODE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add School"
        subtitle="A partner school you schedule classes for"
        footer={
          <ModalFooter
            onCancel={() => setModalOpen(false)}
            onSubmit={createSchool}
            submitLabel="Add School"
            submitting={submitting}
          />
        }
      >
        <Field label="School name *" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact person" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <Field label="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
        <SelectField
          label="Lesson plan scheduling for this school's coaches"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="">Inherit academy default</option>
          <option value="calendar">Via scheduled class calendar</option>
          <option value="grade_sequence">Grade-wise sequential curriculum</option>
        </SelectField>
      </Modal>
    </div>
  );
}
