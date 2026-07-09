"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, Field, SelectField, StatusPill } from "@/components/ui";
import type { Plan, SyllabusProgress, WhistleClass } from "@/lib/types";

const DAY_LABEL: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [klass, setKlass] = useState<WhistleClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return d.toISOString().slice(0, 10);
  });
  const { data: plans } = useApiList<Plan>("/plans");
  const [syllabus, setSyllabus] = useState<SyllabusProgress | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiJson<WhistleClass>(`/classes/${id}`);
      setKlass(data);
      if (data.gradeId) {
        apiJson<SyllabusProgress>(`/classes/${id}/syllabus-progress`).then(setSyllabus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load class.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const linkedPlanIds = new Set((klass?.classPlans ?? []).map((cp) => cp.plan.id));
  const availableToLink = plans.filter((p) => !linkedPlanIds.has(p.id));

  async function handleLinkPlan(planId: string) {
    if (!planId) return;
    setLinking(true);
    try {
      await apiJson(`/plans/${planId}/link-class`, { method: "POST", body: JSON.stringify({ classId: id }) });
      await load();
    } finally {
      setLinking(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await apiJson<{ created: number }>("/schedule/generate", {
        method: "POST",
        body: JSON.stringify({ classId: id, fromDate, toDate }),
      });
      alert(`Created ${result.created} session(s). View them in Class Schedule.`);
      router.push("/academy/schedule");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not generate sessions.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !klass) return <p className="text-sm text-danger">{error ?? "Class not found."}</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/academy/classes" className="text-sm text-text-secondary hover:text-accent">
          ← Classes
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{klass.title}</h1>
        <p className="text-sm text-text-secondary">
          {klass.sport.name} · {klass.center.name}
        </p>
      </div>

      {syllabus?.hasCurriculum && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Syllabus progress</h2>
            <StatusPill tone="info">
              Lesson {Math.min(syllabus.nextSequenceNo ?? 1, syllabus.totalLessons ?? 0)} of {syllabus.totalLessons}
            </StatusPill>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
            <div
              className="h-full bg-accent"
              style={{
                width: `${syllabus.totalLessons ? ((syllabus.deliveredCount ?? 0) / syllabus.totalLessons) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="text-xs text-text-muted">{syllabus.deliveredCount} of {syllabus.totalLessons} lessons delivered</div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusPill tone={klass.status === "active" ? "success" : "neutral"}>{klass.status}</StatusPill>
            <StatusPill tone="info">{klass.mode ?? "offline"}</StatusPill>
            <StatusPill tone="neutral">{klass.level ?? "—"}</StatusPill>
          </div>
          <div className="text-sm text-text-secondary">
            {klass._count?.enrollments ?? 0}
            {klass.capacity ? `/${klass.capacity}` : ""} active clients
          </div>
          <div className="text-sm text-text-secondary">Center: {klass.center.name}</div>
          <div className="text-sm text-text-secondary">Coach: {klass.coach?.user.name ?? "Unassigned"}</div>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Plans</h2>
          {(klass.classPlans ?? []).length === 0 && <p className="text-sm text-text-secondary">No plans linked yet.</p>}
          {(klass.classPlans ?? []).map((cp) => (
            <Link
              key={cp.plan.id}
              href={`/academy/plans/${cp.plan.id}`}
              className="block rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-alt"
            >
              {cp.plan.title}
            </Link>
          ))}
          {availableToLink.length > 0 && (
            <SelectField label="Link a plan" disabled={linking} onChange={(e) => handleLinkPlan(e.target.value)} value="">
              <option value="">Select a plan…</option>
              {availableToLink.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </SelectField>
          )}
        </Card>
      </div>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Timings</h2>
        {(klass.timings ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">No recurring timing set.</p>
        ) : (
          <div className="space-y-1 text-sm text-text-secondary">
            {(klass.timings ?? []).map((t, i) => (
              <div key={i}>
                {t.days.map((d) => DAY_LABEL[d] ?? d).join(", ")} · {t.startTime}–{t.endTime}
              </div>
            ))}
          </div>
        )}

        {(klass.timings ?? []).length > 0 && (
          <div className="flex items-end gap-3 border-t border-border pt-3">
            <Field label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Field label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="h-[42px] rounded-full bg-accent px-5 text-sm font-semibold text-accent-text hover:opacity-90 disabled:opacity-50"
            >
              {generating ? "Generating…" : "Generate sessions"}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
