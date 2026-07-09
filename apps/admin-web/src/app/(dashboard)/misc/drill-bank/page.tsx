"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApiList } from "@/lib/hooks";
import { apiJson, assetUrl } from "@/lib/api-client";
import { Card, EmptyState, Field, SelectField, StatusPill } from "@/components/ui";
import type { Drill, LessonPlan, Sport } from "@/lib/types";
import { NewDrillModal, type CreateDrillPayload } from "./new-drill-modal";

const LEVEL_TONE = { beginner: "success", intermediate: "warning", advanced: "danger", elite: "info" } as const;

export default function DrillBankPage() {
  const searchParams = useSearchParams();
  const forLessonPlan = searchParams.get("forLessonPlan");

  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sportKey, setSportKey] = useState(searchParams.get("sportKey") ?? "");
  const { data: sports } = useApiList<Sport>("/sports");

  const [targetPlan, setTargetPlan] = useState<LessonPlan | null>(null);
  const [addedDrillIds, setAddedDrillIds] = useState<string[]>([]);
  const [addingDrillId, setAddingDrillId] = useState<string | null>(null);

  useEffect(() => {
    if (!forLessonPlan) return;
    apiJson<LessonPlan>(`/lesson-plans/${forLessonPlan}`).then(setTargetPlan);
  }, [forLessonPlan]);

  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (sportKey) query.set("sportKey", sportKey);
  const path = `/drills${query.toString() ? `?${query}` : ""}`;
  const { data: drills, loading, error, refetch } = useApiList<Drill>(path);

  async function handleAddToLessonPlan(drill: Drill) {
    if (!targetPlan) return;
    setAddingDrillId(drill.id);
    try {
      const nextFlow = [
        ...targetPlan.sessionFlow,
        {
          order: targetPlan.sessionFlow.length,
          drillId: drill.id,
          drillTitle: drill.title,
          durationMin: drill.durationMin ?? 10,
          category: drill.skillCategory ?? undefined,
        },
      ];
      const updated = await apiJson<LessonPlan>(`/lesson-plans/${forLessonPlan}`, {
        method: "PATCH",
        body: JSON.stringify({ sessionFlow: nextFlow }),
      });
      setTargetPlan(updated);
      setAddedDrillIds((prev) => [...prev, drill.id]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not add drill to lesson plan.");
    } finally {
      setAddingDrillId(null);
    }
  }

  return (
    <div className="space-y-6">
      {forLessonPlan && (
        <Card className="flex items-center justify-between border-accent bg-accent/10">
          <div>
            <div className="text-sm font-semibold text-text-primary">
              Adding drills to: {targetPlan?.title ?? "Lesson plan"}
            </div>
            <div className="text-xs text-text-secondary">
              {targetPlan ? `${targetPlan.sessionFlow.length} drill(s) in this plan so far` : "Loading plan…"}
            </div>
          </div>
          <Link
            href={`/misc/lesson-plans/${forLessonPlan}`}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
          >
            ✓ Done
          </Link>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Drill Bank</h1>
          <p className="text-sm text-text-secondary">Sport-specific drills for lesson plans.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          + New Drill
        </button>
      </div>

      <div className="flex gap-3">
        <Field
          label=""
          placeholder="Search drills…"
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
      ) : drills.length === 0 ? (
        <Card>
          <EmptyState message="No drills yet — add your first one." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drills.map((drill) => {
            const diagram = drill.media?.find((m) => m.type === "diagram");
            const video = drill.media?.find((m) => m.type === "video");
            return (
              <Card key={drill.id} className="space-y-2">
                {diagram && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assetUrl(diagram.url)}
                    alt={`${drill.title} diagram`}
                    className="h-32 w-full rounded-md border border-border object-cover"
                  />
                )}
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-text-primary">{drill.title}</h3>
                  {drill.level && <StatusPill tone={LEVEL_TONE[drill.level]}>{drill.level}</StatusPill>}
                </div>
                <p className="text-xs text-text-muted">
                  {drill.sport.name}
                  {drill.skillCategory ? ` · ${drill.skillCategory}` : ""}
                </p>
                {drill.description && <p className="text-sm text-text-secondary">{drill.description}</p>}
                <div className="flex flex-wrap gap-1 text-xs text-text-muted">
                  {drill.durationMin && <span className="rounded-full bg-surface-alt px-2 py-0.5">{drill.durationMin} min</span>}
                  {drill.ageGroups.map((g) => (
                    <span key={g} className="rounded-full bg-surface-alt px-2 py-0.5">
                      {g}
                    </span>
                  ))}
                </div>
                {video && (
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    ▶ Watch video
                  </a>
                )}
                {forLessonPlan && (
                  <button
                    onClick={() => handleAddToLessonPlan(drill)}
                    disabled={addingDrillId === drill.id || !targetPlan}
                    className="w-full rounded-full border border-accent px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent/10 disabled:opacity-50"
                  >
                    {addingDrillId === drill.id
                      ? "Adding…"
                      : addedDrillIds.includes(drill.id)
                        ? "✓ Added — add again"
                        : "+ Add to Lesson Plan"}
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <NewDrillModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async (dto: CreateDrillPayload) => {
          await apiJson("/drills", { method: "POST", body: JSON.stringify(dto) });
          setModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
