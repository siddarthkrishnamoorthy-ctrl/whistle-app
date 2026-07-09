"use client";

import { useState } from "react";
import Link from "next/link";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, OutlineButton, PrimaryButton, StatusPill, Table } from "@/components/ui";
import type { EventInvitation } from "@/lib/types";

export default function InvitationsPage() {
  const { data: invitations, loading, error, refetch } = useApiList<EventInvitation>("/interschool/invitations");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function respond(id: string, status: "accepted" | "declined") {
    setBusyId(id);
    try {
      await apiJson(`/interschool/invitations/${id}/respond`, { method: "POST", body: JSON.stringify({ status }) });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not respond to invitation.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Invitations</h1>
        <p className="text-sm text-text-secondary">Interschool events your academy has been invited to</p>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : invitations.length === 0 ? (
        <Card>
          <EmptyState message="No invitations yet." />
        </Card>
      ) : (
        <Table columns={["Event", "Host School", "Response deadline", "Status", ""]}>
          {invitations.map((inv) => (
            <tr key={inv.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3">
                {inv.event ? (
                  <Link href={`/interschool/events/${inv.event.id}`} className="font-medium text-text-primary hover:text-accent">
                    {inv.event.name}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-text-secondary">{inv.event?.hostAcademy?.name ?? "—"}</td>
              <td className="px-4 py-3 text-text-secondary">{inv.responseDeadline?.slice(0, 10) ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusPill tone={inv.status === "accepted" ? "success" : inv.status === "declined" ? "danger" : "warning"}>
                  {inv.status}
                </StatusPill>
              </td>
              <td className="px-4 py-3">
                {inv.status === "pending" && (
                  <div className="flex gap-2">
                    <PrimaryButton
                      className="w-auto px-4 py-1.5 text-xs"
                      onClick={() => respond(inv.id, "accepted")}
                      disabled={busyId === inv.id}
                    >
                      Accept
                    </PrimaryButton>
                    <OutlineButton
                      className="w-auto px-4 py-1.5 text-xs"
                      onClick={() => respond(inv.id, "declined")}
                      disabled={busyId === inv.id}
                    >
                      Decline
                    </OutlineButton>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
