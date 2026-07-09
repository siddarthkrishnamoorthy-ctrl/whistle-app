"use client";

import { useState } from "react";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, PrimaryButton, StatusPill, Table, Tabs } from "@/components/ui";
import type { EnrollmentStatus, FullEnrollment } from "@/lib/types";

const TABS: { key: EnrollmentStatus; label: string }[] = [
  { key: "due", label: "Due" },
  { key: "overdue", label: "Overdue" },
  { key: "renewed", label: "Renewed" },
  { key: "stopped", label: "Stopped" },
];

const STATUS_TONE: Record<EnrollmentStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  due: "warning",
  overdue: "danger",
  renewed: "success",
  stopped: "neutral",
};

export default function RenewalsPage() {
  const [tab, setTab] = useState<EnrollmentStatus>("due");
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const { data: enrollments, loading, error, refetch } = useApiList<FullEnrollment>(`/renewals?status=${tab}`);

  async function handleRenew(enrollmentId: string) {
    setRenewingId(enrollmentId);
    try {
      await apiJson(`/renewals/${enrollmentId}/renew`, { method: "POST" });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not renew.");
    } finally {
      setRenewingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Renewals</h1>
        <p className="text-sm text-text-secondary">{enrollments.length} enrollments</p>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : enrollments.length === 0 ? (
        <Card>
          <EmptyState message="No enrollments in this category." />
        </Card>
      ) : (
        <Table columns={["Client", "Plan", "Class", "Ends", "Status", ""]}>
          {enrollments.map((e) => (
            <tr key={e.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3 font-medium text-text-primary">{e.client.name}</td>
              <td className="px-4 py-3 text-text-secondary">{e.plan.title}</td>
              <td className="px-4 py-3 text-text-secondary">{e.class.title}</td>
              <td className="px-4 py-3 text-text-secondary">{e.endDate.slice(0, 10)}</td>
              <td className="px-4 py-3">
                <StatusPill tone={STATUS_TONE[e.status]}>{e.status}</StatusPill>
              </td>
              <td className="px-4 py-3">
                {e.status !== "renewed" && (
                  <PrimaryButton
                    className="w-auto px-4 py-1.5 text-sm"
                    onClick={() => handleRenew(e.id)}
                    disabled={renewingId === e.id}
                  >
                    {renewingId === e.id ? "Renewing…" : "Renew"}
                  </PrimaryButton>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
