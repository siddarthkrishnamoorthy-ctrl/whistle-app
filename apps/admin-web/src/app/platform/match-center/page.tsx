"use client";

// Owner Match Center — interschool standings and event oversight across every
// school on Whistle. The operator sees the cross-school table (wins from
// confirmed fixtures) and can drill into any event's public microsite.

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Search, Swords, Trophy } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, SelectField, StatusPill, Table } from "@/components/ui";
import { RANK_MEDALS } from "@/lib/sport-icons";
import { PageHeader } from "../platform-ui";

interface MatchCenter {
  totals: { events: number; live: number; completed: number; matchesPlayed: number };
  schoolTable: { academyId: string; name: string; played: number; won: number; drawn: number; lost: number; points: number }[];
  events: {
    id: string;
    name: string;
    host: string;
    sports: string[];
    status: string;
    startDate: string;
    fixtures: number;
    rosters: number;
  }[];
}

const STATUS_TONE: Record<string, "success" | "warning" | "info" | "neutral"> = {
  live: "warning",
  scheduled: "info",
  completed: "success",
  closed: "neutral",
  draft: "neutral",
};

export default function PlatformMatchCenterPage() {
  const [data, setData] = useState<MatchCenter | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sportFilter, setSportFilter] = useState("");

  useEffect(() => {
    apiJson<MatchCenter>("/platform/match-center").then(setData).catch(() => {});
  }, []);

  // Distinct statuses & sports present in the data, for the filter dropdowns.
  const statuses = useMemo(() => Array.from(new Set((data?.events ?? []).map((e) => e.status))).sort(), [data]);
  const sportsInPlay = useMemo(() => Array.from(new Set((data?.events ?? []).flatMap((e) => e.sports))).sort(), [data]);

  if (!data) return <p className="text-sm text-text-secondary">Loading…</p>;

  const tiles = [
    { label: "Events hosted", value: String(data.totals.events), icon: Trophy, chip: "bg-amber-400/15 text-amber-300" },
    { label: "Live / upcoming", value: String(data.totals.live), icon: CalendarClock, chip: "bg-sky-400/15 text-sky-300" },
    { label: "Matches played", value: String(data.totals.matchesPlayed), icon: Swords, chip: "bg-emerald-400/15 text-emerald-300" },
  ];

  const q = search.trim().toLowerCase();
  const events = data.events.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (sportFilter && !e.sports.includes(sportFilter)) return false;
    if (q && !(e.name.toLowerCase().includes(q) || e.host.toLowerCase().includes(q))) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Match Center" subtitle="Interschool standings and events across every school on Whistle." />

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

      {/* Cross-school interschool table */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          <Trophy className="mr-1 inline h-4 w-4 text-amber-300" strokeWidth={1.8} /> School standings (all interschool matches)
        </h3>
        {data.schoolTable.length === 0 ? (
          <Card>
            <EmptyState message="No completed interschool matches yet." />
          </Card>
        ) : (
          <Table columns={["#", "School", "P", "W", "D", "L", "Pts"]}>
            {data.schoolTable.map((r, i) => (
              <tr key={r.academyId} className={`hover:bg-surface-alt ${i === 0 ? "bg-amber-400/5" : ""}`}>
                <td className="px-4 py-3">{RANK_MEDALS[i] ?? <span className="text-text-muted">{i + 1}</span>}</td>
                <td className={`px-4 py-3 font-medium ${i === 0 ? "text-amber-300" : "text-text-primary"}`}>{r.name}</td>
                <td className="px-4 py-3 text-center text-text-secondary">{r.played}</td>
                <td className="px-4 py-3 text-center text-text-primary">{r.won}</td>
                <td className="px-4 py-3 text-center text-text-secondary">{r.drawn}</td>
                <td className="px-4 py-3 text-center text-text-secondary">{r.lost}</td>
                <td className="px-4 py-3 text-center font-bold text-text-primary">{r.points}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {/* Events across the network */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Events · {events.length}
            {events.length !== data.events.length && <span className="text-text-muted"> of {data.events.length}</span>}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-muted" strokeWidth={1.8} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events or hosts…"
                className="w-56 rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60"
              />
            </div>
            <SelectField compact value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-w-[130px]">
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </SelectField>
            <SelectField compact value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} className="min-w-[130px]">
              <option value="">All sports</option>
              {sportsInPlay.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
        {events.length === 0 ? (
          <Card>
            <EmptyState message="No events match." />
          </Card>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">{e.name}</span>
                    <StatusPill tone={STATUS_TONE[e.status] ?? "neutral"}>{e.status}</StatusPill>
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Hosted by {e.host} · {e.sports.join(", ")} · {e.fixtures} fixtures · {e.rosters} players · {e.startDate.slice(0, 10)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
