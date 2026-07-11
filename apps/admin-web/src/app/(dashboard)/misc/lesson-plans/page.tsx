"use client";

// Tenant view of the lesson-plan repository (2026-07): the master library is
// curated by Whistle (the platform operator) and filtered to the sports this
// tenant has been granted. Tenants VIEW repository plans and adopt a copy
// into their academy to assign/customise — they don't author masters here.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Field, SelectField, StatusPill, Tabs } from "@/components/ui";
import type { LessonPlan, Sport } from "@/lib/types";

type StatusTab = "active" | "upcoming" | "completed";
const TABS: { key: StatusTab; label: string }[] = [
  { key: "active", label: "Repository & Active" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];
const STATUS_TONE = { active: "success", upcoming: "info", completed: "neutral" } as const;

export default function LessonPlansPage() {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("active");
  const [search, setSearch] = useState("");
  const [sportKey, setSportKey] = useState("");
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const { data: plans, loading, error, refetch } = useApiList<LessonPlan>(`/lesson-plans?status=${tab}`);
  const { data: sports } = useApiList<Sport>("/sports");

  const visiblePlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter(
      (p) =>
        (!sportKey || p.sportKey === sportKey) &&
        (!q || p.title.toLowerCase().includes(q) || (p.class?.title ?? "").toLowerCase().includes(q))
    );
  }, [plans, search, sportKey]);

  async function adopt(plan: LessonPlan) {
    setAdoptingId(plan.id);
    try {
      const copy = await apiJson<LessonPlan>(`/lesson-plans/${plan.id}/duplicate`, { method: "POST" });
      router.push(`/misc/lesson-plans/${copy.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not adopt the plan.");
      refetch();
    } finally {
      setAdoptingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Lesson Plans</h1>
          <p className="text-sm text-text-secondary">
            The <span className="font-semibold text-accent">Whistle repository</span> for your sports — use a plan to
            bring an editable copy into your academy.
          </p>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="flex gap-3">
        <Field
          label=""
          placeholder="Search plans…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <SelectField label="" value={sportKey} onChange={(e) => setSportKey(e.target.value)} className="max-w-xs">
          <option value="">All sports</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : visiblePlans.length === 0 ? (
        <Card>
          <EmptyState message={plans.length === 0 ? "No lesson plans in this category yet." : "No plans match your filters."} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visiblePlans.map((plan) => {
            const isRepository = plan.academyId == null;
            return (
              <Card key={plan.id} className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/misc/lesson-plans/${plan.id}`} className="font-medium text-text-primary hover:text-accent">
                      {plan.title}
                    </Link>
                    <p className="text-xs text-text-muted">
                      {isRepository ? "Whistle repository" : (plan.class?.title ?? "Unassigned")}
                    </p>
                  </div>
                  {isRepository ? (
                    <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                      🏛 Repository
                    </span>
                  ) : (
                    <StatusPill tone={STATUS_TONE[plan.status]}>{plan.status}</StatusPill>
                  )}
                </div>
                {plan.goals && <p className="text-sm text-text-secondary">{plan.goals}</p>}
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  {plan.sport && <span className="rounded-full bg-surface-alt px-2 py-0.5">{plan.sport.name}</span>}
                  <span className="rounded-full bg-surface-alt px-2 py-0.5">{plan.sessionFlow.length} drills</span>
                  {plan.targetDurationMin && (
                    <span className="rounded-full bg-surface-alt px-2 py-0.5">{plan.targetDurationMin} min target</span>
                  )}
                  {isRepository && (
                    <button
                      onClick={() => adopt(plan)}
                      disabled={adoptingId === plan.id}
                      className="ml-auto rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/25 disabled:opacity-50"
                    >
                      {adoptingId === plan.id ? "Adopting…" : "Use in my academy"}
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
