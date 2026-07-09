"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { Card, StatusPill, Table, Tabs } from "@/components/ui";
import type { Client } from "@/lib/types";

function formatCurrency(amount: number | string) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

type Tab = "overview" | "payments";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiJson<Client>(`/clients/${id}`)
      .then(setClient)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load client."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !client) return <p className="text-sm text-danger">{error ?? "Client not found."}</p>;

  const activeEnrollment = client.enrollments?.[0];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/academy/clients" className="text-sm text-text-secondary hover:text-accent">
          ← Clients
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{client.name}</h1>
        <p className="text-sm text-text-secondary">
          {client.center?.name ?? "No center"} · Member since {activeEnrollment?.startDate.slice(0, 10) ?? "—"}
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-4">
        <StatusPill tone={client.status === "active" ? "success" : "warning"}>{client.status ?? "active"}</StatusPill>
        <span className="text-sm text-text-secondary">{client.phone ?? "No phone"}</span>
        <span className="text-sm text-text-secondary">{client.email ?? "No email"}</span>
        {client.linkCode && (
          <span className="rounded-full bg-surface-alt px-3 py-1 text-xs text-text-muted">
            Player code: <strong className="text-text-primary">{client.linkCode}</strong>
          </span>
        )}
      </Card>

      <Tabs
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "payments", label: "Payments" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <div className="text-xs text-text-secondary">Active plan</div>
            <div className="mt-1 text-lg font-semibold text-text-primary">{activeEnrollment?.plan.title ?? "—"}</div>
          </Card>
          <Card>
            <div className="text-xs text-text-secondary">Sessions left</div>
            <div className="mt-1 text-lg font-semibold text-text-primary">
              {activeEnrollment?.sessionsLeft ?? "—"}
            </div>
          </Card>
          <Card>
            <div className="text-xs text-text-secondary">Balance</div>
            <div className="mt-1 text-lg font-semibold text-text-primary">
              {client.balanceDue ? formatCurrency(client.balanceDue) : "Paid"}
            </div>
          </Card>
        </div>
      )}

      {tab === "payments" &&
        (client.invoices && client.invoices.length > 0 ? (
          <Table columns={["Item", "Date", "Amount", "Status"]}>
            {client.invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-surface-alt">
                <td className="px-4 py-3 text-text-primary">{inv.plan?.title ?? inv.invoiceNumber}</td>
                <td className="px-4 py-3 text-text-secondary">{inv.issuedAt.slice(0, 10)}</td>
                <td className="px-4 py-3 text-text-secondary">{formatCurrency(inv.amount)}</td>
                <td className="px-4 py-3">
                  <StatusPill tone={inv.status === "paid" ? "success" : "warning"}>{inv.status}</StatusPill>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Card className="text-sm text-text-secondary">No invoices yet.</Card>
        ))}
    </div>
  );
}
