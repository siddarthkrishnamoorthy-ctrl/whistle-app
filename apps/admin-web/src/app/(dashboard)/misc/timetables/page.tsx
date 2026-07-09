"use client";

import { useState } from "react";
import { apiFetch, apiJson } from "@/lib/api-client";
import { Card, Field, OutlineButton, PrimaryButton, StatusPill, Table } from "@/components/ui";
import type { Timetable } from "@/lib/types";

export default function TimetablesPage() {
  const [termLabel, setTermLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ classIds: string[]; committedRows: number; skippedRows: number } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (termLabel) form.append("termLabel", termLabel);
      const res = await apiFetch("/timetables/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Upload failed.");
      }
      setTimetable(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload timetable.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCommit() {
    if (!timetable) return;
    setCommitting(true);
    setError(null);
    try {
      const res = await apiJson<{ classIds: string[]; committedRows: number; skippedRows: number }>(
        `/timetables/${timetable.id}/commit`,
        { method: "POST" }
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not commit timetable.");
    } finally {
      setCommitting(false);
    }
  }

  const rows = timetable?.previewData?.rows ?? [];
  const unresolvedCount = rows.filter((r) => r.unresolvedFields.length > 0).length;
  const conflictCount = rows.filter((r) => r.conflict).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Timetable Upload</h1>
        <p className="text-sm text-text-secondary">
          Upload a CSV (Grade, Section, Day, StartTime, EndTime, Sport, Center, Coach) to auto-create Classes and
          their recurring schedule — Mode A of the Grade-Wise Curriculum setup.
        </p>
      </div>

      <Card className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Term label" placeholder="e.g. Term 1 2026" value={termLabel} onChange={(e) => setTermLabel(e.target.value)} />
          <label className="block">
            <span className="mb-1.5 block text-sm text-text-secondary">CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-surface-alt file:px-3 file:py-1.5 file:text-xs file:text-text-primary hover:file:bg-border"
            />
          </label>
        </div>
        <PrimaryButton className="w-auto px-6" onClick={handleUpload} disabled={uploading || !file}>
          {uploading ? "Uploading…" : "Upload & Preview"}
        </PrimaryButton>
      </Card>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {timetable && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <div className="text-xs text-text-secondary">Total rows</div>
              <div className="mt-1 text-2xl font-semibold text-text-primary">{rows.length}</div>
            </Card>
            <Card>
              <div className="text-xs text-text-secondary">Unresolved</div>
              <div className="mt-1 text-2xl font-semibold text-warning">{unresolvedCount}</div>
            </Card>
            <Card>
              <div className="text-xs text-text-secondary">Conflicts</div>
              <div className="mt-1 text-2xl font-semibold text-danger">{conflictCount}</div>
            </Card>
          </div>

          <Table columns={["Grade", "Section", "Day", "Time", "Sport", "Center", "Coach", "Status"]}>
            {rows.map((r) => (
              <tr key={r.rowIndex} className={r.conflict ? "bg-danger/10" : r.unresolvedFields.length > 0 ? "bg-warning/10" : ""}>
                <td className="px-4 py-3 text-text-secondary">{r.grade}</td>
                <td className="px-4 py-3 text-text-secondary">{r.section || "—"}</td>
                <td className="px-4 py-3 text-text-secondary">{r.day}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {r.startTime}–{r.endTime}
                </td>
                <td className="px-4 py-3 text-text-secondary">{r.sport}</td>
                <td className="px-4 py-3 text-text-secondary">{r.center || "—"}</td>
                <td className="px-4 py-3 text-text-secondary">{r.coach || "Unassigned"}</td>
                <td className="px-4 py-3">
                  {r.conflict ? (
                    <StatusPill tone="danger">Conflict</StatusPill>
                  ) : r.unresolvedFields.length > 0 ? (
                    <StatusPill tone="warning">Unresolved: {r.unresolvedFields.join(", ")}</StatusPill>
                  ) : (
                    <StatusPill tone="success">Ready</StatusPill>
                  )}
                </td>
              </tr>
            ))}
          </Table>

          {timetable.status === "processing" && !result && (
            <PrimaryButton className="w-auto px-6" onClick={handleCommit} disabled={committing}>
              {committing ? "Committing…" : "Commit — create Classes & Schedule"}
            </PrimaryButton>
          )}

          {result && (
            <Card className="text-sm text-success">
              ✓ Committed {result.committedRows} row(s) into {result.classIds.length} class(es)
              {result.skippedRows > 0 && ` — ${result.skippedRows} unresolved/conflicting row(s) skipped.`}
              <div className="mt-2 text-text-secondary">
                Generate the recurring schedule for each class from its detail page's "Generate sessions" action, same
                as any manually-created class.
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="text-xs text-text-muted">
        <div className="font-medium text-text-secondary">Template columns</div>
        <code>Grade,Section,Day,StartTime,EndTime,Sport,Center,Coach</code>
      </Card>
      <OutlineButton
        className="w-auto px-6"
        onClick={() => {
          const csv = "Grade,Section,Day,StartTime,EndTime,Sport,Center,Coach\n";
          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "timetable-template.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Download blank template
      </OutlineButton>
    </div>
  );
}
