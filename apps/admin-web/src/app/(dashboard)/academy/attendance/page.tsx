"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, SelectField } from "@/components/ui";
import type { AttendanceSummary, Center } from "@/lib/types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [date, setDate] = useState(todayIso());
  const [centerId, setCenterId] = useState("");
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: centers } = useApiList<Center>("/centers");

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ date, ...(centerId ? { centerId } : {}) });
    apiJson<AttendanceSummary>(`/attendance/summary?${params.toString()}`)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load attendance."))
      .finally(() => setLoading(false));
  }, [date, centerId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Attendance</h1>
        <p className="text-sm text-text-secondary">Org-wide attendance summary</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm text-text-secondary">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-alt px-3.5 py-2.5 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <SelectField label="Center" value={centerId} onChange={(e) => setCenterId(e.target.value)}>
          <option value="">All centers</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : (
        summary && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card>
              <div className="text-xs text-text-secondary">Sessions today</div>
              <div className="mt-1 text-2xl font-semibold text-text-primary">{summary.sessionsToday}</div>
            </Card>
            <Card>
              <div className="text-xs text-text-secondary">Marked present</div>
              <div className="mt-1 text-2xl font-semibold text-success">{summary.markedPresent}</div>
            </Card>
            <Card>
              <div className="text-xs text-text-secondary">Absent</div>
              <div className="mt-1 text-2xl font-semibold text-danger">{summary.absent}</div>
            </Card>
            <Card>
              <div className="text-xs text-text-secondary">Attendance rate</div>
              <div className="mt-1 text-2xl font-semibold text-text-primary">{summary.attendanceRate}%</div>
            </Card>
          </div>
        )
      )}
    </div>
  );
}
