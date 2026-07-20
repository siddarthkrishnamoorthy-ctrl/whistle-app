"use client";

import { useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, EmptyState, OutlineButton, PrimaryButton, SelectField } from "@/components/ui";
import { ageBandForGrade, ageBandSummary } from "@/lib/age-bands";
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
