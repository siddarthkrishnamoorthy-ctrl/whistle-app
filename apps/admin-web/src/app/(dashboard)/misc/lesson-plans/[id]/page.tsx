"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { Card, PrimaryButton, StatusPill } from "@/components/ui";
import type { LessonPlan, SessionFlowStep } from "@/lib/types";

export default function LessonPlanBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [flow, setFlow] = useState<SessionFlowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiJson<LessonPlan>(`/lesson-plans/${id}`);
      setPlan(data);
      setFlow(data.sessionFlow ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load lesson plan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totalMinutes = flow.reduce((sum, step) => sum + step.durationMin, 0);

  function removeStep(index: number) {
    setFlow((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setFlow((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  }

  async function handleSaveFlow() {
    setSaving(true);
    try {
      const updated = await apiJson<LessonPlan>(`/lesson-plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ sessionFlow: flow }),
      });
      setPlan(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save session flow.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    await handleSaveFlow();
    router.push("/misc/lesson-plans");
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !plan) return <p className="text-sm text-danger">{error ?? "Lesson plan not found."}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/misc/lesson-plans" className="text-sm text-text-secondary hover:text-accent">
            ← Lesson Plans
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Lesson Plan Builder</h1>
        </div>
        <PrimaryButton onClick={handlePublish} disabled={saving} className="w-auto px-6">
          {saving ? "Publishing…" : "Publish Plan"}
        </PrimaryButton>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Lesson Plan Details</h2>
          <div className="text-lg font-medium text-text-primary">{plan.title}</div>
          {plan.class && <div className="text-sm text-text-secondary">Class: {plan.class.title}</div>}
          {plan.goals && <div className="text-sm text-text-secondary">{plan.goals}</div>}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Total duration</span>
            <span className={totalMinutes > (plan.targetDurationMin ?? Infinity) ? "text-danger" : "text-text-primary"}>
              {totalMinutes} min {plan.targetDurationMin ? `/ target ${plan.targetDurationMin} min` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
            <div
              className="h-full bg-accent"
              style={{
                width: `${Math.min(100, (totalMinutes / (plan.targetDurationMin || totalMinutes || 1)) * 100)}%`,
              }}
            />
          </div>
          {plan.whatToBring.length > 0 && (
            <div className="text-xs text-text-muted">Equipment: {plan.whatToBring.join(", ")}</div>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Session Flow</h2>
            <StatusPill tone="neutral">{flow.length} Activity</StatusPill>
          </div>

          <Link
            href={`/misc/drill-bank?forLessonPlan=${id}${plan.sportKey ? `&sportKey=${plan.sportKey}` : ""}`}
            className="block w-full rounded-full border border-accent px-4 py-2 text-center text-sm font-semibold text-accent hover:bg-accent/10"
          >
            + Add Drills from Drill Bank
          </Link>

          {flow.length === 0 ? (
            <p className="text-sm text-text-secondary">No drills added yet — add some from the Drill Bank above.</p>
          ) : (
            <div className="space-y-2">
              {flow.map((step, i) => (
                <div key={`${step.drillId}-${i}`} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-text">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-sm text-text-primary">{step.drillTitle}</div>
                      {step.category && <div className="text-xs text-text-muted">{step.category}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span>{step.durationMin} min</span>
                    <button onClick={() => moveStep(i, -1)} className="hover:text-accent">
                      ↑
                    </button>
                    <button onClick={() => moveStep(i, 1)} className="hover:text-accent">
                      ↓
                    </button>
                    <button onClick={() => removeStep(i)} className="hover:text-danger">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSaveFlow}
            disabled={saving}
            className="w-full rounded-full border border-border py-2 text-sm text-text-secondary hover:bg-surface-alt disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save session flow"}
          </button>
        </Card>
      </div>
    </div>
  );
}
