"use client";

// Whistle Lesson Plan repository — the master plans tenants view (per granted
// sport) and adopt. Same layout language as the tenant Lesson Plans page.

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Field, SelectField } from "@/components/ui";
import { Modal, ModalFooter } from "@/components/modal";
import { PageHeader, type PlatformDrill, type PlatformPlan } from "../platform-ui";

interface Sport {
  key: string;
  name: string;
}

const LEVELS = ["beginner", "intermediate", "advanced", "elite"];

export default function PlatformLessonPlansPage() {
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [drills, setDrills] = useState<PlatformDrill[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sportKey, setSportKey] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    apiJson<PlatformPlan[]>("/platform/lesson-plans")
      .then(setPlans)
      .finally(() => setLoading(false));
    apiJson<PlatformDrill[]>("/platform/drills").then(setDrills).catch(() => {});
    apiJson<Sport[]>("/sports").then(setSports).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((p) => (!sportKey || p.sportKey === sportKey) && (!q || p.title.toLowerCase().includes(q)));
  }, [plans, search, sportKey]);

  async function handleDelete(plan: PlatformPlan) {
    if (!window.confirm(`Delete "${plan.title}" from the repository? Tenants will stop seeing it (their adopted copies stay).`)) return;
    setDeletingId(plan.id);
    try {
      await apiJson(`/platform/lesson-plans/${plan.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lesson Plans"
        subtitle="Whistle's repository — tenants view plans for their granted sports and adopt copies."
        action={
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
          >
            + New Plan
          </button>
        }
      />

      <div className="flex gap-3">
        <Field label="" placeholder="Search plans…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <SelectField label="" value={sportKey} onChange={(e) => setSportKey(e.target.value)} className="max-w-xs">
          <option value="">All sports</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </div>

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState message={plans.length === 0 ? "No repository plans yet — publish the first one." : "No plans match your filters."} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visible.map((plan) => (
            <Card key={plan.id} className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-text-primary">{plan.title}</h3>
                  <p className="text-xs text-text-muted">
                    {plan.sport?.name}
                    {plan.level ? ` · ${plan.level}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">🏛 Repository</span>
              </div>
              {plan.goals && <p className="text-sm text-text-secondary">{plan.goals}</p>}
              {plan.sessionFlow.length > 0 && (
                <ol className="space-y-0.5 text-xs text-text-secondary">
                  {plan.sessionFlow.map((s, i) => (
                    <li key={i}>
                      {i + 1}. {s.drillTitle} <span className="text-text-muted">· {s.durationMin} min</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1 text-xs text-text-muted">
                  <span className="rounded-full bg-surface-alt px-2 py-0.5">{plan.sessionFlow.length} drills</span>
                  {plan.targetDurationMin && <span className="rounded-full bg-surface-alt px-2 py-0.5">{plan.targetDurationMin} min</span>}
                  {plan.whatToBring.length > 0 && <span className="rounded-full bg-surface-alt px-2 py-0.5">🎒 {plan.whatToBring.join(", ")}</span>}
                </div>
                <button
                  onClick={() => handleDelete(plan)}
                  disabled={deletingId === plan.id}
                  className="text-xs text-text-muted hover:text-danger disabled:opacity-50"
                >
                  {deletingId === plan.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewPlatformPlanModal
        open={modalOpen}
        sports={sports}
        drills={drills}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          load();
        }}
      />
    </div>
  );
}

function NewPlatformPlanModal({
  open,
  sports,
  drills,
  onClose,
  onCreated,
}: {
  open: boolean;
  sports: Sport[];
  drills: PlatformDrill[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: "", sportKey: "", level: "beginner", goals: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sportDrills = form.sportKey ? drills.filter((d) => d.sportKey === form.sportKey) : [];

  function toggleDrill(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    if (!form.title.trim() || !form.sportKey) {
      setError("Title and sport are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiJson("/platform/lesson-plans", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          sportKey: form.sportKey,
          level: form.level,
          goals: form.goals || undefined,
          drillIds: selected,
        }),
      });
      setForm({ title: "", sportKey: "", level: "beginner", goals: "" });
      setSelected([]);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New repository lesson plan"
      subtitle="Session flow builds from the platform Drill Bank — pick drills in playing order."
      wide
      footer={<ModalFooter onCancel={onClose} onSubmit={submit} submitLabel="Publish Plan" submitting={saving} />}
    >
      <Field label="Title *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Badminton — Net Play Session" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Sport *"
          value={form.sportKey}
          onChange={(e) => {
            setForm((f) => ({ ...f, sportKey: e.target.value }));
            setSelected([]);
          }}
        >
          <option value="">Select sport</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Level" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </SelectField>
      </div>
      <Field label="Goals" value={form.goals} onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))} placeholder="What this session builds toward" />

      {form.sportKey && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Session flow — {selected.length} drill{selected.length === 1 ? "" : "s"} selected (in order)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sportDrills.map((d) => {
              const idx = selected.indexOf(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDrill(d.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    idx >= 0 ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-white/[0.04] text-text-secondary hover:border-accent/40"
                  }`}
                >
                  {idx >= 0 ? `${idx + 1}. ` : ""}
                  {d.title} {d.durationMin ? `(${d.durationMin}m)` : ""}
                </button>
              );
            })}
            {sportDrills.length === 0 && (
              <p className="text-xs text-text-muted">No platform drills for this sport yet — add some in the Drill Bank first.</p>
            )}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
