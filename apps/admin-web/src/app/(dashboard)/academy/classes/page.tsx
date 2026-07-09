"use client";

import { useState } from "react";
import Link from "next/link";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Table, Tabs } from "@/components/ui";
import type { ClassStatus, WhistleClass } from "@/lib/types";
import { NewClassModal, type CreateClassPayload } from "./new-class-modal";

const TABS: { key: ClassStatus; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

const DAY_LABEL: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export default function ClassesPage() {
  const [tab, setTab] = useState<ClassStatus>("active");
  const [modalOpen, setModalOpen] = useState(false);
  const { data: classes, loading, error, refetch } = useApiList<WhistleClass>("/classes");

  const filtered = classes.filter((c) => c.status === tab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Classes</h1>
          <p className="text-sm text-text-secondary">Recurring coached sessions by sport, skill and center.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          + New Class
        </button>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState message="No classes in this category yet." />
        </Card>
      ) : (
        <Table columns={["Title", "Days", "Plans", "Enrolled", "Level", "Coach"]}>
          {filtered.map((klass) => {
            const days = (klass.timings ?? []).flatMap((t) => t.days).map((d) => DAY_LABEL[d] ?? d);
            return (
              <tr key={klass.id} className="hover:bg-surface-alt">
                <td className="px-4 py-3">
                  <Link href={`/academy/classes/${klass.id}`} className="font-medium text-text-primary hover:text-accent">
                    {klass.title}
                  </Link>
                  <div className="text-xs text-text-muted">{klass.sport.name} · {klass.center.name}</div>
                </td>
                <td className="px-4 py-3 text-text-secondary">{days.length > 0 ? [...new Set(days)].join(", ") : "—"}</td>
                <td className="px-4 py-3 text-text-secondary">{klass._count?.classPlans ?? 0}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {klass._count?.enrollments ?? 0}
                  {klass.capacity ? `/${klass.capacity}` : ""}
                </td>
                <td className="px-4 py-3 capitalize text-text-secondary">{klass.level ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">{klass.coach?.user.name ?? "Unassigned"}</td>
              </tr>
            );
          })}
        </Table>
      )}

      <NewClassModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async (dto: CreateClassPayload) => {
          await apiJson("/classes", { method: "POST", body: JSON.stringify(dto) });
          setModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
