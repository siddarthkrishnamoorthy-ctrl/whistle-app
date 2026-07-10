"use client";

import { useState } from "react";
import Link from "next/link";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, StatusPill, Table } from "@/components/ui";
import type { Client } from "@/lib/types";
import { NewClientModal, type CreateClientPayload } from "./new-client-modal";
import { ImportClientsModal } from "./import-modal";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  due: "warning",
  overdue: "danger",
  renewed: "success",
  stopped: "neutral",
};

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ClientsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { data: clients, loading, error, refetch } = useApiList<Client>("/clients");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Students</h1>
          <p className="text-sm text-text-secondary">{clients.length} students</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="rounded-full border border-accent/60 px-5 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
          >
            ⬆ Import CSV
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
          >
            + New Student
          </button>
        </div>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : clients.length === 0 ? (
        <Card>
          <EmptyState message="No clients yet." />
        </Card>
      ) : (
        <Table columns={["Client", "Plan", "Class", "Status", "Balance"]}>
          {clients.map((client) => {
            const enrollment = client.enrollments?.[0];
            return (
              <tr key={client.id} className="hover:bg-surface-alt">
                <td className="px-4 py-3">
                  <Link href={`/academy/clients/${client.id}`} className="font-medium text-text-primary hover:text-accent">
                    {client.name}
                  </Link>
                  <div className="text-xs text-text-muted">{client.phone ?? client.email ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-text-secondary">{enrollment?.plan.title ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">{enrollment?.class.title ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusPill tone={STATUS_TONE[client.status ?? "active"] ?? "neutral"}>
                    {client.status ?? "active"}
                  </StatusPill>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {client.balanceDue ? formatCurrency(client.balanceDue) : "Paid"}
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <NewClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async (dto: CreateClientPayload) => {
          await apiJson("/clients", { method: "POST", body: JSON.stringify(dto) });
          setModalOpen(false);
          refetch();
        }}
      />

      <ImportClientsModal open={importOpen} onClose={() => setImportOpen(false)} onImported={refetch} />
    </div>
  );
}
