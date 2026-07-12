"use client";

// Periodic Assessment — Test Library (Assessment Module BRD 4.1).
// Admin/Account Manager define standardized fitness/skill tests: metric type
// drives the coach's input widget (stopwatch / tally / number); benchmark
// zones are age/gender-banded, FitnessGram HFZ-style. Numeric only — this
// module deliberately has NO photo/video anywhere (BRD 4.4).

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Field, SelectField, StatusPill, Table, TextareaField } from "@/components/ui";
import { Modal, ModalFooter } from "@/components/modal";
import { useApiList } from "@/lib/hooks";

interface Grade {
  id: string;
  name: string;
}
interface Zone {
  ageMin?: number | null;
  ageMax?: number | null;
  gender: string;
  zoneName: string;
  thresholdLow?: number | string | null;
  thresholdHigh?: number | string | null;
}
interface Test {
  id: string;
  name: string;
  category: string;
  applicableGradeIds: string[];
  metricType: string;
  unit: string;
  precisionDecimals: number;
  attemptsAllowed: number;
  instructions?: string | null;
  zones: Zone[];
}

const CATEGORIES = ["speed", "agility", "power", "endurance", "strength", "flexibility", "sport_skill"];
const METRIC_LABEL: Record<string, string> = {
  time: "Time — lower is better",
  repetitions: "Repetitions — higher is better",
  distance_height: "Distance / height — higher is better",
};

export default function AssessmentTestsPage() {
  const { data: grades } = useApiList<Grade>("/grades");
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Test | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("agility");
  const [metricType, setMetricType] = useState("time");
  const [unit, setUnit] = useState("seconds");
  const [precision, setPrecision] = useState("2");
  const [attempts, setAttempts] = useState("2");
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);

  const refetch = useCallback(() => {
    apiJson<Test[]>("/assessment-tests")
      .then(setTests)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load tests."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(refetch, [refetch]);

  function openModal(t?: Test) {
    setEditing(t ?? null);
    setName(t?.name ?? "");
    setCategory(t?.category ?? "agility");
    setMetricType(t?.metricType ?? "time");
    setUnit(t?.unit ?? "seconds");
    setPrecision(String(t?.precisionDecimals ?? 2));
    setAttempts(String(t?.attemptsAllowed ?? 2));
    setGradeIds(t?.applicableGradeIds ?? []);
    setInstructions(t?.instructions ?? "");
    setZones(t?.zones?.map((z) => ({ ...z })) ?? []);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        category,
        metricType,
        unit,
        precisionDecimals: Number(precision) || 0,
        attemptsAllowed: Number(attempts) || 1,
        applicableGradeIds: gradeIds,
        instructions: instructions.trim() || undefined,
        zones: zones
          .filter((z) => z.zoneName.trim())
          .map((z) => ({
            ageMin: z.ageMin != null && z.ageMin !== ("" as unknown) ? Number(z.ageMin) : undefined,
            ageMax: z.ageMax != null && z.ageMax !== ("" as unknown) ? Number(z.ageMax) : undefined,
            gender: z.gender,
            zoneName: z.zoneName.trim(),
            thresholdLow: z.thresholdLow != null && z.thresholdLow !== "" ? Number(z.thresholdLow) : undefined,
            thresholdHigh: z.thresholdHigh != null && z.thresholdHigh !== "" ? Number(z.thresholdHigh) : undefined,
          })),
      };
      if (editing) await apiJson(`/assessment-tests/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await apiJson("/assessment-tests", { method: "POST", body: JSON.stringify(body) });
      setOpen(false);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the test.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Assessment Tests</h1>
          <p className="text-sm text-text-secondary">
            Standardized fitness/skill tests — timed, counted or measured. Coaches record results by stopwatch or
            number only.
          </p>
        </div>
        <button onClick={() => openModal()} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90">
          + New Test
        </button>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {tests.length > 0 && (
        <div className="flex gap-3">
          <Field
            label=""
            placeholder="Search tests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <SelectField compact value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="max-w-[200px]">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </SelectField>
        </div>
      )}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : tests.length === 0 ? (
        <Card>
          <EmptyState message="No tests yet. Create your first standardized test — e.g. a 4×10m Agility Shuttle Run." />
        </Card>
      ) : (
        <Table columns={["Test", "Category", "Metric", "Attempts", "Grades", "Zones", ""]}>
          {tests
            .filter(
              (t) =>
                (!filterCategory || t.category === filterCategory) &&
                (!search.trim() || t.name.toLowerCase().includes(search.trim().toLowerCase()))
            )
            .map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3 font-medium text-text-primary">{t.name}</td>
              <td className="px-4 py-3 capitalize text-text-secondary">{t.category.replace("_", " ")}</td>
              <td className="px-4 py-3 text-text-secondary">
                {t.metricType === "time" ? "⏱ time" : t.metricType === "repetitions" ? "🔢 reps" : "📏 distance"} ({t.unit})
              </td>
              <td className="px-4 py-3 text-text-secondary">best of {t.attemptsAllowed}</td>
              <td className="px-4 py-3 text-text-secondary">
                {t.applicableGradeIds.length ? `${t.applicableGradeIds.length} grade(s)` : "all"}
              </td>
              <td className="px-4 py-3">
                {t.zones.length ? <StatusPill tone="success">{`${t.zones.length} zones`}</StatusPill> : <span className="text-sm text-text-secondary">—</span>}
              </td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => openModal(t)} className="text-sm font-semibold text-accent hover:underline">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Test" : "New Test"}
        subtitle="Numeric results only — a time, a count or a distance"
        wide
        footer={<ModalFooter onCancel={() => setOpen(false)} onSubmit={save} submitLabel={editing ? "Save" : "Create Test"} submitting={submitting} />}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Test name *" placeholder="4×10m Agility Shuttle Run" value={name} onChange={(e) => setName(e.target.value)} />
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Metric type — drives the coach's input widget"
            value={metricType}
            onChange={(e) => {
              setMetricType(e.target.value);
              setUnit(e.target.value === "time" ? "seconds" : e.target.value === "repetitions" ? "count" : "cm");
              setPrecision(e.target.value === "time" ? "2" : "0");
            }}
          >
            {Object.entries(METRIC_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <Field label="Decimals" type="number" value={precision} onChange={(e) => setPrecision(e.target.value)} />
            <Field label="Attempts" type="number" min={1} max={5} value={attempts} onChange={(e) => setAttempts(e.target.value)} />
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm text-text-secondary">Applicable grades (empty = all)</span>
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
        <TextareaField
          label="Instructions / protocol — so it's run identically every cycle"
          placeholder="Course dimensions, equipment, starting position, timing rule…"
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm text-text-secondary">
              Benchmark zones (optional) — result classified at entry, banded by age/gender
            </span>
            <button
              type="button"
              onClick={() => setZones((z) => [...z, { gender: "any", zoneName: "" }])}
              className="text-xs font-semibold text-accent hover:underline"
            >
              + Add zone
            </button>
          </div>
          {zones.map((z, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_70px_70px_90px_80px_80px_24px] items-center gap-2">
              <input
                placeholder="Zone name (e.g. Healthy Zone)"
                value={z.zoneName}
                onChange={(e) => setZones((all) => all.map((x, j) => (j === i ? { ...x, zoneName: e.target.value } : x)))}
                className="rounded-md border border-border bg-surface-alt px-2 py-1.5 text-sm text-text-primary"
              />
              {(["ageMin", "ageMax"] as const).map((k) => (
                <input
                  key={k}
                  type="number"
                  placeholder={k === "ageMin" ? "age ≥" : "age ≤"}
                  value={z[k] ?? ""}
                  onChange={(e) => setZones((all) => all.map((x, j) => (j === i ? { ...x, [k]: e.target.value === "" ? null : Number(e.target.value) } : x)))}
                  className="rounded-md border border-border bg-surface-alt px-2 py-1.5 text-sm text-text-primary"
                />
              ))}
              <SelectField
                compact
                value={z.gender}
                onChange={(e) => setZones((all) => all.map((x, j) => (j === i ? { ...x, gender: e.target.value } : x)))}
                className="w-auto"
              >
                <option value="any">any</option>
                <option value="male">male</option>
                <option value="female">female</option>
              </SelectField>
              {(["thresholdLow", "thresholdHigh"] as const).map((k) => (
                <input
                  key={k}
                  type="number"
                  step="0.01"
                  placeholder={k === "thresholdLow" ? "≥ value" : "< value"}
                  value={z[k] ?? ""}
                  onChange={(e) => setZones((all) => all.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                  className="rounded-md border border-border bg-surface-alt px-2 py-1.5 text-sm text-text-primary"
                />
              ))}
              <button type="button" onClick={() => setZones((all) => all.filter((_, j) => j !== i))} className="text-danger">
                ✕
              </button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
