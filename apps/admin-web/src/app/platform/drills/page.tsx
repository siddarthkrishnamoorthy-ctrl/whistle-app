"use client";

// Whistle Drill Bank — the platform master library (made by Whistle, read by
// every tenant). Same layout language as the tenant admin Drill Bank page.

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Field, SelectField, StatusPill } from "@/components/ui";
import { Modal, ModalFooter } from "@/components/modal";
import { PageHeader, type PlatformDrill } from "../platform-ui";

interface Sport {
  key: string;
  name: string;
}

const LEVEL_TONE = { beginner: "success", intermediate: "warning", advanced: "danger", elite: "info" } as const;
const LEVELS = ["beginner", "intermediate", "advanced", "elite"];
const LEVEL_LABEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", elite: "Elite" };

export default function PlatformDrillBankPage() {
  const [drills, setDrills] = useState<PlatformDrill[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sportKey, setSportKey] = useState("");
  const [level, setLevel] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    apiJson<PlatformDrill[]>("/platform/drills")
      .then(setDrills)
      .finally(() => setLoading(false));
    apiJson<Sport[]>("/sports").then(setSports).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drills.filter(
      (d) => (!sportKey || d.sportKey === sportKey) && (!level || (d.level ?? "").toLowerCase() === level) && (!q || d.title.toLowerCase().includes(q))
    );
  }, [drills, search, sportKey, level]);

  async function handleDelete(drill: PlatformDrill) {
    if (!window.confirm(`Delete "${drill.title}" from the platform library? Tenants will stop seeing it.`)) return;
    setDeletingId(drill.id);
    try {
      await apiJson(`/platform/drills/${drill.id}`, { method: "DELETE" });
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
        title="Drill Bank"
        subtitle="Whistle's master drill library — tenants read it for their granted sports."
        action={
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
          >
            + New Drill
          </button>
        }
      />

      <div className="flex gap-3">
        <Field label="" placeholder="Search drills…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <SelectField label="" value={sportKey} onChange={(e) => setSportKey(e.target.value)} className="max-w-xs">
          <option value="">All sports</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="" value={level} onChange={(e) => setLevel(e.target.value)} className="max-w-xs">
          <option value="">All skill levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l]}
            </option>
          ))}
        </SelectField>
      </div>

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState message={drills.length === 0 ? "No drills yet — add the first one." : "No drills match your filters."} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((drill) => {
            const video = drill.media?.find((m) => m.type === "video");
            return (
              <Card key={drill.id} className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-text-primary">{drill.title}</h3>
                  {drill.level && <StatusPill tone={LEVEL_TONE[drill.level as keyof typeof LEVEL_TONE]}>{drill.level}</StatusPill>}
                </div>
                <p className="text-xs text-text-muted">{drill.sport.name}</p>
                {drill.description && <p className="text-sm text-text-secondary">{drill.description}</p>}
                <div className="flex flex-wrap gap-1 text-xs text-text-muted">
                  {drill.durationMin && <span className="rounded-full bg-surface-alt px-2 py-0.5">{drill.durationMin} min</span>}
                  {drill.equipment.map((eq) => (
                    <span key={eq} className="rounded-full bg-surface-alt px-2 py-0.5">
                      {eq}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  {video ? (
                    <a href={video.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                      ▶ Watch video
                    </a>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => handleDelete(drill)}
                    disabled={deletingId === drill.id}
                    className="text-xs text-text-muted hover:text-danger disabled:opacity-50"
                  >
                    {deletingId === drill.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <NewPlatformDrillModal
        open={modalOpen}
        sports={sports}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          load();
        }}
      />
    </div>
  );
}

function NewPlatformDrillModal({
  open,
  sports,
  onClose,
  onCreated,
}: {
  open: boolean;
  sports: Sport[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: "", sportKey: "", level: "beginner", durationMin: "10", equipment: "", videoUrl: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.title.trim() || !form.sportKey) {
      setError("Title and sport are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiJson("/platform/drills", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          sportKey: form.sportKey,
          level: form.level,
          durationMin: form.durationMin ? Number(form.durationMin) : undefined,
          equipment: form.equipment ? form.equipment.split(",").map((s) => s.trim()).filter(Boolean) : [],
          videoUrl: form.videoUrl || undefined,
          description: form.description || undefined,
        }),
      });
      setForm({ title: "", sportKey: "", level: "beginner", durationMin: "10", equipment: "", videoUrl: "", description: "" });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the drill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New platform drill"
      subtitle="Published to the master library every tenant reads."
      footer={<ModalFooter onCancel={onClose} onSubmit={submit} submitLabel="Add Drill" submitting={saving} />}
    >
      <Field label="Title *" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Footwork Ladder Circuit" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Sport *" value={form.sportKey} onChange={(e) => set("sportKey", e.target.value)}>
          <option value="">Select sport</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Level" value={form.level} onChange={(e) => set("level", e.target.value)}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration (min)" type="number" min={1} value={form.durationMin} onChange={(e) => set("durationMin", e.target.value)} />
        <Field label="Equipment (comma separated)" value={form.equipment} onChange={(e) => set("equipment", e.target.value)} placeholder="Cones, Ladder" />
      </div>
      <Field label="Video URL" value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://youtube.com/…" />
      <Field label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What the drill trains and how to run it" />
      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
