"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, CollapsibleSection, EmptyState, MetricTile, SearchInput, StatusPill, Table } from "@/components/ui";
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

const STATUS_FILTERS = ["all", "active", "due", "overdue", "stopped"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ClientsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const { data: clients, loading, error, refetch } = useApiList<Client>("/clients");

  // Summary counts for the metric strip (a light infographic over the list).
  const counts = useMemo(() => {
    const c = { total: clients.length, active: 0, due: 0, overdue: 0, dueAmount: 0 };
    for (const cl of clients) {
      const s = cl.status ?? "active";
      if (s === "active" || s === "renewed") c.active++;
      else if (s === "due") c.due++;
      else if (s === "overdue") c.overdue++;
      c.dueAmount += cl.balanceDue ?? 0;
    }
    return c;
  }, [clients]);

  // Filter by search + status, then group by class so the page opens compact.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = clients.filter((c) => {
      const s = c.status ?? "active";
      const statusOk = status === "all" || s === status || (status === "active" && s === "renewed");
      if (!statusOk) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });
    const map = new Map<string, Client[]>();
    for (const c of filtered) {
      const key = c.enrollments?.[0]?.class.title ?? "Unassigned";
      (map.get(key) ?? map.set(key, []).get(key)!).push(c);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [clients, query, status]);

  const shownCount = groups.reduce((n, [, list]) => n + list.length, 0);

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
            className="flex items-center gap-1.5 rounded-full border border-accent/60 px-5 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
          >
            <Upload className="h-4 w-4" strokeWidth={2} /> Import CSV
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> New Student
          </button>
        </div>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {!loading && clients.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Students" value={counts.total} tone="accent" />
            <MetricTile label="Active" value={counts.active} tone="success" />
            <MetricTile label="Due / overdue" value={counts.due + counts.overdue} tone={counts.overdue ? "danger" : "warning"} />
            <MetricTile label="Balance due" value={formatCurrency(counts.dueAmount)} tone={counts.dueAmount ? "warning" : "neutral"} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search students by name, phone or email…"
              className="min-w-[260px] flex-1"
            />
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={
                    status === s
                      ? "rounded-full border border-accent bg-accent/15 px-3 py-1.5 text-xs font-semibold capitalize text-accent"
                      : "rounded-full border border-border bg-surface-alt px-3 py-1.5 text-xs font-medium capitalize text-text-secondary hover:border-white/30"
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : clients.length === 0 ? (
        <Card>
          <EmptyState message="No students yet." />
        </Card>
      ) : shownCount === 0 ? (
        <Card>
          <EmptyState message="No students match your search." />
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(([className, list]) => (
            <CollapsibleSection
              key={className}
              title={className}
              count={list.length}
              defaultOpen={groups.length <= 6}
            >
              <Table flush columns={["Student", "Plan", "Status", "Balance"]}>
                {list.map((client) => {
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
            </CollapsibleSection>
          ))}
        </div>
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
