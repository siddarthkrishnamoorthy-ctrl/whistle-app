"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, OutlineButton, Table } from "@/components/ui";

type ReportKey = "attendance-summary" | "revenue" | "performance" | "enquiry-conversion" | "renewal-churn" | "expense";

const REPORTS: { key: ReportKey; label: string; totalLabels: Record<string, string> }[] = [
  {
    key: "attendance-summary",
    label: "Attendance Summary",
    totalLabels: { sessions: "Sessions", present: "Present", absent: "Absent", attendanceRate: "Attendance rate (%)" },
  },
  {
    key: "revenue",
    label: "Revenue Report",
    totalLabels: { totalInvoiced: "Total invoiced (₹)", received: "Received (₹)", outstanding: "Outstanding (₹)" },
  },
  {
    key: "performance",
    label: "Performance Report",
    totalLabels: { assessmentsRecorded: "Assessments recorded", averageRating: "Average rating" },
  },
  {
    key: "enquiry-conversion",
    label: "Enquiry & Conversion",
    totalLabels: { total: "Total enquiries", converted: "Converted", conversionRate: "Conversion rate (%)" },
  },
  {
    key: "renewal-churn",
    label: "Renewal & Churn",
    totalLabels: { total: "Enrollments ending", renewed: "Renewed", stopped: "Stopped", churnRate: "Churn rate (%)" },
  },
  { key: "expense", label: "Expense Report", totalLabels: {} },
];

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => JSON.stringify(row[c] ?? "")).join(","));
  }
  return lines.join("\n");
}

export default function ReportsPage() {
  const [activeKey, setActiveKey] = useState<ReportKey>("attendance-summary");
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(todayIso());
  const [result, setResult] = useState<{ rows: Record<string, unknown>[]; totals: Record<string, number> | null; implemented?: boolean } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const active = REPORTS.find((r) => r.key === activeKey)!;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from, to });
    apiJson<{ rows: Record<string, unknown>[]; totals: Record<string, number> | null; implemented?: boolean }>(
      `/reports/${activeKey}?${params.toString()}`
    )
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load report."))
      .finally(() => setLoading(false));
  }, [activeKey, from, to]);

  function handleExport() {
    if (!result || result.rows.length === 0) return;
    const csv = toCsv(result.rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeKey}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Reports &amp; Analytics</h1>
        <p className="text-sm text-text-secondary">Every report supports a date-range filter and CSV export</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActiveKey(r.key)}
            className={`rounded-lg border p-3 text-left text-sm font-medium transition ${
              activeKey === r.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface text-text-primary hover:bg-surface-alt"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm text-text-secondary">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-border bg-surface-alt px-3.5 py-2.5 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-text-secondary">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-border bg-surface-alt px-3.5 py-2.5 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <OutlineButton
          className="w-auto px-6"
          onClick={handleExport}
          disabled={!result || result.rows.length === 0}
        >
          Export CSV
        </OutlineButton>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : result?.implemented === false ? (
        <Card>
          <EmptyState message="Expense tracking isn't built yet — this report will populate once the Expenses module ships." />
        </Card>
      ) : (
        <>
          {result?.totals && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Object.entries(active.totalLabels).map(([key, label]) => (
                <Card key={key}>
                  <div className="text-xs text-text-secondary">{label}</div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">{result.totals?.[key] ?? 0}</div>
                </Card>
              ))}
            </div>
          )}

          {!result || result.rows.length === 0 ? (
            <Card>
              <EmptyState message="No data in this date range." />
            </Card>
          ) : (
            <Table columns={Object.keys(result.rows[0])}>
              {result.rows.map((row, i) => (
                <tr key={i} className="hover:bg-surface-alt">
                  {Object.keys(result.rows[0]).map((col) => (
                    <td key={col} className="px-4 py-3 text-text-secondary">
                      {String(row[col] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </Table>
          )}
        </>
      )}
    </div>
  );
}
