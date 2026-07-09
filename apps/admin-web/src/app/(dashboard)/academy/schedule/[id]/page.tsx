"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { Card, PrimaryButton, StatusPill } from "@/components/ui";
import type { AttendanceStatus, ScheduledSession } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = { not_started: "Not started", ongoing: "Ongoing", completed: "Completed" };

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<ScheduledSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiJson<ScheduledSession>(`/schedule/${id}`);
      setSession(data);
      const existing: Record<string, AttendanceStatus> = {};
      for (const record of data.attendanceRecords ?? []) {
        if (record.clientId) existing[record.clientId] = record.status;
      }
      setMarks(existing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load session.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleStart() {
    setBusy(true);
    try {
      await apiJson(`/schedule/${id}/start`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  function markAllPresent() {
    const roster = session?.class.enrollments ?? [];
    const next: Record<string, AttendanceStatus> = {};
    for (const e of roster) next[e.clientId] = "present";
    setMarks(next);
  }

  async function handleSaveAttendance() {
    setSaving(true);
    try {
      const records = Object.entries(marks).map(([clientId, status]) => ({ clientId, status }));
      await apiJson(`/schedule/${id}/attendance`, { method: "POST", body: JSON.stringify({ records }) });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setBusy(true);
    try {
      await apiJson(`/schedule/${id}/complete`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !session) return <p className="text-sm text-danger">{error ?? "Session not found."}</p>;

  const roster = session.class.enrollments ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/academy/schedule" className="text-sm text-text-secondary hover:text-accent">
          ← Class Schedule
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Schedule Info</h1>
        <p className="text-sm text-text-secondary">{session.sessionDate.slice(0, 10)}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-text-primary">{session.class.title}</span>
            <StatusPill tone={session.status === "completed" ? "success" : session.status === "ongoing" ? "info" : "neutral"}>
              {STATUS_LABEL[session.status]}
            </StatusPill>
          </div>
          <div className="text-sm text-text-secondary">Coached by {session.class.coach?.user.name ?? "Unassigned"}</div>
          <div className="text-sm text-text-secondary">{session.class.center.name}</div>
          <div className="text-sm text-text-secondary">
            {session.startTime.slice(11, 16)}–{session.endTime.slice(11, 16)}
          </div>
          <div className="text-sm text-text-secondary">{roster.length} clients</div>

          {session.status === "not_started" && (
            <PrimaryButton onClick={handleStart} disabled={busy} className="mt-2">
              {busy ? "Starting…" : "▶ Start session"}
            </PrimaryButton>
          )}
          {session.status === "ongoing" && (
            <PrimaryButton onClick={handleComplete} disabled={busy} className="mt-2">
              {busy ? "Completing…" : "✓ Mark session complete"}
            </PrimaryButton>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Roster &amp; attendance</h2>
            <button onClick={markAllPresent} className="text-xs text-accent hover:underline">
              Mark all present
            </button>
          </div>

          {roster.length === 0 ? (
            <p className="text-sm text-text-secondary">No clients enrolled in this class yet.</p>
          ) : (
            <div className="space-y-2">
              {roster.map((e) => (
                <div key={e.clientId} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <div className="text-sm text-text-primary">{e.client.name}</div>
                    <div className="text-xs text-text-muted">{e.plan.title}</div>
                  </div>
                  <div className="flex gap-1">
                    {(["present", "late", "absent"] as AttendanceStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setMarks((prev) => ({ ...prev, [e.clientId]: s }))}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                          marks[e.clientId] === s
                            ? s === "present"
                              ? "bg-success text-accent-text"
                              : s === "late"
                                ? "bg-warning text-accent-text"
                                : "bg-danger text-accent-text"
                            : "border border-border text-text-secondary"
                        }`}
                      >
                        {s[0]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <PrimaryButton onClick={handleSaveAttendance} disabled={saving} className="mt-2">
                {saving ? "Saving…" : "Save attendance"}
              </PrimaryButton>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
