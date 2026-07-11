"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, EmptyState, OutlineButton, StatusPill, Table } from "@/components/ui";
import type { Invoice, InvoiceBatch, InvoiceSummary } from "@/lib/types";
import { NewInvoiceModal, type CreateInvoicePayload } from "./new-invoice-modal";

function formatCurrency(amount: number | string) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export default function InvoicesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [batches, setBatches] = useState<InvoiceBatch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const { data: invoices, loading, error, refetch } = useApiList<Invoice>("/invoices");

  function loadSummary() {
    apiJson<InvoiceSummary>("/invoices/summary").then(setSummary).catch(() => {});
  }
  function loadBatches() {
    apiJson<InvoiceBatch[]>("/invoices/batches").then(setBatches).catch(() => {});
  }

  useEffect(() => {
    loadSummary();
    loadBatches();
  }, []);

  function refreshAll() {
    refetch();
    loadSummary();
    loadBatches();
  }

  async function handleMarkPaid(id: string) {
    setMarkingPaidId(id);
    try {
      await apiJson(`/invoices/${id}/mark-paid`, { method: "POST" });
      refreshAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not mark invoice as paid.");
    } finally {
      setMarkingPaidId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Batchable = pending and not already sitting in an open batch.
  const pendingBatchIds = new Set(batches.filter((b) => b.status === "pending").flatMap((b) => b.invoices.map((i) => i.id)));
  const selectedTotal = invoices.filter((i) => selected.has(i.id)).reduce((s, i) => s + Number(i.amount), 0);

  async function handleCreateBatch() {
    const title = window.prompt(
      `Batch ${selected.size} invoices (${formatCurrency(selectedTotal)}) into one payable.\nName this batch (e.g. "Term 1 · Grade 5" or the paying sponsor):`,
      `Bulk payment · ${selected.size} invoices`
    );
    if (title === null) return;
    setBatchBusy(true);
    try {
      await apiJson("/invoices/batches", {
        method: "POST",
        body: JSON.stringify({ invoiceIds: [...selected], title: title.trim() || undefined }),
      });
      setSelected(new Set());
      refreshAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not create the batch.");
    } finally {
      setBatchBusy(false);
    }
  }

  async function handlePayBatch(batch: InvoiceBatch) {
    if (!window.confirm(`Record ONE payment of ${formatCurrency(batch.totalAmount)} settling all ${batch.invoices.length} invoices in "${batch.title}"?`)) return;
    setBatchBusy(true);
    try {
      await apiJson(`/invoices/batches/${batch.id}/pay`, { method: "POST" });
      refreshAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not pay the batch.");
    } finally {
      setBatchBusy(false);
    }
  }

  async function handleDissolveBatch(batch: InvoiceBatch) {
    if (!window.confirm(`Dissolve "${batch.title}"? Its invoices go back to being individually payable.`)) return;
    setBatchBusy(true);
    try {
      await apiJson(`/invoices/batches/${batch.id}`, { method: "DELETE" });
      refreshAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not dissolve the batch.");
    } finally {
      setBatchBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Invoices</h1>
          <p className="text-sm text-text-secondary">{invoices.length} invoices</p>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <button
              onClick={handleCreateBatch}
              disabled={batchBusy || selected.size < 2}
              title={selected.size < 2 ? "Pick at least two invoices to batch" : undefined}
              className="rounded-full border border-accent/60 bg-accent/15 px-5 py-2 text-sm font-semibold text-accent hover:bg-accent/25 disabled:opacity-50"
            >
              🧾 Batch {selected.size} · {formatCurrency(selectedTotal)}
            </button>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
          >
            + New Invoice
          </button>
        </div>
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

      {batches.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Bulk payments</h2>
          {batches.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text-primary">{b.title}</span>
                  <StatusPill tone={b.status === "paid" ? "success" : "warning"}>{b.status}</StatusPill>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {b.invoices.length} invoices · {b.invoices.map((i) => i.client.name).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).join(", ")}
                  {b.payerName ? ` · paid by ${b.payerName}` : ""}
                  {b.paidAt ? ` · settled ${b.paidAt.slice(0, 10)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-text-primary">{formatCurrency(b.totalAmount)}</span>
                {b.status === "pending" && (
                  <>
                    <button
                      onClick={() => handlePayBatch(b)}
                      disabled={batchBusy}
                      className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-text hover:opacity-90 disabled:opacity-50"
                    >
                      Pay {formatCurrency(b.totalAmount)}
                    </button>
                    <button
                      onClick={() => handleDissolveBatch(b)}
                      disabled={batchBusy}
                      className="text-xs text-text-secondary hover:text-danger"
                    >
                      Dissolve
                    </button>
                  </>
                )}
              </div>
            </Card>
          ))}
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
        <Table columns={["", "Invoice", "Client", "Plan", "Date", "Amount", "Status", ""]}>
          {invoices.map((inv) => {
            const inOpenBatch = pendingBatchIds.has(inv.id);
            return (
              <tr key={inv.id} className="hover:bg-surface-alt">
                <td className="px-4 py-3">
                  {inv.status === "pending" && !inOpenBatch && (
                    <input
                      type="checkbox"
                      checked={selected.has(inv.id)}
                      onChange={() => toggleSelect(inv.id)}
                      className="accent-accent"
                      aria-label={`Select ${inv.invoiceNumber} for bulk payment`}
                    />
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-text-primary">{inv.invoiceNumber}</td>
                <td className="px-4 py-3 text-text-secondary">{inv.client.name}</td>
                <td className="px-4 py-3 text-text-secondary">{inv.plan?.title ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">{inv.issuedAt.slice(0, 10)}</td>
                <td className="px-4 py-3 text-text-secondary">{formatCurrency(inv.amount)}</td>
                <td className="px-4 py-3">
                  <StatusPill tone={inv.status === "paid" ? "success" : "warning"}>{inv.status}</StatusPill>
                </td>
                <td className="px-4 py-3">
                  {inv.status === "pending" &&
                    (inOpenBatch ? (
                      <span className="text-xs text-text-muted">In batch</span>
                    ) : (
                      <OutlineButton
                        className="w-auto px-4 py-1.5 text-sm"
                        onClick={() => handleMarkPaid(inv.id)}
                        disabled={markingPaidId === inv.id}
                      >
                        {markingPaidId === inv.id ? "Marking…" : "Mark Paid"}
                      </OutlineButton>
                    ))}
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <NewInvoiceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async (dto: CreateInvoicePayload) => {
          await apiJson("/invoices", { method: "POST", body: JSON.stringify(dto) });
          setModalOpen(false);
          refreshAll();
        }}
      />
    </div>
  );
}
