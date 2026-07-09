"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiJson } from "@/lib/api-client";
import { Card, Field, OutlineButton, PrimaryButton, StatusPill } from "@/components/ui";
import type { PlatformBillingUsage, PricingTier } from "@/lib/types";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  trial: "info",
  active: "success",
  past_due: "warning",
  cancelled: "danger",
  pending_quote: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  trial: "Trial",
  active: "Active",
  past_due: "Past due",
  cancelled: "Cancelled",
  pending_quote: "Quote pending",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

// Addendum v3 5.5 — Settings > Whistle Subscription, distinct from the
// academy's own Payments tab (that one is the academy billing ITS
// customers; this one is Whistle billing the academy).
export function SubscriptionTab() {
  const [usage, setUsage] = useState<PlatformBillingUsage | null>(null);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [declaredStrength, setDeclaredStrength] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [editing, setEditing] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [u, t] = await Promise.all([
        apiJson<PlatformBillingUsage>("/platform-subscriptions/usage"),
        apiFetch("/pricing-tiers").then((res) => res.json()),
      ]);
      setUsage(u);
      setTiers(t);
      setDeclaredStrength(String(u.subscription.declaredStrength));
      setBillingCycle(u.subscription.billingCycle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load subscription.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const strengthNum = Number(declaredStrength) || 0;
  const previewTier = tiers.find(
    (t) => strengthNum >= t.minStudents && (t.maxStudents === null || strengthNum <= t.maxStudents)
  );

  async function handleChangePlan() {
    setBusy(true);
    setError(null);
    try {
      await apiJson("/platform-subscriptions", {
        method: "POST",
        body: JSON.stringify({ declaredStrength: strengthNum, billingCycle }),
      });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change plan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClosePeriod() {
    setBusy(true);
    setError(null);
    try {
      await apiJson("/internal/billing/run-period-close", { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close billing period.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPaid(invoiceId: string) {
    setBusy(true);
    try {
      await apiJson(`/platform-invoices/${invoiceId}/mark-paid`, { method: "POST" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not mark invoice paid.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Card className="text-sm text-text-secondary">Loading…</Card>;
  if (error && !usage) return <Card className="text-sm text-danger">{error}</Card>;
  if (!usage) return null;

  const { subscription } = usage;

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Current plan</h2>
          <StatusPill tone={STATUS_TONE[subscription.status] ?? "neutral"}>
            {STATUS_LABEL[subscription.status] ?? subscription.status}
          </StatusPill>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs text-text-muted">Plan</div>
            <div className="text-sm font-semibold text-text-primary">{subscription.tier.name}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Declared strength</div>
            <div className="text-sm font-semibold text-text-primary">{subscription.declaredStrength}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Active students</div>
            <div className="text-sm font-semibold text-text-primary">{usage.actualActiveStudents}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Billable count</div>
            <div className="text-sm font-semibold text-text-primary">{usage.billableStudentCount}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-border pt-3">
          <div>
            <div className="text-xs text-text-muted">Billing cycle</div>
            <div className="text-sm text-text-secondary capitalize">{subscription.billingCycle}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Current period</div>
            <div className="text-sm text-text-secondary">
              {formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Est. next invoice</div>
            <div className="text-sm text-text-secondary">
              {subscription.tier.pricePerStudentMonth ? `₹${usage.estimatedAmount.toFixed(2)}` : "Custom quote"}
            </div>
          </div>
          {subscription.trialEndsAt && (
            <div>
              <div className="text-xs text-text-muted">Trial ends</div>
              <div className="text-sm text-text-secondary">{formatDate(subscription.trialEndsAt)}</div>
            </div>
          )}
        </div>

        {subscription.status === "pending_quote" && (
          <p className="rounded-md border border-border bg-surface-alt p-3 text-xs text-text-secondary">
            Your declared strength is in our Enterprise band — the Whistle team will reach out to set up custom
            pricing. Self-serve plan changes are disabled while a quote is pending.
          </p>
        )}

        <div className="flex gap-3 border-t border-border pt-3">
          <OutlineButton className="w-auto px-6" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Change plan"}
          </OutlineButton>
          <OutlineButton className="w-auto px-6" onClick={handleClosePeriod} disabled={busy}>
            Close billing period now
          </OutlineButton>
        </div>

        {editing && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Declared students"
                type="number"
                min={1}
                value={declaredStrength}
                onChange={(e) => setDeclaredStrength(e.target.value)}
              />
              <div>
                <span className="mb-1.5 block text-sm text-text-secondary">Billing cycle</span>
                <div className="flex gap-2">
                  {(["monthly", "annual"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBillingCycle(c)}
                      className={`rounded-full border px-4 py-1.5 text-sm capitalize ${
                        billingCycle === c ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {previewTier && (
              <div className="rounded-md border border-accent/40 bg-accent/5 p-3 text-sm">
                <span className="font-semibold text-text-primary">{previewTier.name}</span>{" "}
                {previewTier.pricePerStudentMonth ? (
                  <span className="text-text-secondary">
                    · ₹{previewTier.pricePerStudentMonth}/student/month{billingCycle === "annual" ? " (15% off applied annually)" : ""}
                  </span>
                ) : (
                  <span className="text-text-secondary">· custom pricing, routed to a sales quote</span>
                )}
              </div>
            )}
            <PrimaryButton className="w-auto px-6" onClick={handleChangePlan} disabled={busy || strengthNum < 1}>
              {busy ? "Saving…" : "Confirm plan"}
            </PrimaryButton>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Invoices from Whistle</h2>
        {usage.recentInvoices.length === 0 ? (
          <p className="text-sm text-text-secondary">No invoices yet.</p>
        ) : (
          <div className="space-y-2">
            {usage.recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div>
                  <div className="text-text-primary">
                    {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                  </div>
                  <div className="text-xs text-text-muted">{inv.billableStudentCount} billable students</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-text-primary">₹{Number(inv.amount).toFixed(2)}</span>
                  <StatusPill tone={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "warning"}>
                    {inv.status}
                  </StatusPill>
                  {inv.status !== "paid" && (
                    <OutlineButton className="w-auto px-3 py-1 text-xs" onClick={() => handleMarkPaid(inv.id)} disabled={busy}>
                      Mark Paid
                    </OutlineButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
