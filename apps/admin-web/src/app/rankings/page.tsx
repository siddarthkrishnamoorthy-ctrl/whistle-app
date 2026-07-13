"use client";

// Whistle Pulse — the public tournament dashboard players, referees and
// organizers open every day: podium, top players of the week and month,
// fresh champions, and the full cross-organizer career leaderboard.
// No login needed; everything is derived from confirmed match results.

import { useCallback, useEffect, useState } from "react";
import { Activity, Flame, Medal, Search, Swords, Trophy, Users } from "lucide-react";
import { RANK_MEDALS, sportEmoji } from "@/lib/sport-icons";

interface LeaderboardRow {
  name: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  scoreFor: number;
  scoreAgainst: number;
  tournaments: number;
  winPct: number;
}

interface Leaderboard {
  sports: string[];
  sportKey: string | null;
  rows: LeaderboardRow[];
}

interface PulseAgg {
  name: string;
  sportKey: string;
  played: number;
  won: number;
}

interface Pulse {
  totals: { tournaments: number; players: number; matchesCompleted: number };
  topWeek: PulseAgg[];
  topMonth: PulseAgg[];
  mostActive: { name: string; played: number }[];
  recentWinners: {
    tournament: string;
    slug: string;
    event: string;
    sportKey: string;
    champion: string;
    runnerUp: string | null;
    scoreDisplay: string | null;
    when: string;
  }[];
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function sportLabel(key: string) {
  return key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PulsePage() {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (sportKey?: string) => {
    try {
      setError(null);
      const res = await fetch(`${API}/tournaments/public/leaderboard${sportKey ? `?sportKey=${sportKey}` : ""}`);
      if (!res.ok) throw new Error("Could not load the leaderboard.");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the leaderboard.");
    }
  }, []);

  useEffect(() => {
    load();
    fetch(`${API}/tournaments/public/pulse`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setPulse)
      .catch(() => {});
  }, [load]);

  const rows = (data?.rows ?? []).filter(
    (r) => !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const podium = (data?.rows ?? []).slice(0, 3);

  const statChips = pulse
    ? [
        { icon: Users, label: "players on the circuit", value: pulse.totals.players.toLocaleString("en-IN") },
        { icon: Trophy, label: "tournaments", value: pulse.totals.tournaments.toLocaleString("en-IN") },
        { icon: Swords, label: "matches decided", value: pulse.totals.matchesCompleted.toLocaleString("en-IN") },
      ]
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 text-slate-200 md:px-10">
      <header className="mb-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/whistle-logo.png" alt="Whistle" className="mx-auto mb-3 h-14 w-auto" />
        <p className="text-xs uppercase tracking-widest text-amber-400/80">Whistle Tournaments</p>
        <h1 className="mt-1 flex items-center justify-center gap-2 text-3xl font-extrabold text-white">
          <Activity size={26} className="text-amber-300" /> Whistle Pulse
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Who&apos;s hot, who just lifted a trophy, and the career table — across every tournament and organizer.
        </p>
        <a href="/play" className="mt-2 inline-block text-xs text-amber-300 hover:underline">
          ← Back to the tournaments portal
        </a>
      </header>

      {/* Stat chips */}
      {statChips.length > 0 && (
        <div className="mb-8 flex flex-wrap justify-center gap-3">
          {statChips.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.05] px-5 py-2.5">
                <Icon size={16} className="text-amber-300" />
                <span className="text-lg font-extrabold text-white">{c.value}</span>
                <span className="text-xs text-slate-400">{c.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}

      {/* Hot right now — week + month + most active */}
      {pulse && (pulse.topWeek.length > 0 || pulse.topMonth.length > 0 || pulse.mostActive.length > 0) && (
        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <HotCard
            title="Top players this week"
            icon={<Flame size={15} className="text-amber-300" />}
            empty="No matches decided in the last 7 days — this space is up for grabs!"
            rows={pulse.topWeek.map((r) => ({
              name: r.name,
              chip: `${sportEmoji(r.sportKey)} ${r.won}W / ${r.played}`,
            }))}
          />
          <HotCard
            title="Top players this month"
            icon={<Medal size={15} className="text-amber-300" />}
            empty="No matches decided in the last 30 days."
            rows={pulse.topMonth.map((r) => ({
              name: r.name,
              chip: `${sportEmoji(r.sportKey)} ${r.won}W / ${r.played}`,
            }))}
          />
          <HotCard
            title="Most active (30 days)"
            icon={<Activity size={15} className="text-amber-300" />}
            empty="Nobody has taken the court this month yet."
            rows={pulse.mostActive.map((r) => ({ name: r.name, chip: `${r.played} matches` }))}
          />
        </section>
      )}

      {/* Fresh champions wall */}
      {pulse && pulse.recentWinners.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400">
            <Trophy size={14} className="text-amber-300" /> Fresh champions
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pulse.recentWinners.map((w, i) => (
              <a
                key={i}
                href={`/t/${w.slug}`}
                className="group rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 via-white/[0.03] to-transparent p-4 transition hover:border-amber-400/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{sportEmoji(w.sportKey)}</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    {w.when ? new Date(w.when).toLocaleDateString([], { day: "2-digit", month: "short" }) : ""}
                  </span>
                </div>
                <p className="mt-2 text-base font-extrabold text-amber-300">🏆 {w.champion}</p>
                <p className="text-xs text-slate-400">
                  won <span className="text-slate-200">{w.event}</span>
                  {w.runnerUp ? (
                    <>
                      {" "}
                      def. <span className="text-slate-300">{w.runnerUp}</span>
                    </>
                  ) : null}
                  {w.scoreDisplay && w.scoreDisplay !== "bye" ? ` · ${w.scoreDisplay}` : ""}
                </p>
                <p className="mt-1 truncate text-[11px] text-slate-500 group-hover:text-amber-300/80">{w.tournament} ↗</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {data && data.sports.length === 0 && (
        <p className="text-center text-sm text-slate-500">No completed tournament matches yet — check back soon.</p>
      )}

      {data && data.sports.length > 0 && (
        <>
          <h2 className="mb-3 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400">
            <Medal size={14} className="text-amber-300" /> Career leaderboard
          </h2>

          {/* Sport picker */}
          <div className="mb-5 flex flex-wrap justify-center gap-2">
            {data.sports.map((s) => {
              const active = s === data.sportKey;
              return (
                <button
                  key={s}
                  onClick={() => load(s)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    active ? "bg-amber-400 text-slate-900" : "border border-white/15 text-slate-300 hover:border-amber-400/50"
                  }`}
                >
                  {sportEmoji(s)} {sportLabel(s)}
                </button>
              );
            })}
          </div>

          {/* Podium — the top 3 of the selected board */}
          {podium.length >= 2 && !search && (
            <div className="mb-6 flex items-end justify-center gap-3">
              {[1, 0, 2].map((idx) => {
                const r = podium[idx];
                if (!r) return null;
                const heights = ["h-24", "h-32", "h-20"];
                const tones = [
                  "from-slate-400/30 border-slate-300/40",
                  "from-amber-400/40 border-amber-300/60",
                  "from-orange-700/30 border-orange-400/40",
                ];
                const displayOrder = idx === 0 ? 1 : idx === 1 ? 0 : 2;
                return (
                  <div key={r.name} className="flex w-36 flex-col items-center">
                    <span className="mb-1 text-2xl">{RANK_MEDALS[idx]}</span>
                    <span className={`w-full truncate text-center text-sm font-bold ${idx === 0 ? "text-amber-300" : "text-slate-200"}`}>
                      {r.name}
                    </span>
                    <span className="mb-2 text-[11px] text-slate-500">
                      {r.won}W · {r.winPct}%
                    </span>
                    <div
                      className={`w-full rounded-t-xl border border-b-0 bg-gradient-to-t to-transparent ${heights[displayOrder]} ${tones[displayOrder]} flex items-start justify-center pt-2 text-lg font-black text-white/80`}
                    >
                      {idx + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Search */}
          <div className="mx-auto mb-5 flex max-w-sm items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3">
            <Search size={14} className="text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player or team…"
              className="w-full bg-transparent py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          {rows.length === 0 ? (
            <p className="text-center text-sm text-slate-500">
              {search ? "No player or team matches your search." : "No completed matches in this sport yet."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.06] text-left text-xs uppercase text-slate-400">
                    <th className="w-12 px-3 py-2">#</th>
                    <th className="px-3 py-2">Player / Team</th>
                    <th className="px-3 py-2 text-center" title="Tournaments played">T</th>
                    <th className="px-3 py-2 text-center" title="Matches played">P</th>
                    <th className="px-3 py-2 text-center" title="Won">W</th>
                    <th className="px-3 py-2 text-center" title="Lost">L</th>
                    <th className="px-3 py-2 text-center">Win %</th>
                    <th className="px-3 py-2 text-center" title="Score difference">+/−</th>
                    <th className="px-3 py-2 text-center">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const diff = r.scoreFor - r.scoreAgainst;
                    return (
                      <tr
                        key={`${r.name}-${i}`}
                        className={`border-b border-white/5 last:border-0 ${
                          i === 0 && !search ? "bg-amber-400/10" : i % 2 === 1 ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          {!search && RANK_MEDALS[i] ? (
                            <span className="text-base">{RANK_MEDALS[i]}</span>
                          ) : (
                            <span className="text-slate-500">{i + 1}</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 ${i === 0 && !search ? "font-bold text-amber-300" : "font-medium text-slate-200"}`}>
                          {r.name}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-400">{r.tournaments}</td>
                        <td className="px-3 py-2 text-center text-slate-400">{r.played}</td>
                        <td className="px-3 py-2 text-center text-slate-200">{r.won}</td>
                        <td className="px-3 py-2 text-center text-slate-400">{r.lost}</td>
                        <td className="px-3 py-2 text-center text-slate-200">{r.winPct}%</td>
                        <td className={`px-3 py-2 text-center ${diff > 0 ? "text-emerald-300" : diff < 0 ? "text-red-400" : "text-slate-500"}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-white">{r.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <footer className="mt-10 text-center text-xs text-slate-600">
        Powered by Whistle · Pulse updates the moment officials confirm results
      </footer>
    </main>
  );
}

function HotCard({
  title,
  icon,
  rows,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { name: string; chip: string }[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
        {icon} {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 text-center text-sm">{RANK_MEDALS[i] ?? <span className="text-xs text-slate-500">{i + 1}</span>}</span>
                <span className={`truncate text-sm font-semibold ${i === 0 ? "text-amber-300" : "text-slate-200"}`}>{r.name}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-300">{r.chip}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
