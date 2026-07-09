"use client";

import { useState } from "react";
import Link from "next/link";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, StatusPill, Table, Tabs } from "@/components/ui";
import type { EventStatus, InterschoolEvent } from "@/lib/types";
import { NewEventModal, type CreateEventPayload } from "./new-event-modal";

const TABS: { key: EventStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "closed", label: "Closed" },
];

const STATUS_TONE: Record<EventStatus, "neutral" | "warning" | "success" | "info"> = {
  draft: "neutral",
  scheduled: "info",
  live: "warning",
  completed: "success",
  closed: "neutral",
};

export default function InterschoolEventsPage() {
  const [tab, setTab] = useState<EventStatus>("draft");
  const [modalOpen, setModalOpen] = useState(false);
  const { data: events, loading, error, refetch } = useApiList<InterschoolEvent>(`/interschool/events?status=${tab}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Interschool Events</h1>
          <p className="text-sm text-text-secondary">Cross-academy tournaments and dual meets</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          + New Event
        </button>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : events.length === 0 ? (
        <Card>
          <EmptyState message="No events in this category yet." />
        </Card>
      ) : (
        <Table columns={["Event", "Host", "Sports", "Dates", "Status", "Fixtures"]}>
          {events.map((e) => (
            <tr key={e.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3">
                <Link href={`/interschool/events/${e.id}`} className="font-medium text-text-primary hover:text-accent">
                  {e.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-text-secondary">{e.hostAcademy.name}</td>
              <td className="px-4 py-3 text-text-secondary">{e.sports.join(", ")}</td>
              <td className="px-4 py-3 text-text-secondary">
                {e.startDate.slice(0, 10)} → {e.endDate.slice(0, 10)}
              </td>
              <td className="px-4 py-3">
                <StatusPill tone={STATUS_TONE[e.status]}>{e.status}</StatusPill>
              </td>
              <td className="px-4 py-3 text-text-secondary">{e._count?.fixtures ?? 0}</td>
            </tr>
          ))}
        </Table>
      )}

      <NewEventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async (dto: CreateEventPayload) => {
          const created = await apiJson<InterschoolEvent>("/interschool/events", {
            method: "POST",
            body: JSON.stringify(dto),
          });
          setModalOpen(false);
          refetch();
          window.location.href = `/interschool/events/${created.id}`;
        }}
      />
    </div>
  );
}
