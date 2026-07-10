"use client";

// Public cross-organizer player/team dashboard — anyone can view, no login.
// Aggregates every completed tournament match on the platform sport-wise:
// the career table for players and teams playing across organizers.

import { useCallback, useEffect, useState } from "react";
import { Search, Trophy } from "lucide-react";
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

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function sportLabel(key: string) {
  return key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RankingsPage() {
  const [data, setData] = useState<Leaderboard | null>(null);
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
  }, [load]);

  const rows = (data?.rows ?? []).filter(
    (r) => !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 text-slate-200 md:px-10">
      <header className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/whistle-logo.png" alt="Whistle" className="mx-auto mb-3 h-14 w-auto" />
        <p className="text-xs uppercase tracking-widest text-amber-400/80">Whistle Tournaments</p>
        <h1 className="mt-1 flex items-center justify-center gap-2 text-3xl font-extrabold text-white">
          <Trophy size={26} className="text-amber-300" /> Player Rankings
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Every player and team, across every tournament and organizer — ranked from real match results.
        </p>
        <a href="/play" className="mt-2 inline-block text-xs text-amber-300 hover:underline">
          ← Back to the tournaments portal
        </a>
      </header>

      {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}

      {data && data.sports.length === 0 && (
        <p className="text-center text-sm text-slate-500">No completed tournament matches yet — check back soon.</p>
      )}

      {data && data.sports.length > 0 && (
        <>
          {/* Sport picker */}
          <div className="mb-4 flex flex-wrap justify-center gap-2">
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
        Powered by Whistle · rankings update as officials confirm results
      </footer>
    </main>
  );
}
