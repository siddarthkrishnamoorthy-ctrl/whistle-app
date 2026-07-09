"use client";

import { useRef, useState } from "react";
import { Modal, ModalFooter } from "@/components/modal";
import { SelectField, StatusPill } from "@/components/ui";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import type { Center, Plan, WhistleClass } from "@/lib/types";

interface ParsedRow {
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  dob?: string;
}

interface ImportResultRow {
  row: number;
  name: string;
  ok: boolean;
  linkCode?: string;
  error?: string;
}

// Minimal CSV parser that copes with quoted fields ("Kumar, Aarav").
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  name: "name", "student name": "name", "full name": "name", student: "name",
  email: "email", "email id": "email",
  phone: "phone", mobile: "phone", "phone number": "phone", contact: "phone",
  gender: "gender", sex: "gender",
  dob: "dob", "date of birth": "dob", birthday: "dob", birthdate: "dob",
};

export function ImportClientsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { data: centers } = useApiList<Center>("/centers");
  const { data: plans } = useApiList<Plan>("/plans");
  const { data: classes } = useApiList<WhistleClass>("/classes");
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [centerId, setCenterId] = useState("");
  const [planId, setPlanId] = useState("");
  const [classId, setClassId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; failed: number; results: ImportResultRow[] } | null>(null);

  function reset() {
    setFileName("");
    setRows([]);
    setSkipped(0);
    setCenterId("");
    setPlanId("");
    setClassId("");
    setError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      setError("The file needs a header row plus at least one student row.");
      return;
    }
    const headers = parsed[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
    if (!headers.includes("name")) {
      setError('No "name" column found. Expected headers like: name, email, phone, gender, dob.');
      return;
    }
    const dataRows: ParsedRow[] = [];
    let bad = 0;
    for (const raw of parsed.slice(1)) {
      const row: ParsedRow = { name: "" };
      raw.forEach((val, i) => {
        const key = headers[i];
        if (key && val.trim()) row[key] = val.trim();
      });
      if (row.name) dataRows.push(row);
      else bad++;
    }
    setFileName(file.name);
    setRows(dataRows);
    setSkipped(bad);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiJson<{ created: number; failed: number; results: ImportResultRow[] }>("/clients/bulk", {
        method: "POST",
        body: JSON.stringify({
          rows,
          centerId: centerId || undefined,
          planId: planId || undefined,
          classId: classId || undefined,
        }),
      });
      setResult(res);
      if (res.created > 0) onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Import Student Database"
      subtitle="Upload a CSV exported from Excel / Google Sheets"
      wide
      footer={
        result ? (
          <button
            onClick={() => { reset(); onClose(); }}
            className="rounded-full bg-accent px-6 py-2.5 font-semibold text-accent-text hover:opacity-90"
          >
            Done
          </button>
        ) : (
          <ModalFooter
            onCancel={() => { reset(); onClose(); }}
            onSubmit={handleImport}
            submitLabel={rows.length ? `Import ${rows.length} student(s)` : "Import"}
            submitting={submitting}
          />
        )
      }
    >
      {!result ? (
        <>
          <div className="rounded-md border border-border bg-white/[0.03] p-3 text-xs text-text-secondary">
            Expected columns (first row = headers): <span className="font-semibold text-text-primary">name</span>
            {" "}(required), email, phone, gender, dob (YYYY-MM-DD). Extra columns are ignored. Up to 1,000 rows.
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent-text hover:file:opacity-90"
          />

          {rows.length > 0 && (
            <>
              <p className="text-sm text-text-secondary">
                <span className="font-semibold text-text-primary">{fileName}</span> — {rows.length} student(s) ready
                {skipped > 0 ? `, ${skipped} row(s) skipped (no name)` : ""}. Preview:
              </p>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-text-muted">
                      <th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Phone</th><th className="px-3 py-2">DOB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {rows.slice(0, 6).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-text-primary">{r.name}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{r.email ?? "—"}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{r.phone ?? "—"}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{r.dob ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-sm text-text-secondary">Optionally apply to every imported student:</p>
              <div className="grid grid-cols-3 gap-3">
                <SelectField label="Center" value={centerId} onChange={(e) => setCenterId(e.target.value)}>
                  <option value="">—</option>
                  {centers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </SelectField>
                <SelectField label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  <option value="">—</option>
                  {plans.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
                </SelectField>
                <SelectField label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <option value="">—</option>
                  {classes.map((c) => (<option key={c.id} value={c.id}>{c.title}</option>))}
                </SelectField>
              </div>
              <p className="text-xs text-text-muted">
                Enrolment is created only when BOTH a plan and a class are chosen; otherwise students import as
                trial/walk-in records you can enrol later.
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <StatusPill tone="success">{`${result.created} imported`}</StatusPill>
            {result.failed > 0 && <StatusPill tone="danger">{`${result.failed} failed`}</StatusPill>}
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="px-3 py-2">#</th><th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {result.results.map((r) => (
                  <tr key={r.row}>
                    <td className="px-3 py-1.5 text-text-muted">{r.row}</td>
                    <td className="px-3 py-1.5 text-text-primary">{r.name}</td>
                    <td className="px-3 py-1.5">
                      {r.ok ? (
                        <span className="text-success">✓ link code {r.linkCode}</span>
                      ) : (
                        <span className="text-danger">{r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-muted">
            Share each student&apos;s link code with their family — parents use it in the Parent App to connect.
          </p>
        </>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
