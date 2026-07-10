"use client";

// Periodic Assessment — Cycles (Assessment Module BRD 4.2/4.5).
// Admin/Account Manager schedule Monthly/Quarterly/Half-Yearly/Annual test
// batteries for grades/classes with a testing window; recurring cycles
// auto-generate their next occurrence; the missing-data view distinguishes
// "not tested" from absent/exempt so nobody is silently skipped.

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Field, SelectField, StatusPill, Table } from "@/components/ui";
import { Modal, ModalFooter } from "@/components/modal";
import { useApiList } from "@/lib/hooks";

interface Grade {
  id: string;
  name: string;
}
interface TestOption {
  id: string;
  name: string;
}
interface Cycle {
  id: string;
  title: string;
  cadence: string;
  windowStart: string;
  windowEnd: string;
  status: string;
  tests: { id: string; name: string }[];
  gradeIds: string[];
  rosterCount: number;
  expected: number;
  completed: number;
  completionPct: number;
}
interface MissingRow {
  clientId: string;
  name: string;
  testName: string;
  status: string;
}

const CADENCES = [
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["half_yearly", "Half-Yearly"],
  ["annual", "Annual"],
] as const;

export default function AssessmentCyclesPage() {
  const { data: grades } = useApiList<Grade>("/grades");
  const { data: testOptions } = useApiList<TestOption>("/assessment-tests");
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [missingFor, setMissingFor] = useState<string | null>(null);
  const [missingRows, setMissingRows] = useState<MissingRow[]>([]);

  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState("quarterly");
  const [testIds, setTestIds] = useState<string[]>([]);
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");

  const refetch = useCallback(() => {
    apiJson<Cycle[]>("/assessment-cycles")
      .then(setCycles)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load cycles."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(refetch, [refetch]);

  async function create() {
    if (!title.trim() || !testIds.length || !gradeIds.length || !windowStart) return;
    setSubmitting(true);
    try {
      await apiJson("/assessment-cycles", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          cadence,
          testIds,
          gradeIds,
          windowStart,
          windowEnd: windowEnd || windowStart,
        }),
      });
      setOpen(false);
      setTitle("");
      setTestIds([]);
      setGradeIds([]);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not schedule the cycle.");
    } finally {
      setSubmitting(false);
    }
  }

  async function showMissing(id: string) {
    if (missingFor === id) {
      setMissingFor(null);
      return;
    }
    const res = await apiJson<{ rows: MissingRow[] }>(`/assessment-cycles/${id}/missing`).catch(() => ({ rows: [] }));
    setMissingRows(res.rows);
    setMissingFor(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Assessment Cycles</h1>
          <p className="text-sm text-text-secondary">
            Scheduled test batteries — recurring cycles reopen automatically next period; coaches record results in
            their app
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90">
          + Schedule Cycle
        </button>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : cycles.length === 0 ? (
        <Card>
          <EmptyState message='No cycles yet. Schedule one — e.g. a "Quarterly Fitness Battery" bundling shuttle run + push-ups.' />
        </Card>
      ) : (
        <Table columns={["Cycle", "Cadence", "Window", "Tests", "Students", "Completion", "Status", ""]}>
          {cycles.map((c) => (
            <>
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-text-primary">{c.title}</td>
                <td className="px-4 py-3 capitalize text-text-secondary">{c.cadence.replace("_", "-")}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {new Date(c.windowStart).toLocaleDateString()} – {new Date(c.windowEnd).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-text-secondary">{c.tests.map((t) => t.name).join(", ")}</td>
                <td className="px-4 py-3 text-text-secondary">{c.rosterCount}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${c.completionPct}%` }} />
                    </div>
                    <span className="text-xs text-text-secondary">
                      {c.completed}/{c.expected}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={c.status === "open" ? "success" : "neutral"}>{c.status}</StatusPill>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => showMissing(c.id)} className="text-sm font-semibold text-accent hover:underline">
                    {missingFor === c.id ? "Hide" : "Missing data"}
                  </button>
                </td>
              </tr>
              {missingFor === c.id && (
                <tr key={`${c.id}-missing`}>
                  <td colSpan={8} className="bg-surface-alt/40 px-6 py-3">
                    {missingRows.length === 0 ? (
                      <p className="text-sm text-success">✓ Every student has a result or an explicit absence/exemption.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                        {missingRows.map((r, i) => (
                          <p key={i} className="flex justify-between text-sm">
                            <span className="text-text-primary">
                              {r.name} — {r.testName}
                            </span>
                            <StatusPill tone={r.status === "not tested" ? "warning" : "neutral"}>{r.status}</StatusPill>
                          </p>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </Table>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule Assessment Cycle"
        subtitle="Bundle one or more tests into a recurring battery"
        footer={<ModalFooter onCancel={() => setOpen(false)} onSubmit={create} submitLabel="Schedule" submitting={submitting} />}
      >
        <Field label="Cycle title *" placeholder="Quarterly Fitness Battery" value={title} onChange={(e) => setTitle(e.target.value)} />
        <SelectField label="Cadence *" value={cadence} onChange={(e) => setCadence(e.target.value)}>
          {CADENCES.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </SelectField>
        <div>
          <span className="mb-1.5 block text-sm text-text-secondary">Tests in this battery *</span>
          <div className="flex flex-wrap gap-2">
            {testOptions.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTestIds((prev) => (prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}
                className={`rounded-full border px-3 py-1 text-xs ${
                  testIds.includes(t.id) ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm text-text-secondary">Grades *</span>
          <div className="flex flex-wrap gap-2">
            {grades.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGradeIds((prev) => (prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]))}
                className={`rounded-full border px-3 py-1 text-xs ${
                  gradeIds.includes(g.id) ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Testing window from *" type="date" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
          <Field label="to" type="date" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
