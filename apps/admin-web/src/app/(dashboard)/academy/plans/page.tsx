"use client";

import { useState } from "react";
import Link from "next/link";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Table, Tabs } from "@/components/ui";
import type { Plan, PlanType } from "@/lib/types";
import { NewPlanModal } from "./new-plan-modal";

const TABS: { key: PlanType; label: string }[] = [
  { key: "subscription", label: "Subscription" },
  { key: "trial", label: "Trial" },
  { key: "one_time", label: "One-time" },
];

function formatCurrency(amount: string) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export default function PlansPage() {
  const [tab, setTab] = useState<PlanType>("subscription");
  const [modalOpen, setModalOpen] = useState(false);
  const { data: plans, loading, error, refetch } = useApiList<Plan>("/plans");

  const filtered = plans.filter((p) => p.type === tab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Plans</h1>
          <p className="text-sm text-text-secondary">Subscription, trial and one-time pricing plans.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          + New Plan
        </button>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState message="No plans yet in this category." />
        </Card>
      ) : (
        <Table columns={["Title", "Classes", "Clients", "Make Up", "Amount"]}>
          {filtered.map((plan) => (
            <tr key={plan.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3">
                <Link href={`/academy/plans/${plan.id}`} className="font-medium text-text-primary hover:text-accent">
                  {plan.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-text-secondary">{plan.classesCount ?? 0}</td>
              <td className="px-4 py-3 text-text-secondary">{plan.clientsCount ?? 0}</td>
              <td className="px-4 py-3 text-text-secondary">{plan.makeupsIncluded}</td>
              <td className="px-4 py-3 text-text-primary">
                {formatCurrency(plan.fee)}
                {plan.durationValue && plan.durationUnit && (
                  <span className="text-text-muted"> / {plan.durationValue} {plan.durationUnit}</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <NewPlanModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultType={tab}
        onCreated={async (dto) => {
          await apiJson("/plans", { method: "POST", body: JSON.stringify(dto) });
          setModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
