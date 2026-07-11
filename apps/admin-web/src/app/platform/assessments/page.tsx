"use client";

// Whistle Assessment Library — the operator curates the standard fitness-test
// battery (FitnessGram-style). Academies read this catalogue and build their
// own testing cycles (grade/class + window) around it, the same way they
// adopt the drill bank and lesson-plan repository.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Search } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Field, SelectField, StatusPill } from "@/components/ui";
import { Modal, ModalFooter } from "@/components/modal";
import { PageHeader } from "../platform-ui";

interface Test {
  id: string;
  name: string;
  category: string;
  metricType: string;
  unit: string;
  precisionDecimals: number;
  attemptsAllowed: number;
  instructions: string | null;
}

const CATEGORIES = ["speed", "agility", "power", "endurance", "strength", "flexibility", "sport_skill"];
const CATEGORY_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  speed: "danger",
  agility: "warning",
  power: "info",
  endurance: "success",
  strength: "warning",
  flexibility: "info",
  sport_skill: "neutral",
};
const METRICS = [
  { key: "time", label: "Time (lower is better)" },
  { key: "repetitions", label: "Repetitions / count" },
  { key: "distance_height", label: "Distance / height" },
];

export default function PlatformAssessmentsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    apiJson<Test[]>("/platform/assessment-tests")
      .then(setTests)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tests.filter((t) => (!category || t.category === category) && (!q || t.name.toLowerCase().includes(q)));
  }, [tests, search, category]);

  async function handleDelete(t: Test) {
    if (!window.confirm(`Remove "${t.name}" from the platform assessment library? Academies will stop seeing it.`)) return;
    setDeletingId(t.id);
    try {
      await apiJson(`/platform/assessment-tests/${t.id}`, { method: "DELETE" });
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
        title="Assessments"
        subtitle="Whistle's fitness-test library — academies adopt these tests and build their own cycles."
        action={
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
          >
            + New Test
          </button>
        }
      />

      <div className="rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3 text-xs text-text-secondary">
        <ClipboardCheck className="mr-1 inline h-4 w-4 text-accent" strokeWidth={1.8} />
        This catalogue is curated by Whistle. Each academy sees it in <span className="font-semibold text-accent">Assessment Tests</span> and
        schedules testing cycles (grade / class + window) around it for their students.
      </div>

      <div className="flex gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-muted" strokeWidth={1.8} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tests…"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60"
          />
        </div>
        <SelectField label="" value={category} onChange={(e) => setCategory(e.target.value)} className="max-w-[200px]">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </SelectField>
      </div>

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState message={tests.length === 0 ? "No tests yet — add the first one." : "No tests match your filters."} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <Card key={t.id} className="space-y-2">
              <div className="flex items-start justify-between">
                <h3 className="font-medium text-text-primary">{t.name}</h3>
                <StatusPill tone={CATEGORY_TONE[t.category] ?? "neutral"}>{t.category.replace("_", " ")}</StatusPill>
              </div>
              <p className="text-xs text-text-muted">
                {t.metricType.replace("_", " ")} · {t.unit} · best of {t.attemptsAllowed}
              </p>
              {t.instructions && <p className="line-clamp-3 text-sm text-text-secondary">{t.instructions}</p>}
              <button
                onClick={() => handleDelete(t)}
                disabled={deletingId === t.id}
                className="text-xs text-text-muted hover:text-danger disabled:opacity-50"
              >
                {deletingId === t.id ? "Removing…" : "Remove from library"}
              </button>
            </Card>
          ))}
        </div>
      )}

      <NewTestModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />
    </div>
  );
}

function NewTestModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", category: "speed", metricType: "time", unit: "seconds", attemptsAllowed: "2", instructions: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.name.trim() || !form.unit.trim()) {
      setError("Name and unit are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiJson("/platform/assessment-tests", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          metricType: form.metricType,
          unit: form.unit,
          attemptsAllowed: Number(form.attemptsAllowed) || 1,
          instructions: form.instructions || undefined,
        }),
      });
      setForm({ name: "", category: "speed", metricType: "time", unit: "seconds", attemptsAllowed: "2", instructions: "" });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the test.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New assessment test"
      subtitle="Published to the platform library every academy reads."
      footer={<ModalFooter onCancel={onClose} onSubmit={submit} submitLabel="Add Test" submitting={saving} />}
    >
      <Field label="Test name *" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. 40m Sprint" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Category" value={form.category} onChange={(e) => set("category", e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </SelectField>
        <SelectField label="Measured as" value={form.metricType} onChange={(e) => set("metricType", e.target.value)}>
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit" value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="seconds / count / cm" />
        <Field label="Attempts (best of)" type="number" min={1} value={form.attemptsAllowed} onChange={(e) => set("attemptsAllowed", e.target.value)} />
      </div>
      <Field label="Instructions" value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="How to run and measure the test" />
      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
