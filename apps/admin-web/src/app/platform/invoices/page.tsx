"use client";

// Platform invoices — what Whistle bills its tenants (raised by per-tenant
// "Close billing period" on the Tenants page).

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, StatusPill, Table } from "@/components/ui";
import { inr, PageHeader, type PlatformInvoice } from "../platform-ui";

export default function PlatformInvoicesPage() {
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    apiJson<PlatformInvoice[]>("/platform/invoices")
      .then(setInvoices)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function markPaid(id: string) {
    setBusyId(id);
    try {
      await apiJson(`/platform/invoices/${id}/mark-paid`, { method: "POST" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not mark paid.");
    } finally {
      setBusyId(null);
    }
  }

  const collected = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const outstanding = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Invoices" subtitle={`${invoices.length} invoices raised to tenants`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <div className="text-xs text-text-secondary">Collected</div>
          <div className="mt-1 text-lg font-semibold text-success">{inr(collected)}</div>
        </Card>
        <Card>
          <div className="text-xs text-text-secondary">Outstanding</div>
          <div className="mt-1 text-lg font-semibold text-warning">{inr(outstanding)}</div>
        </Card>
      </div>

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : invoices.length === 0 ? (
        <Card>
          <EmptyState message='No platform invoices yet — use "Close billing period" on a tenant.' />
        </Card>
      ) : (
        <Table columns={["Tenant", "Issued", "Billable students", "Amount", "Status", ""]}>
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3 font-medium text-text-primary">{inv.academy.name}</td>
              <td className="px-4 py-3 text-text-secondary">{inv.issuedAt.slice(0, 10)}</td>
              <td className="px-4 py-3 text-text-secondary">{inv.billableStudentCount}</td>
              <td className="px-4 py-3 text-text-secondary">{inr(inv.amount)}</td>
              <td className="px-4 py-3">
                <StatusPill tone={inv.status === "paid" ? "success" : "warning"}>{inv.status}</StatusPill>
              </td>
              <td className="px-4 py-3">
                {inv.status === "pending" && (
                  <button
                    onClick={() => markPaid(inv.id)}
                    disabled={busyId === inv.id}
                    className="rounded-full border border-accent/60 bg-accent/15 px-4 py-1.5 text-xs font-semibold text-accent hover:bg-accent/25 disabled:opacity-50"
                  >
                    {busyId === inv.id ? "Marking…" : "Mark Paid"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
