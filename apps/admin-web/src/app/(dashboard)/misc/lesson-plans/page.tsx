"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Field, SelectField, StatusPill, Tabs } from "@/components/ui";
import type { LessonPlan, Sport } from "@/lib/types";
import { NewLessonPlanModal, type CreateLessonPlanPayload } from "./new-lesson-plan-modal";

type StatusTab = "active" | "upcoming" | "completed";
const TABS: { key: StatusTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];
const STATUS_TONE = { active: "success", upcoming: "info", completed: "neutral" } as const;

export default function LessonPlansPage() {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sportKey, setSportKey] = useState("");
  const { data: plans, loading, error } = useApiList<LessonPlan>(`/lesson-plans?status=${tab}`);
  const { data: sports } = useApiList<Sport>("/sports");

  const visiblePlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter(
      (p) =>
        (!sportKey || p.sportKey === sportKey) &&
        (!q || p.title.toLowerCase().includes(q) || (p.class?.title ?? "").toLowerCase().includes(q))
    );
  }, [plans, search, sportKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Lesson Plan Builder</h1>
          <p className="text-sm text-text-secondary">Build session flows from the Drill Bank.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          Publish Plan
        </button>
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
          {visiblePlans.map((plan) => (
            <Card key={plan.id} className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/misc/lesson-plans/${plan.id}`} className="font-medium text-text-primary hover:text-accent">
                    {plan.title}
                  </Link>
                  <p className="text-xs text-text-muted">{plan.class?.title ?? "Unassigned"}</p>
                </div>
                <StatusPill tone={STATUS_TONE[plan.status]}>{plan.status}</StatusPill>
              </div>
              {plan.goals && <p className="text-sm text-text-secondary">{plan.goals}</p>}
              <div className="flex gap-2 text-xs text-text-muted">
                {plan.sport && <span className="rounded-full bg-surface-alt px-2 py-0.5">{plan.sport.name}</span>}
                <span className="rounded-full bg-surface-alt px-2 py-0.5">{plan.sessionFlow.length} drills</span>
                {plan.targetDurationMin && (
                  <span className="rounded-full bg-surface-alt px-2 py-0.5">{plan.targetDurationMin} min target</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewLessonPlanModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async (dto: CreateLessonPlanPayload) => {
          const created = await apiJson<LessonPlan>("/lesson-plans", { method: "POST", body: JSON.stringify(dto) });
          setModalOpen(false);
          router.push(`/misc/lesson-plans/${created.id}`);
        }}
      />
    </div>
  );
}
