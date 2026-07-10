"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, StatusPill, Table } from "@/components/ui";

interface StaffLogRow {
  id: string;
  date: string;
  startTime: string | null;
  classTitle: string;
  center: string;
  centerHasPin: boolean;
  user: { id: string; name: string } | null;
  status: string;
  distanceM: number | null;
  withinFence: boolean | null;
  biometric: boolean | null;
}

export default function UserAttendancePage() {
  const [rows, setRows] = useState<StaffLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<StaffLogRow[]>("/attendance/staff?days=30")
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load attendance."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">User Attendance</h1>
        <p className="text-sm text-text-secondary">
          Location-verified check-ins from the last 30 days — coaches must be within 100 m of the center pin to start a
          session
        </p>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState message="No location-verified sessions yet. Check-ins appear here as coaches start sessions." />
        </Card>
      ) : (
        <Table columns={["Date", "User", "Session", "Center", "Check-in", "Biometric"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-text-secondary">
                {new Date(r.date).toLocaleDateString()}
                {r.startTime ? ` · ${String(r.startTime).includes("T") ? String(r.startTime).slice(11, 16) : r.startTime}` : ""}
              </td>
              <td className="px-4 py-3 font-medium text-text-primary">{r.user?.name ?? "—"}</td>
              <td className="px-4 py-3 text-text-secondary">{r.classTitle}</td>
              <td className="px-4 py-3 text-text-secondary">{r.center}</td>
              <td className="px-4 py-3">
                {r.distanceM != null ? (
                  <StatusPill tone={r.withinFence ? "success" : "danger"}>
                    {`${r.distanceM} m ${r.withinFence ? "· on site" : "· outside fence"}`}
                  </StatusPill>
                ) : r.centerHasPin ? (
                  <StatusPill tone="warning">no location sent</StatusPill>
                ) : (
                  <StatusPill tone="neutral">center not pinned</StatusPill>
                )}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {r.biometric == null ? "—" : r.biometric ? "✓ confirmed" : "✗ skipped"}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
