"use client";

// Owner Match Center — interschool standings and event oversight across every
// school on Whistle. The operator sees the cross-school table (wins from
// confirmed fixtures) and can drill into any event's public microsite.

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Search, Swords, Trophy } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, MetricTile, SelectField, StatusPill, Table } from "@/components/ui";
import { Modal } from "@/components/modal";
import { RANK_MEDALS } from "@/lib/sport-icons";
import { PageHeader } from "../platform-ui";

type EventRow = MatchCenter["events"][number];
type SchoolRow = MatchCenter["schoolTable"][number];

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
  const [detailEvent, setDetailEvent] = useState<EventRow | null>(null);
  const [detailSchool, setDetailSchool] = useState<SchoolRow | null>(null);

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
          <div className="max-h-[340px] overflow-y-auto rounded-lg border border-border">
          <Table columns={["#", "School", "P", "W", "D", "L", "Pts"]}>
            {data.schoolTable.map((r, i) => (
              <tr
                key={r.academyId}
                onClick={() => setDetailSchool(r)}
                className={`cursor-pointer hover:bg-surface-alt ${i === 0 ? "bg-amber-400/5" : ""}`}
              >
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
          </div>
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
          <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
            {events.map((e) => (
              <Card
                key={e.id}
                onClick={() => setDetailEvent(e)}
                className="flex cursor-pointer flex-wrap items-center justify-between gap-3 hover:border-accent/40"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">{e.name}</span>
                    <StatusPill tone={STATUS_TONE[e.status] ?? "neutral"}>{e.status}</StatusPill>
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Hosted by {e.host} · {e.sports.join(", ")} · {e.fixtures} fixtures · {e.rosters} players · {e.startDate.slice(0, 10)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-accent">View →</span>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Event detail */}
      <Modal open={!!detailEvent} onClose={() => setDetailEvent(null)} title={detailEvent?.name ?? "Event"} subtitle={detailEvent ? `Hosted by ${detailEvent.host}` : undefined}>
        {detailEvent && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={STATUS_TONE[detailEvent.status] ?? "neutral"}>{detailEvent.status}</StatusPill>
              {detailEvent.sports.map((s) => (
                <span key={s} className="rounded-full bg-surface-alt px-2.5 py-0.5 text-xs text-text-secondary">{s}</span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricTile label="Fixtures" value={detailEvent.fixtures} />
              <MetricTile label="Players" value={detailEvent.rosters} />
              <MetricTile label="Sports" value={detailEvent.sports.length} />
              <MetricTile label="Start date" value={detailEvent.startDate.slice(0, 10)} />
            </div>
          </div>
        )}
      </Modal>

      {/* School detail — its record + the events it hosts */}
      <Modal open={!!detailSchool} onClose={() => setDetailSchool(null)} title={detailSchool?.name ?? "School"} subtitle="Interschool record & hosted events">
        {detailSchool && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MetricTile label="Played" value={detailSchool.played} />
              <MetricTile label="Won" value={detailSchool.won} tone="success" />
              <MetricTile label="Points" value={detailSchool.points} tone="accent" />
              <MetricTile label="Drawn" value={detailSchool.drawn} />
              <MetricTile label="Lost" value={detailSchool.lost} tone="danger" />
              <MetricTile label="Win %" value={detailSchool.played ? `${Math.round((detailSchool.won / detailSchool.played) * 100)}%` : "—"} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Events hosted</p>
              {(() => {
                const hosted = (data?.events ?? []).filter((e) => e.host === detailSchool.name);
                return hosted.length === 0 ? (
                  <p className="text-sm text-text-muted">No events hosted by this school.</p>
                ) : (
                  <div className="space-y-1.5">
                    {hosted.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-sm">
                        <span className="text-text-primary">{e.name}</span>
                        <StatusPill tone={STATUS_TONE[e.status] ?? "neutral"}>{e.status}</StatusPill>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
