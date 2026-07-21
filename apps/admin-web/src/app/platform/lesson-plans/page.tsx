"use client";

// Whistle Lesson Plan repository — the master plans tenants view (per granted
// sport) and adopt. Same layout language as the tenant Lesson Plans page.

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Field, SelectField } from "@/components/ui";
import { Modal, ModalFooter } from "@/components/modal";
import { AGE_BANDS, ageBandSummary, findAgeBand } from "@/lib/age-bands";
import { PageHeader, type PlatformDrill, type PlatformPlan } from "../platform-ui";

interface Sport {
  key: string;
  name: string;
}

const LEVELS = ["beginner", "intermediate", "advanced", "elite"];
const LEVEL_LABEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", elite: "Elite" };

export default function PlatformLessonPlansPage() {
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [drills, setDrills] = useState<PlatformDrill[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sportKey, setSportKey] = useState("");
  const [level, setLevel] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [viewPlan, setViewPlan] = useState<PlatformPlan | null>(null);
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
    return plans.filter(
      (p) =>
        (!sportKey || p.sportKey === sportKey) &&
        (!level || (p.level ?? "").toLowerCase() === level) &&
        (!ageBand || p.ageBand === ageBand) &&
        (!q || p.title.toLowerCase().includes(q))
    );
  }, [plans, search, sportKey, level, ageBand]);

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
        <SelectField label="" value={level} onChange={(e) => setLevel(e.target.value)} className="max-w-xs">
          <option value="">All skill levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l]}
            </option>
          ))}
        </SelectField>
        <SelectField label="" value={ageBand} onChange={(e) => setAgeBand(e.target.value)} className="max-w-xs">
          <option value="">All age bands</option>
          {AGE_BANDS.map((b) => (
            <option key={b.band} value={b.band}>
              {b.band} ({b.ageMin}-{b.ageMax})
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
                  {plan.ageBand && (
                    <span className="mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      {plan.ageBand} · {ageBandSummary(plan.ageBand)}
                    </span>
                  )}
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
                <div className="flex items-center gap-3">
                  <button onClick={() => setViewPlan(plan)} className="text-xs font-semibold text-accent hover:underline">
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(plan)}
                    disabled={deletingId === plan.id}
                    className="text-xs text-text-muted hover:text-danger disabled:opacity-50"
                  >
                    {deletingId === plan.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ViewPlanModal plan={viewPlan} drills={drills} onClose={() => setViewPlan(null)} />

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

// Full lesson-plan detail — resolves each session-flow step against the Drill
// Bank so the operator sees the drill description and demo video, not just the
// titles shown on the card.
function ViewPlanModal({ plan, drills, onClose }: { plan: PlatformPlan | null; drills: PlatformDrill[]; onClose: () => void }) {
  if (!plan) return null;
  const byId = new Map(drills.map((d) => [d.id, d]));
  return (
    <Modal
      open={!!plan}
      onClose={onClose}
      title={plan.title}
      subtitle={[plan.sport?.name, plan.level ? LEVEL_LABEL[plan.level] ?? plan.level : null, ageBandSummary(plan.ageBand) ? `${plan.ageBand} (${ageBandSummary(plan.ageBand)})` : null].filter(Boolean).join(" · ")}
      wide
    >
      <div className="space-y-4">
        {plan.goals && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Goals</p>
            <p className="text-sm text-text-secondary">{plan.goals}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-text-muted">
          <span className="rounded-full bg-surface-alt px-2.5 py-1">{plan.sessionFlow.length} drills</span>
          {plan.targetDurationMin && <span className="rounded-full bg-surface-alt px-2.5 py-1">Target {plan.targetDurationMin} min</span>}
          {plan.whatToBring.length > 0 && <span className="rounded-full bg-surface-alt px-2.5 py-1">🎒 {plan.whatToBring.join(", ")}</span>}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Session flow</p>
          {plan.sessionFlow.length === 0 ? (
            <p className="text-sm text-text-muted">No drills in this plan.</p>
          ) : (
            <ol className="space-y-2">
              {plan.sessionFlow.map((s, i) => {
                const drill = byId.get(s.drillId);
                const video = drill?.media?.find((m) => m.type === "video");
                return (
                  <li key={i} className="rounded-lg border border-border bg-white/[0.03] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                          {i + 1}. {s.drillTitle}
                          <span className="ml-2 text-xs font-normal text-text-muted">{s.durationMin} min</span>
                        </p>
                        {drill?.description && <p className="mt-1 text-xs text-text-secondary">{drill.description}</p>}
                      </div>
                      {video && (
                        <a href={video.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-accent hover:underline">
                          ▶ Watch
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </Modal>
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
  const [form, setForm] = useState({ title: "", sportKey: "", level: "beginner", ageBand: "", goals: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [drillSearch, setDrillSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drills to pick from: the plan's sport, narrowed to the plan's age band when
  // one is chosen so you build a plan from the right cohort's drills, then by
  // the in-picker search box.
  const sportDrills = form.sportKey
    ? drills.filter((d) => d.sportKey === form.sportKey && (!form.ageBand || d.ageBand === form.ageBand))
    : [];
  const filteredDrills = drillSearch.trim()
    ? sportDrills.filter((d) => d.title.toLowerCase().includes(drillSearch.trim().toLowerCase()))
    : sportDrills;
  const selectedDrills = selected.map((id) => drills.find((d) => d.id === id)).filter(Boolean) as PlatformDrill[];

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
          ageBand: form.ageBand || undefined,
          goals: form.goals || undefined,
          drillIds: selected,
        }),
      });
      setForm({ title: "", sportKey: "", level: "beginner", ageBand: "", goals: "" });
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
      <div>
        <SelectField label="Age band" value={form.ageBand} onChange={(e) => setForm((f) => ({ ...f, ageBand: e.target.value }))}>
          <option value="">No age band</option>
          {AGE_BANDS.map((b) => (
            <option key={b.band} value={b.band}>
              {b.band}
            </option>
          ))}
        </SelectField>
        {(() => {
          const b = findAgeBand(form.ageBand);
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
      <Field label="Goals" value={form.goals} onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))} placeholder="What this session builds toward" />

      {/* Drill selection — always visible so it's obvious this is where the
          session flow is built by picking from the Drill Bank. */}
      <div className="rounded-lg border border-border bg-white/[0.03] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Add drills from the Drill Bank
            <span className="ml-1 font-normal normal-case text-text-muted">· {selected.length} selected (in playing order)</span>
            {form.ageBand && <span className="ml-1 font-normal normal-case text-accent">· {form.ageBand} band</span>}
          </p>
          {form.sportKey && sportDrills.length > 0 && (
            <input
              value={drillSearch}
              onChange={(e) => setDrillSearch(e.target.value)}
              placeholder="Search drills…"
              className="w-44 rounded-md border border-border bg-surface-alt px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60"
            />
          )}
        </div>

        {/* Chosen drills, in order, with a quick remove */}
        {selectedDrills.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedDrills.map((d, i) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDrill(d.id)}
                title="Remove from plan"
                className="rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-xs font-medium text-accent"
              >
                {i + 1}. {d.title} ✕
              </button>
            ))}
          </div>
        )}

        {!form.sportKey ? (
          <p className="text-xs text-text-muted">Select a sport above to load its drills from the Drill Bank.</p>
        ) : filteredDrills.length === 0 ? (
          <p className="text-xs text-text-muted">
            {drillSearch.trim()
              ? "No drills match your search."
              : form.ageBand
                ? `No ${form.ageBand} drills for this sport yet — clear the age band above, or tag drills with this band in the Drill Bank.`
                : "No platform drills for this sport yet — add some in the Drill Bank first."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {filteredDrills.map((d) => {
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
                  {idx >= 0 ? `${idx + 1}. ` : "+ "}
                  {d.title} {d.durationMin ? `(${d.durationMin}m)` : ""}
                  {d.ageBand && !form.ageBand ? <span className="ml-1 text-text-muted">· {d.ageBand}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
