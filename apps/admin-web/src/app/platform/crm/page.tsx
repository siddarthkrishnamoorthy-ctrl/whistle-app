"use client";

// Owner CRM — enrolment + enquiry pipeline across every academy and school.
// Read-only oversight so Whistle can see growth and coach academies on
// conversion. No login into a tenant needed.

import { useEffect, useMemo, useState } from "react";
import { Inbox, Search, TrendingUp, Users } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Card, Table } from "@/components/ui";
import { PageHeader } from "../platform-ui";

interface Crm {
  totals: { students: number; enquiries: number; academies: number };
  pipeline: Record<string, number>;
  byAcademy: { id: string; name: string; students: number; enquiries: number }[];
}

const STAGE_TONE: Record<string, string> = {
  lead: "bg-sky-400/15 text-sky-300",
  closed: "bg-emerald-400/15 text-emerald-300",
  junk: "bg-rose-400/15 text-rose-300",
};

export default function PlatformCrmPage() {
  const [data, setData] = useState<Crm | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiJson<Crm>("/platform/crm").then(setData).catch(() => {});
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return (q ? data.byAcademy.filter((a) => a.name.toLowerCase().includes(q)) : data.byAcademy).sort(
      (a, b) => b.students - a.students
    );
  }, [data, search]);

  if (!data) return <p className="text-sm text-text-secondary">Loading…</p>;

  const tiles = [
    { label: "Students across the network", value: data.totals.students.toLocaleString("en-IN"), icon: Users, chip: "bg-emerald-400/15 text-emerald-300" },
    { label: "Open enquiries (leads)", value: String(data.pipeline.lead ?? 0), icon: Inbox, chip: "bg-sky-400/15 text-sky-300" },
    { label: "Converted / closed", value: String(data.pipeline.closed ?? 0), icon: TrendingUp, chip: "bg-violet-400/15 text-violet-300" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="CRM" subtitle="Enrolment and enquiry pipeline across every academy and school." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="rounded-xl border border-border bg-surface p-5">
              <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${t.chip}`}>
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </div>
              <div className="text-2xl font-bold text-text-primary">{t.value}</div>
              <div className="text-xs text-text-secondary">{t.label}</div>
            </div>
          );
        })}
      </div>

      {/* Pipeline chips */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Enquiry pipeline</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.pipeline).length === 0 && <p className="text-sm text-text-muted">No enquiries logged yet.</p>}
          {Object.entries(data.pipeline).map(([stage, count]) => (
            <span key={stage} className={`rounded-full px-3 py-1 text-xs font-semibold ${STAGE_TONE[stage] ?? "bg-white/[0.06] text-text-secondary"}`}>
              {stage}: {count}
            </span>
          ))}
        </div>
      </Card>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-muted" strokeWidth={1.8} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search academies…"
          className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60"
        />
      </div>

      <Table columns={["Academy / School", "Students", "Enquiries"]}>
        {rows.map((a) => (
          <tr key={a.id} className="hover:bg-surface-alt">
            <td className="px-4 py-3 font-medium text-text-primary">{a.name}</td>
            <td className="px-4 py-3 text-text-secondary">{a.students.toLocaleString("en-IN")}</td>
            <td className="px-4 py-3 text-text-secondary">{a.enquiries}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
