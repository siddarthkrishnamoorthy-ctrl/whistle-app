"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, EmptyState, OutlineButton, StatusPill, Table } from "@/components/ui";
import type { Invoice, InvoiceSummary } from "@/lib/types";
import { NewInvoiceModal, type CreateInvoicePayload } from "./new-invoice-modal";

function formatCurrency(amount: number | string) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export default function InvoicesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const { data: invoices, loading, error, refetch } = useApiList<Invoice>("/invoices");

  function loadSummary() {
    apiJson<InvoiceSummary>("/invoices/summary").then(setSummary).catch(() => {});
  }

  useEffect(() => {
    loadSummary();
  }, []);

  async function handleMarkPaid(id: string) {
    setMarkingPaidId(id);
    try {
      await apiJson(`/invoices/${id}/mark-paid`, { method: "POST" });
      refetch();
      loadSummary();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not mark invoice as paid.");
    } finally {
      setMarkingPaidId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Invoices</h1>
          <p className="text-sm text-text-secondary">{invoices.length} invoices</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          + New Invoice
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <div className="text-xs text-text-secondary">Total invoiced</div>
            <div className="mt-1 text-lg font-semibold text-text-primary">{formatCurrency(summary.totalInvoiced)}</div>
          </Card>
          <Card>
            <div className="text-xs text-text-secondary">Received</div>
            <div className="mt-1 text-lg font-semibold text-success">{formatCurrency(summary.received)}</div>
          </Card>
          <Card>
            <div className="text-xs text-text-secondary">Outstanding</div>
            <div className="mt-1 text-lg font-semibold text-warning">{formatCurrency(summary.outstanding)}</div>
          </Card>
        </div>
      )}

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : invoices.length === 0 ? (
        <Card>
          <EmptyState message="No invoices yet." />
        </Card>
      ) : (
        <Table columns={["Invoice", "Client", "Plan", "Date", "Amount", "Status", ""]}>
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3 font-medium text-text-primary">{inv.invoiceNumber}</td>
              <td className="px-4 py-3 text-text-secondary">{inv.client.name}</td>
              <td className="px-4 py-3 text-text-secondary">{inv.plan?.title ?? "—"}</td>
              <td className="px-4 py-3 text-text-secondary">{inv.issuedAt.slice(0, 10)}</td>
              <td className="px-4 py-3 text-text-secondary">{formatCurrency(inv.amount)}</td>
              <td className="px-4 py-3">
                <StatusPill tone={inv.status === "paid" ? "success" : "warning"}>{inv.status}</StatusPill>
              </td>
              <td className="px-4 py-3">
                {inv.status === "pending" && (
                  <OutlineButton
                    className="w-auto px-4 py-1.5 text-sm"
                    onClick={() => handleMarkPaid(inv.id)}
                    disabled={markingPaidId === inv.id}
                  >
                    {markingPaidId === inv.id ? "Marking…" : "Mark Paid"}
                  </OutlineButton>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <NewInvoiceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async (dto: CreateInvoicePayload) => {
          await apiJson("/invoices", { method: "POST", body: JSON.stringify(dto) });
          setModalOpen(false);
          refetch();
          loadSummary();
        }}
      />
    </div>
  );
}
