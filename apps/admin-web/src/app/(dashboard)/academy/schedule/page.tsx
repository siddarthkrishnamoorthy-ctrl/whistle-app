"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiJson } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Card, EmptyState, Field, StatusPill, Table } from "@/components/ui";
import type { ScheduledSession, SessionStatus } from "@/lib/types";

const STATUS_TONE: Record<SessionStatus, "neutral" | "info" | "success"> = {
  not_started: "neutral",
  ongoing: "info",
  completed: "success",
};

const STATUS_LABEL: Record<SessionStatus, string> = {
  not_started: "Not started",
  ongoing: "Ongoing",
  completed: "Completed",
};

export default function ClassSchedulePage() {
  const { loading: authLoading, user } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    apiJson<ScheduledSession[]>(`/schedule?date=${date}`)
      .then(setSessions)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [authLoading, user, date]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Class Schedule</h1>
          <p className="text-sm text-text-secondary">Sessions scheduled for the selected date.</p>
        </div>
        <Field label="" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState message="No sessions scheduled for this date." />
        </Card>
      ) : (
        <Table columns={["Class", "Coach", "Timing", "Status", ""]}>
          {sessions.map((session) => (
            <tr key={session.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3 font-medium text-text-primary">{session.class.title}</td>
              <td className="px-4 py-3 text-text-secondary">{session.class.coach?.user.name ?? "Unassigned"}</td>
              <td className="px-4 py-3 text-text-secondary">
                {session.startTime.slice(11, 16)}–{session.endTime.slice(11, 16)}
              </td>
              <td className="px-4 py-3">
                <StatusPill tone={STATUS_TONE[session.status]}>{STATUS_LABEL[session.status]}</StatusPill>
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/academy/schedule/${session.id}`} className="text-sm text-accent hover:underline">
                  {session.status === "completed" ? "View" : "Open"}
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
