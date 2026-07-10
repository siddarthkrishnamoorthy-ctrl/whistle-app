"use client";

// Cricket ball-by-ball scoring console (Cricket Scoring Requirements v1.0).
// Single-tap runs/extras/wickets, automatic strike rotation and over/innings
// progression, undo, audited corrections, and the CricHeroes-style visuals
// (Manhattan, Worm, fall of wickets, wagon-wheel directions) — all derived
// from the delivery log by the backend.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { tJson, tournamentSession } from "@/lib/tournament-client";

interface BattingRow {
  name: string; runs: number; balls: number; fours: number; sixes: number; strikeRate: number; out: boolean; dismissal: string | null;
}
interface BowlingRow {
  name: string; overs: string; maidens: number; runs: number; wickets: number; economy: number; wides: number; noBalls: number;
}
interface InningsView {
  innings: number;
  battingSide: string;
  battingTeam: string;
  runs: number;
  wickets: number;
  overs: string;
  summary: string;
  battingCard: BattingRow[];
  bowlingCard: BowlingRow[];
  partnerships: { batters: string[]; runs: number; balls: number }[];
  fallOfWickets: { wicket: number; score: number; over: string; batter: string }[];
  manhattan: { over: number; runs: number; wickets: number }[];
  worm: number[];
  wagon: Record<string, number>;
}
interface Delivery {
  id: string; seq: number; innings: number; overNo: number; ballInOver: number; batter: string; bowler: string;
  runsOffBat: number; extraType: string | null; extraRuns: number; isWicket: boolean; wicketType: string | null;
  dismissedBatter: string | null; fielder: string | null;
}
interface CricketState {
  configured: boolean;
  matchId: string;
  eventName: string;
  round: number;
  matchNo: number;
  teams: { A: string; B: string };
  rosters: { A: string[]; B: string[] };
  status: string;
  config?: { oversPerSide: number; battingFirst: string; playersA: string[]; playersB: string[] };
  currentInnings?: number;
  complete?: boolean;
  resultText?: string | null;
  target?: number | null;
  crr?: number;
  rrr?: number | null;
  ballsLeft?: number | null;
  innings?: InningsView[];
  prompts?: {
    needNewBatter: boolean;
    overJustCompleted: boolean;
    lastBowler: string | null;
    availableBatters: string[];
    striker: { striker: string; nonStriker: string };
  };
  recent?: Delivery[];
}

const WICKET_TYPES = ["bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket", "retired"];
const DIRECTIONS = ["third man", "point", "cover", "mid off", "mid on", "mid wicket", "square leg", "fine leg"];

export default function CricketScoringPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [state, setState] = useState<CricketState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"score" | "scorecard" | "graphs" | "deliveries">("score");

  // Setup form
  const [overs, setOvers] = useState("10");
  const [batFirst, setBatFirst] = useState<"A" | "B">("A");
  const [xiA, setXiA] = useState("");
  const [xiB, setXiB] = useState("");

  // Current-ball context
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");
  const [direction, setDirection] = useState<string | null>(null);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [wicketType, setWicketType] = useState("bowled");
  const [fielder, setFielder] = useState("");
  const [whoOut, setWhoOut] = useState<"striker" | "nonStriker">("striker");
  const [editing, setEditing] = useState<Delivery | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editRuns, setEditRuns] = useState("0");

  const load = useCallback(async () => {
    try {
      const s = await tJson<CricketState>(`/tournaments/matches/${matchId}/cricket`);
      setState(s);
      if (s.configured) {
        if (!xiA) setXiA((s.config?.playersA ?? []).join("\n"));
        if (!xiB) setXiB((s.config?.playersB ?? []).join("\n"));
        if (s.prompts && !s.prompts.needNewBatter) {
          setStriker((prev) => prev || s.prompts!.striker.striker);
          setNonStriker((prev) => prev || s.prompts!.striker.nonStriker);
        }
      } else {
        setXiA(s.rosters.A.join("\n"));
        setXiB(s.rosters.B.join("\n"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the match.");
    }
  }, [matchId, xiA, xiB]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      const s = (await fn()) as CricketState;
      if (s && typeof s === "object" && "configured" in s) {
        setState((prev) => ({ ...(prev as CricketState), ...s }));
        if (s.prompts) {
          // Follow the engine's automatic strike rotation (BRD 4.2).
          setStriker(s.prompts.needNewBatter ? "" : s.prompts.striker.striker);
          setNonStriker(s.prompts.striker.nonStriker);
          if (s.prompts.overJustCompleted) setBowler("");
        }
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  function ball(payload: Record<string, unknown>) {
    if (!striker || !nonStriker || !bowler) {
      setError("Set the striker, non-striker and bowler first.");
      return;
    }
    const body = { batter: striker, nonStriker, bowler, shotDirection: direction, ...payload };
    setDirection(null);
    act(() => tJson(`/tournaments/matches/${matchId}/cricket/ball`, { method: "POST", body: JSON.stringify(body) }));
  }

  if (!tournamentSession()) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-300">
        <p>
          Log in first at{" "}
          <a href="/play" className="text-amber-300 underline">
            /play
          </a>{" "}
          (officials) or{" "}
          <a href="/organizer" className="text-amber-300 underline">
            /organizer
          </a>
          .
        </p>
      </main>
    );
  }
  if (!state) return <main className="flex min-h-screen items-center justify-center text-slate-400">Loading…</main>;

  const live = state.innings?.[(state.currentInnings ?? 1) - 1];
  const fieldingSide = live?.battingSide === "A" ? "B" : "A";
  const bowlingXI = state.config ? (fieldingSide === "A" ? state.config.playersA : state.config.playersB) : [];

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 text-slate-200">
      <header className="mb-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/whistle-logo.png" alt="Whistle" className="h-9 w-auto" />
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-400/80">🏏 Cricket scoring</p>
          <h1 className="text-lg font-extrabold text-white">
            {state.teams.A} vs {state.teams.B}
          </h1>
          <p className="text-xs text-slate-500">
            {state.eventName} · Round {state.round}, Match {state.matchNo}
          </p>
        </div>
      </header>

      {error && <p className="mb-3 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-300">⚠ {error}</p>}

      {/* ── Match setup (BRD 4.1) ── */}
      {!state.configured ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-3 font-bold text-white">Match setup</h2>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="text-sm text-slate-400">
              Overs per side (any count)
              <input
                type="number"
                value={overs}
                onChange={(e) => setOvers(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
              />
            </label>
            <div className="text-sm text-slate-400">
              Toss — batting first
              <div className="mt-1 flex gap-2">
                {(["A", "B"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setBatFirst(s)}
                    className={`flex-1 truncate rounded-lg border px-2 py-2 text-sm font-semibold ${
                      batFirst === s ? "border-amber-400 bg-amber-400/10 text-amber-300" : "border-white/15 text-slate-300"
                    }`}
                  >
                    {state.teams[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: `${state.teams.A} XI (one per line)`, val: xiA, set: setXiA },
              { label: `${state.teams.B} XI (one per line)`, val: xiB, set: setXiB },
            ].map((f) => (
              <label key={f.label} className="text-sm text-slate-400">
                {f.label}
                <textarea
                  rows={6}
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </label>
            ))}
          </div>
          <button
            disabled={busy}
            onClick={() =>
              act(() =>
                tJson(`/tournaments/matches/${matchId}/cricket/setup`, {
                  method: "POST",
                  body: JSON.stringify({
                    oversPerSide: Number(overs) || 10,
                    battingFirst: batFirst,
                    playersA: xiA.split("\n").map((x) => x.trim()).filter(Boolean),
                    playersB: xiB.split("\n").map((x) => x.trim()).filter(Boolean),
                  }),
                })
              )
            }
            className="mt-4 w-full rounded-full bg-amber-400 py-2.5 text-sm font-bold text-slate-900"
          >
            Start innings
          </button>
        </section>
      ) : (
        <>
          {/* ── Live scoreboard (BRD 4.3) ── */}
          <section className="mb-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-400">{live?.battingTeam} batting</p>
                <p className="text-4xl font-extrabold text-white">
                  {live?.runs}/{live?.wickets}
                  <span className="ml-2 text-lg font-semibold text-slate-400">({live?.overs} ov)</span>
                </p>
              </div>
              <div className="text-right text-sm text-slate-300">
                <p>CRR {state.crr}</p>
                {state.target != null && state.currentInnings === 2 && !state.complete && (
                  <p className="text-amber-300">
                    Need {Math.max(0, (state.target ?? 0) - (live?.runs ?? 0))} off {state.ballsLeft} · RRR {state.rrr ?? "—"}
                  </p>
                )}
                {state.target != null && <p className="text-xs text-slate-500">Target {state.target}</p>}
              </div>
            </div>
            {state.complete && (
              <p className="mt-3 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-center font-bold text-emerald-300">
                🏆 {state.resultText}
              </p>
            )}
            {state.prompts?.overJustCompleted && !state.complete && (
              <p className="mt-2 text-xs font-semibold text-amber-300">
                Over complete — ends swap; choose the next bowler (not {state.prompts.lastBowler}).
              </p>
            )}
            {state.prompts?.needNewBatter && !state.complete && (
              <p className="mt-2 text-xs font-semibold text-red-300">Wicket! Pick the next batter in.</p>
            )}
          </section>

          {/* Tabs */}
          <div className="mb-4 flex gap-2">
            {(
              [
                ["score", "⚡ Score"],
                ["scorecard", "📋 Scorecard"],
                ["graphs", "📊 Graphs"],
                ["deliveries", "🕐 Deliveries"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                  tab === k ? "bg-amber-400 text-slate-900" : "border border-white/15 text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── SCORE (BRD 4.2) ── */}
          {tab === "score" && !state.complete && (
            <section className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <label className="text-xs text-slate-400">
                  Striker *
                  <input
                    list="batters"
                    value={striker}
                    onChange={(e) => setStriker(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-white focus:border-amber-400 focus:outline-none"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Non-striker *
                  <input
                    list="batters"
                    value={nonStriker}
                    onChange={(e) => setNonStriker(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-white focus:border-amber-400 focus:outline-none"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Bowler *
                  <input
                    list="bowlers"
                    value={bowler}
                    onChange={(e) => setBowler(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-white focus:border-amber-400 focus:outline-none"
                  />
                </label>
                <datalist id="batters">
                  {(state.prompts?.availableBatters ?? []).map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <datalist id="bowlers">
                  {bowlingXI.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              {/* Run pad — single tap (BRD 4.2, NFR speed of entry) */}
              <div className="grid grid-cols-6 gap-2">
                {[0, 1, 2, 3, 4, 6].map((r) => (
                  <button
                    key={r}
                    disabled={busy}
                    onClick={() => ball({ runsOffBat: r })}
                    className={`rounded-xl py-4 text-xl font-extrabold ${
                      r >= 4 ? "bg-amber-400 text-slate-900" : "border border-white/15 bg-white/5 text-white hover:border-amber-400/60"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Extras — correct ball/run counting handled by the engine */}
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ["Wide", "wide", 1],
                    ["No-ball", "no_ball", 1],
                    ["Bye", "bye", 1],
                    ["Leg-bye", "leg_bye", 1],
                  ] as const
                ).map(([label, type, runs]) => (
                  <button
                    key={type}
                    disabled={busy}
                    onClick={() => ball({ runsOffBat: 0, extraType: type, extraRuns: runs })}
                    className="rounded-xl border border-sky-400/40 bg-sky-400/10 py-3 text-sm font-bold text-sky-300"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Shot direction (optional — powers the Wagon Wheel) */}
              <div>
                <p className="mb-1 text-xs text-slate-500">Shot direction for the next boundary (optional — Wagon Wheel)</p>
                <div className="flex flex-wrap gap-1.5">
                  {DIRECTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDirection(direction === d ? null : d)}
                      className={`rounded-full px-3 py-1 text-xs ${
                        direction === d ? "bg-emerald-400 font-bold text-slate-900" : "border border-white/15 text-slate-400"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => setWicketOpen((v) => !v)}
                  className="flex-1 rounded-xl bg-red-500/90 py-3 text-sm font-extrabold text-white"
                >
                  WICKET
                </button>
                <button
                  disabled={busy}
                  onClick={() => act(() => tJson(`/tournaments/matches/${matchId}/cricket/undo`, { method: "POST" }))}
                  className="rounded-xl border border-white/20 px-6 py-3 text-sm font-bold text-slate-300"
                >
                  ↩ Undo
                </button>
              </div>

              {wicketOpen && (
                <div className="rounded-2xl border border-red-400/30 bg-red-400/5 p-4">
                  <p className="mb-2 text-xs font-bold uppercase text-red-300">How out?</p>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {WICKET_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setWicketType(t)}
                        className={`rounded-full px-3 py-1 text-xs ${
                          wicketType === t ? "bg-red-400 font-bold text-slate-900" : "border border-white/15 text-slate-300"
                        }`}
                      >
                        {t.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                  {["caught", "run_out", "stumped"].includes(wicketType) && (
                    <input
                      placeholder="Fielder involved *"
                      value={fielder}
                      onChange={(e) => setFielder(e.target.value)}
                      list="bowlers"
                      className="mb-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-red-400 focus:outline-none"
                    />
                  )}
                  {wicketType === "run_out" && (
                    <div className="mb-3 flex gap-2 text-xs">
                      {(["striker", "nonStriker"] as const).map((w) => (
                        <button
                          key={w}
                          onClick={() => setWhoOut(w)}
                          className={`flex-1 rounded-lg border px-2 py-1.5 ${
                            whoOut === w ? "border-red-400 text-red-300" : "border-white/15 text-slate-400"
                          }`}
                        >
                          {w === "striker" ? striker || "striker" : nonStriker || "non-striker"} out
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => {
                      setWicketOpen(false);
                      ball({
                        runsOffBat: 0,
                        isWicket: true,
                        wicketType,
                        fielder: fielder || undefined,
                        dismissedBatter: whoOut === "striker" ? striker : nonStriker,
                      });
                      setFielder("");
                    }}
                    className="w-full rounded-full bg-red-500 py-2 text-sm font-bold text-white"
                  >
                    Confirm wicket
                  </button>
                </div>
              )}
            </section>
          )}
          {tab === "score" && state.complete && (
            <p className="text-sm text-slate-400">
              Match complete. Mistakes? Open the Deliveries tab — corrections need a reason and are fully audited, and
              every dependent stat recalculates automatically.
            </p>
          )}

          {/* ── SCORECARD (BRD 4.4) ── */}
          {tab === "scorecard" &&
            (state.innings ?? [])
              .filter((inn) => inn.battingCard.length > 0)
              .map((inn) => (
                <section key={inn.innings} className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="mb-2 font-bold text-white">
                    {inn.battingTeam} — {inn.summary}
                  </h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-left uppercase text-slate-500">
                        <th className="py-1">Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inn.battingCard.map((b) => (
                        <tr key={b.name} className="border-b border-white/5">
                          <td className="py-1.5">
                            <span className="text-slate-200">{b.name}</span>
                            <span className="ml-2 text-slate-500">{b.out ? b.dismissal : "not out"}</span>
                          </td>
                          <td className="font-bold text-white">{b.runs}</td><td>{b.balls}</td><td>{b.fours}</td><td>{b.sixes}</td><td>{b.strikeRate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="mt-3 w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-left uppercase text-slate-500">
                        <th className="py-1">Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>Wd/Nb</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inn.bowlingCard.map((b) => (
                        <tr key={b.name} className="border-b border-white/5">
                          <td className="py-1.5 text-slate-200">{b.name}</td>
                          <td>{b.overs}</td><td>{b.maidens}</td><td>{b.runs}</td>
                          <td className="font-bold text-white">{b.wickets}</td><td>{b.economy}</td><td>{b.wides}/{b.noBalls}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {inn.fallOfWickets.length > 0 && (
                    <p className="mt-3 text-xs text-slate-400">
                      <span className="font-bold text-slate-300">Fall: </span>
                      {inn.fallOfWickets.map((f) => `${f.score}/${f.wicket} (${f.batter}, ${f.over})`).join(" · ")}
                    </p>
                  )}
                  {inn.partnerships.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      <span className="font-bold text-slate-400">Partnerships: </span>
                      {inn.partnerships.map((p) => `${p.runs} (${p.balls}b)`).join(" · ")}
                    </p>
                  )}
                </section>
              ))}

          {/* ── GRAPHS (BRD 4.5) ── */}
          {tab === "graphs" &&
            (state.innings ?? [])
              .filter((inn) => inn.manhattan.length > 0)
              .map((inn) => {
                const maxRuns = Math.max(6, ...inn.manhattan.map((o) => o.runs));
                const maxWorm = Math.max(10, ...(state.innings ?? []).flatMap((x) => x.worm));
                return (
                  <section key={inn.innings} className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <h3 className="mb-3 font-bold text-white">
                      {inn.battingTeam} — Manhattan
                    </h3>
                    <div className="flex h-28 items-end gap-1">
                      {inn.manhattan.map((o) => (
                        <div key={o.over} className="flex flex-1 flex-col items-center gap-0.5">
                          <span className="text-[10px] text-slate-400">{o.runs}</span>
                          <div
                            className={`w-full rounded-t ${o.wickets ? "bg-red-400" : "bg-amber-400"}`}
                            style={{ height: `${Math.max(4, (o.runs / maxRuns) * 80)}px` }}
                            title={`Over ${o.over}: ${o.runs} runs${o.wickets ? `, ${o.wickets} wkt` : ""}`}
                          />
                          <span className="text-[10px] text-slate-600">{o.over}</span>
                        </div>
                      ))}
                    </div>
                    <h4 className="mb-1 mt-4 text-xs font-bold uppercase text-slate-400">Worm (cumulative)</h4>
                    <svg viewBox="0 0 300 80" className="h-20 w-full">
                      <polyline
                        fill="none"
                        stroke="#F5B93F"
                        strokeWidth="2"
                        points={inn.worm.map((v, i) => `${(i / Math.max(1, inn.worm.length - 1)) * 300},${80 - (v / maxWorm) * 75}`).join(" ")}
                      />
                    </svg>
                    {Object.keys(inn.wagon).length > 0 && (
                      <>
                        <h4 className="mb-1 mt-3 text-xs font-bold uppercase text-slate-400">Wagon wheel (boundary runs by direction)</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(inn.wagon).map(([d, r]) => (
                            <span key={d} className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-xs text-emerald-300">
                              {d}: {r}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                );
              })}

          {/* ── DELIVERIES + corrections (BRD 4.6) ── */}
          {tab === "deliveries" && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="mb-2 font-bold text-white">Recent deliveries</h3>
              {(state.recent ?? []).map((d) => (
                <div key={d.id} className="flex items-center justify-between border-b border-white/5 py-1.5 text-xs">
                  <span className="text-slate-300">
                    {d.overNo}.{d.ballInOver || "•"} — {d.batter} · {d.bowler} ·{" "}
                    <span className="font-bold text-white">
                      {d.isWicket ? `W (${d.wicketType})` : d.extraType ? `${d.extraType} +${d.extraRuns + d.runsOffBat}` : `${d.runsOffBat} run${d.runsOffBat === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      setEditing(d);
                      setEditRuns(String(d.runsOffBat));
                      setEditReason("");
                    }}
                    className="text-amber-300 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              ))}
              {editing && (
                <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
                  <p className="mb-2 text-xs font-bold text-amber-300">
                    Correct delivery {editing.overNo}.{editing.ballInOver} — audited (who/when/what/why); all stats recalc.
                  </p>
                  <div className="mb-2 flex gap-2">
                    <input
                      type="number"
                      value={editRuns}
                      onChange={(e) => setEditRuns(e.target.value)}
                      className="w-20 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
                    />
                    <input
                      placeholder="Reason for the correction *"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      className="flex-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busy || !editReason.trim()}
                      onClick={() =>
                        act(async () => {
                          const res = await tJson(`/tournaments/matches/${matchId}/cricket/deliveries/${editing.id}/correct`, {
                            method: "POST",
                            body: JSON.stringify({ changes: { runsOffBat: Number(editRuns) || 0 }, reason: editReason }),
                          });
                          setEditing(null);
                          return res;
                        })
                      }
                      className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-bold text-slate-900 disabled:opacity-40"
                    >
                      Save correction
                    </button>
                    <button onClick={() => setEditing(null)} className="text-xs text-slate-400">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
