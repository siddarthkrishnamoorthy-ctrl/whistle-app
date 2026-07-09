"use client";

// Public tournament microsite (BRD 6.6) — schedule, live scores, brackets,
// standings and results, viewable WITHOUT any login or app install. This
// route lives outside the (dashboard) auth group on purpose.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

interface PublicEntry {
  id: string;
  name: string;
  seed: number | null;
}

interface PublicMatch {
  round: number;
  matchNo: number;
  entryAId: string | null;
  entryBId: string | null;
  status: string;
  scoreA: number;
  scoreB: number;
  scoreDisplay: string | null;
  winnerEntryId: string | null;
  venue: string | null;
}

interface PublicEvent {
  id: string;
  name: string;
  sportKey: string;
  kind: string;
  discipline: string;
  format: string;
  duprRated: boolean;
  entryFee: string | null;
  entries: PublicEntry[];
  matches: PublicMatch[];
  standings?: {
    entryId: string;
    name: string;
    played: number;
    won: number;
    lost: number;
    points: number;
    scoreFor: number;
    scoreAgainst: number;
  }[];
  heatRanking?: { rank: number; name: string; value: number; unit: string; heat: number }[];
  finalRanking?: { rank: number; name: string; value: number; unit: string }[];
}

interface PublicTournament {
  name: string;
  description: string | null;
  rules: string | null;
  sports: string[];
  status: string;
  startDate: string;
  endDate: string;
  venues: string[];
  organizer: string;
  events: PublicEvent[];
}

function entryName(entries: PublicEntry[], id: string | null): string {
  if (!id) return "TBD";
  return entries.find((e) => e.id === id)?.name ?? "TBD";
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Coming soon",
  registration_open: "Registration open",
  in_progress: "Live",
  completed: "Completed",
};

export default function PublicTournamentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicTournament | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/tournaments/public/${slug}`);
      if (!res.ok) throw new Error("Tournament not found.");
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tournament.");
    }
  }, [slug]);

  useEffect(() => {
    load();
    // Live scores refresh without any interaction while matches are on.
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-300">
        <p>{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-400">
        <p>Loading…</p>
      </main>
    );
  }

  const live = data.events.flatMap((ev) =>
    ev.matches.filter((m) => m.status === "live").map((m) => ({ ev, m }))
  );

  return (
    <main className="min-h-screen px-4 py-10 md:px-10 max-w-5xl mx-auto text-slate-200">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs uppercase tracking-widest text-amber-400/80">Whistle Tournaments</span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-emerald-400/40 text-emerald-300">
            {STATUS_LABEL[data.status] ?? data.status}
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white">{data.name}</h1>
        <p className="text-sm text-slate-400 mt-2">
          Hosted by {data.organizer} · {new Date(data.startDate).toLocaleDateString()} –{" "}
          {new Date(data.endDate).toLocaleDateString()}
          {data.venues.length > 0 && <> · {data.venues.join(", ")}</>}
        </p>
        {data.description && <p className="text-sm text-slate-300 mt-3 max-w-2xl">{data.description}</p>}
        {data.status === "registration_open" && (
          <a
            href="/play"
            className="mt-4 inline-block rounded-full bg-amber-400 px-6 py-2 text-sm font-bold text-slate-900 hover:opacity-90"
          >
            Register to play →
          </a>
        )}
      </header>

      {data.rules && (
        <section className="mb-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-bold text-white mb-2">📋 Rules &amp; regulations</h2>
          <p className="whitespace-pre-line text-sm text-slate-300">{data.rules}</p>
        </section>
      )}

      {/* Live now */}
      {live.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-3">🔴 Live now</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {live.map(({ ev, m }) => (
              <div
                key={`${ev.id}-${m.matchNo}`}
                className="rounded-xl border border-red-400/30 bg-white/5 p-4"
              >
                <p className="text-xs text-slate-400 mb-1">
                  {ev.name}
                  {m.venue ? ` · ${m.venue}` : ""}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{entryName(ev.entries, m.entryAId)}</span>
                  <span className="text-2xl font-extrabold text-amber-400 px-3">
                    {m.scoreA} – {m.scoreB}
                  </span>
                  <span className="font-semibold text-right">{entryName(ev.entries, m.entryBId)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Events */}
      {data.events.map((ev) => (
        <section key={ev.id} className="mb-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
            <span className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{ev.name}</h2>
              {ev.duprRated && (
                <span className="rounded-full border border-amber-400/60 bg-amber-400/10 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                  DUPR rated
                </span>
              )}
            </span>
            <span className="text-xs text-slate-400">
              {ev.sportKey} · {ev.kind} ·{" "}
              {ev.discipline === "timed" ? "timed event" : ev.format.replace("_", " ")}
              {ev.entryFee ? ` · entry ₹${ev.entryFee}` : ""}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">{ev.entries.length} participants</p>

          {/* Match schedule / bracket */}
          {ev.discipline === "match" && ev.matches.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-white/10">
                    <th className="py-2 pr-2">Rd</th>
                    <th className="py-2 pr-2">Match</th>
                    <th className="py-2 pr-2 text-center">Score</th>
                    <th className="py-2 pr-2">Court</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ev.matches.map((m) => (
                    <tr key={m.matchNo} className="border-b border-white/5">
                      <td className="py-2 pr-2 text-slate-500">R{m.round}</td>
                      <td className="py-2 pr-2">
                        <span className={m.winnerEntryId && m.winnerEntryId === m.entryAId ? "text-amber-300 font-semibold" : ""}>
                          {entryName(ev.entries, m.entryAId)}
                        </span>{" "}
                        <span className="text-slate-500">vs</span>{" "}
                        <span className={m.winnerEntryId && m.winnerEntryId === m.entryBId ? "text-amber-300 font-semibold" : ""}>
                          {entryName(ev.entries, m.entryBId)}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-center font-mono">
                        {m.scoreDisplay === "bye" ? "bye" : m.status === "scheduled" ? "—" : `${m.scoreA}–${m.scoreB}`}
                      </td>
                      <td className="py-2 pr-2 text-slate-400">{m.venue ?? "—"}</td>
                      <td className="py-2">
                        <span
                          className={
                            m.status === "live"
                              ? "text-red-400"
                              : m.status === "completed"
                                ? "text-slate-500"
                                : "text-emerald-300"
                          }
                        >
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ev.discipline === "match" && ev.matches.length === 0 && (
            <p className="text-sm text-slate-500">Fixtures will appear here once the draw is made.</p>
          )}

          {/* Round-robin standings */}
          {(ev.format === "round_robin" || ev.format === "league") && (ev.standings?.length ?? 0) > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-bold text-white mb-2">🏆 Points table</h3>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[440px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.06] text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2 w-10">#</th>
                      <th className="px-3 py-2">{ev.kind === "team" ? "Team" : "Player"}</th>
                      <th className="px-3 py-2 text-center" title="Played">P</th>
                      <th className="px-3 py-2 text-center" title="Won">W</th>
                      <th className="px-3 py-2 text-center" title="Lost">L</th>
                      <th className="px-3 py-2 text-center" title="Score difference">+/−</th>
                      <th className="px-3 py-2 text-center" title="Points">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ev.standings!.map((row, i) => {
                      const diff = row.scoreFor - row.scoreAgainst;
                      return (
                        <tr
                          key={row.entryId}
                          className={`border-b border-white/5 last:border-0 ${
                            i === 0 ? "bg-amber-400/10" : i % 2 === 1 ? "bg-white/[0.02]" : ""
                          }`}
                        >
                          <td className="px-3 py-2">
                            {i === 0 ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-slate-900">
                                1
                              </span>
                            ) : (
                              <span className="text-slate-500">{i + 1}</span>
                            )}
                          </td>
                          <td className={`px-3 py-2 ${i === 0 ? "font-bold text-amber-300" : "font-medium text-slate-200"}`}>
                            {row.name}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-400">{row.played}</td>
                          <td className="px-3 py-2 text-center text-slate-200">{row.won}</td>
                          <td className="px-3 py-2 text-center text-slate-400">{row.lost}</td>
                          <td className={`px-3 py-2 text-center ${diff > 0 ? "text-emerald-300" : diff < 0 ? "text-red-400" : "text-slate-500"}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-white">{row.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Timed results */}
          {ev.discipline === "timed" && (
            <div className="grid gap-6 md:grid-cols-2">
              {(ev.heatRanking?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Heats</h3>
                  <ol className="space-y-1 text-sm">
                    {ev.heatRanking!.map((r) => (
                      <li key={`${r.name}-${r.heat}`} className="flex justify-between border-b border-white/5 py-1">
                        <span>
                          <span className="text-slate-500 mr-2">{r.rank}.</span>
                          {r.name}
                        </span>
                        <span className="font-mono text-slate-300">
                          {r.value} {r.unit}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {(ev.finalRanking?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Final</h3>
                  <ol className="space-y-1 text-sm">
                    {ev.finalRanking!.map((r) => (
                      <li key={r.name} className="flex justify-between border-b border-white/5 py-1">
                        <span className={r.rank <= 3 ? "text-amber-300 font-semibold" : ""}>
                          <span className="mr-2">{r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `${r.rank}.`}</span>
                          {r.name}
                        </span>
                        <span className="font-mono text-slate-300">
                          {r.value} {r.unit}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {(ev.heatRanking?.length ?? 0) === 0 && (ev.finalRanking?.length ?? 0) === 0 && (
                <p className="text-sm text-slate-500">Results will appear here as they are recorded.</p>
              )}
            </div>
          )}
        </section>
      ))}

      <footer className="text-center text-xs text-slate-600 pb-6">
        Powered by Whistle · live scores refresh automatically
      </footer>
    </main>
  );
}
