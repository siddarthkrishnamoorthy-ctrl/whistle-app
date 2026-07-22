"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, EmptyState, OutlineButton, PrimaryButton, SelectField } from "@/components/ui";
import { ageBandForGrade, ageBandSummary } from "@/lib/age-bands";
import { toast } from "@/components/toast";
import type { CurriculumTrack, Grade, LessonPlan, Sport } from "@/lib/types";

export default function CurriculumPage() {
  const { data: sports } = useApiList<Sport>("/sports");
  const { data: grades } = useApiList<Grade>("/grades");
  const { data: lessonPlans } = useApiList<LessonPlan>("/lesson-plans");

  const [sportKey, setSportKey] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [track, setTrack] = useState<CurriculumTrack | null>(null);
  const [loading, setLoading] = useState(false);
  const [addLessonPlanId, setAddLessonPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Placement mode: how these lesson plans reach coaches. "calendar" = as per the
  // timetable (each class's schedule drives the plan); "grade_sequence" = as per
  // the age band (coach picks a class and gets the plans in order).
  const [mode, setMode] = useState<"calendar" | "grade_sequence" | null>(null);
  const [savingMode, setSavingMode] = useState(false);

  useEffect(() => {
    apiJson<{ settings?: { lessonPlanAssignmentMode?: "calendar" | "grade_sequence" } }>("/settings")
      .then((s) => setMode(s?.settings?.lessonPlanAssignmentMode ?? "calendar"))
      .catch(() => setMode("calendar"));
  }, []);

  async function saveMode(next: "calendar" | "grade_sequence") {
    if (next === mode) return;
    setSavingMode(true);
    setMode(next);
    try {
      await apiJson("/settings", { method: "PATCH", body: JSON.stringify({ lessonPlanAssignmentMode: next }) });
      toast(next === "calendar" ? "Placement: as per the timetable" : "Placement: as per the age band");
    } catch (err) {
      setMode(mode);
      toast(err instanceof Error ? err.message : "Could not change placement mode.", "error");
    } finally {
      setSavingMode(false);
    }
  }

  async function loadOrCreateTrack() {
    if (!sportKey || !gradeId) return;
    setLoading(true);
    setError(null);
    try {
      const tracks = await apiJson<CurriculumTrack[]>(`/curriculum-tracks?sportKey=${sportKey}&gradeId=${gradeId}`);
      if (tracks.length > 0) {
        setTrack(tracks[0]);
      } else {
        const created = await apiJson<CurriculumTrack>("/curriculum-tracks", {
          method: "POST",
          body: JSON.stringify({ sportKey, gradeId }),
        });
        setTrack({ ...created, items: [] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load track.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshTrack() {
    if (!track) return;
    const tracks = await apiJson<CurriculumTrack[]>(`/curriculum-tracks?sportKey=${track.sportKey}&gradeId=${track.gradeId}`);
    setTrack(tracks[0] ?? track);
  }

  async function handleAddItem() {
    if (!track || !addLessonPlanId) return;
    setBusy(true);
    try {
      await apiJson(`/curriculum-tracks/${track.id}/items`, {
        method: "POST",
        body: JSON.stringify({ lessonPlanId: addLessonPlanId }),
      });
      setAddLessonPlanId("");
      await refreshTrack();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not add lesson plan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!track) return;
    setBusy(true);
    try {
      await apiJson(`/curriculum-tracks/${track.id}/items/${itemId}`, { method: "DELETE" });
      await refreshTrack();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not remove lesson plan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(itemId: string, direction: -1 | 1) {
    if (!track) return;
    const items = [...track.items].sort((a, b) => a.sequenceNo - b.sequenceNo);
    const index = items.findIndex((i) => i.id === itemId);
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    setBusy(true);
    try {
      await apiJson(`/curriculum-tracks/${track.id}/items/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ lessonPlanIds: items.map((i) => i.lessonPlanId) }),
      });
      await refreshTrack();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not reorder.");
    } finally {
      setBusy(false);
    }
  }

  const sortedItems = track ? [...track.items].sort((a, b) => a.sequenceNo - b.sequenceNo) : [];
  // A grade (class) maps to an age band; lesson plans built for that band are the
  // ones that "auto-fall" to this grade, so we surface them first.
  const trackGradeName = grades.find((g) => g.id === track?.gradeId)?.name;
  const trackBand = ageBandForGrade(trackGradeName);
  const availableLessonPlans = lessonPlans
    .filter((lp) => !sortedItems.some((i) => i.lessonPlanId === lp.id) && (!lp.sportKey || lp.sportKey === sportKey))
    .sort((a, b) => {
      const am = trackBand && a.ageBand === trackBand ? 0 : 1;
      const bm = trackBand && b.ageBand === trackBand ? 0 : 1;
      return am - bm || a.title.localeCompare(b.title);
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Curriculum Tracks</h1>
        <p className="text-sm text-text-secondary">
          Sequence lesson plans for a Sport + Grade — the Coach App and Parent/Student App auto-resolve "next lesson"
          from this order as sessions complete.
        </p>
      </div>

      {/* Placement mode — how these plans reach coaches */}
      <Card className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Lesson-plan placement</h2>
          <p className="text-xs text-text-secondary">Choose how coaches receive these plans (academy default).</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              key: "calendar" as const,
              title: "As per the timetable",
              desc: "Each class's schedule drives it — the plan shows on the coach's calendar for that class's sessions.",
            },
            {
              key: "grade_sequence" as const,
              title: "As per the age band",
              desc: "The coach picks a class and gets these plans in sequence — placed by the grade's age band.",
            },
          ].map((opt) => {
            const active = mode === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => saveMode(opt.key)}
                disabled={savingMode}
                className={`rounded-lg border p-3 text-left transition disabled:opacity-60 ${
                  active ? "border-accent bg-accent/10 shadow-[0_0_14px_rgba(245,185,63,0.15)]" : "border-border bg-surface hover:border-white/25"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${active ? "border-accent" : "border-text-muted"}`}>
                    {active && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  <span className="text-sm font-semibold text-text-primary">{opt.title}</span>
                </div>
                <p className="mt-1 pl-6 text-xs text-text-secondary">{opt.desc}</p>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-text-muted">
          Per-class and per-school overrides still win over this academy default. Age-band placement uses the grade → age-band map below.
        </p>
      </Card>

      <Card className="flex items-end gap-3">
        <SelectField label="Sport" value={sportKey} onChange={(e) => setSportKey(e.target.value)}>
          <option value="">Sport…</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Grade" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
          <option value="">Grade…</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </SelectField>
        <PrimaryButton className="w-auto px-6" onClick={loadOrCreateTrack} disabled={loading || !sportKey || !gradeId}>
          {loading ? "Loading…" : "Open Track"}
        </PrimaryButton>
      </Card>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {track && (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">
            {sports.find((s) => s.key === track.sportKey)?.name} — {grades.find((g) => g.id === track.gradeId)?.name}
          </h2>

          {sortedItems.length === 0 ? (
            <EmptyState message="No lesson plans in this track yet." />
          ) : (
            <div className="space-y-2">
              {sortedItems.map((item, i) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-text">
                      {item.sequenceNo}
                    </span>
                    <span className="text-sm text-text-primary">{item.lessonPlan.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <button onClick={() => handleMove(item.id, -1)} disabled={busy || i === 0} className="hover:text-accent disabled:opacity-30">
                      ↑
                    </button>
                    <button
                      onClick={() => handleMove(item.id, 1)}
                      disabled={busy || i === sortedItems.length - 1}
                      className="hover:text-accent disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button onClick={() => handleRemoveItem(item.id)} disabled={busy} className="hover:text-danger">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            {trackBand && (
              <p className="text-xs text-text-muted">
                <b className="text-text-secondary">{trackGradeName}</b> maps to the{" "}
                <b className="text-accent">{trackBand}</b> age band ({ageBandSummary(trackBand)}) — matching lesson plans (✓) are listed first.
              </p>
            )}
            <div className="flex items-end gap-3">
              <SelectField label="Add a lesson plan" value={addLessonPlanId} onChange={(e) => setAddLessonPlanId(e.target.value)}>
                <option value="">Lesson plan…</option>
                {availableLessonPlans.map((lp) => (
                  <option key={lp.id} value={lp.id}>
                    {lp.title}
                    {lp.ageBand ? ` — ${lp.ageBand}` : ""}
                    {trackBand && lp.ageBand === trackBand ? " ✓" : ""}
                  </option>
                ))}
              </SelectField>
              <OutlineButton className="w-auto px-6" onClick={handleAddItem} disabled={busy || !addLessonPlanId}>
                Add to end
              </OutlineButton>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
