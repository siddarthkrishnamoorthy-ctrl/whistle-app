"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, SelectField, StatusPill } from "@/components/ui";
import type { Plan, WhistleClass } from "@/lib/types";

function formatCurrency(amount: string) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const { data: classes } = useApiList<WhistleClass>("/classes");

  async function load() {
    setLoading(true);
    try {
      const data = await apiJson<Plan>(`/plans/${id}`);
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const linkedClassIds = new Set((plan?.classPlans ?? []).map((cp) => cp.class.id));
  const availableToLink = classes.filter((c) => !linkedClassIds.has(c.id));

  async function handleLink(classId: string) {
    if (!classId) return;
    setLinking(true);
    try {
      await apiJson(`/plans/${id}/link-class`, { method: "POST", body: JSON.stringify({ classId }) });
      await load();
    } finally {
      setLinking(false);
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !plan) return <p className="text-sm text-danger">{error ?? "Plan not found."}</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/academy/plans" className="text-sm text-text-secondary hover:text-accent">
          ← Plans
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{plan.title}</h1>
        <p className="text-sm text-text-secondary">Subscription plan</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-semibold">{formatCurrency(plan.fee)}</span>
            {plan.durationValue && plan.durationUnit && (
              <StatusPill tone="info">
                {plan.durationValue} {plan.durationUnit}
              </StatusPill>
            )}
          </div>
          <div className="space-y-2 text-sm text-text-secondary">
            <div>{plan.clientsCount ?? 0} clients enrolled</div>
            <div>{plan.sessionsIncluded ?? "—"} sessions · {plan.makeupsIncluded} make-ups</div>
            <div>Auto-renew {plan.autoRenewDefault ? <span className="text-success">enabled</span> : "disabled"}</div>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Linked classes</h2>
          <div className="space-y-2">
            {(plan.classPlans ?? []).length === 0 && (
              <p className="text-sm text-text-secondary">No classes linked yet.</p>
            )}
            {(plan.classPlans ?? []).map((cp) => (
              <Link
                key={cp.class.id}
                href={`/academy/classes/${cp.class.id}`}
                className="block rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-alt"
              >
                {cp.class.title}
              </Link>
            ))}
          </div>
          {availableToLink.length > 0 && (
            <SelectField
              label="Link a class"
              disabled={linking}
              onChange={(e) => handleLink(e.target.value)}
              value=""
            >
              <option value="">Select a class…</option>
              {availableToLink.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </SelectField>
          )}
        </Card>
      </div>
    </div>
  );
}
