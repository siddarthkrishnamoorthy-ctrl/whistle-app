"use client";

// Public portal for the Tournament module — the link players and officials
// use. Lives OUTSIDE the admin (dashboard) group on purpose: no academy
// login exists here, only the tournament module's own open user master.
// Players: browse open tournaments, register, pay. Officials: score the
// matches of tournaments they're appointed to.

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Megaphone,
  Ticket,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  clearTournamentSession,
  tJson,
  tournamentLogin,
  tournamentSession,
  tournamentSignup,
  type TournamentUser,
} from "@/lib/tournament-client";
import { RANK_MEDALS, sportEmoji } from "@/lib/sport-icons";

interface OpenEvent {
  id: string;
  name: string;
  kind: string;
  discipline: string;
  duprRated: boolean;
  entryFee: string | null;
  _count: { entries: number };
}

interface OpenTournament {
  id: string;
  name: string;
  sports: string[];
  startDate: string;
  publicSlug: string;
  organizer: { name: string; organizationName: string | null };
  events: OpenEvent[];
}

interface MyEntry {
  id: string;
  status: string;
  teamName: string | null;
  event: { id: string; name: string; entryFee: string | null; tournament: { name: string; publicSlug: string } };
}

interface OffEntry {
  id: string;
  teamName: string | null;
  players: { name: string }[];
}

interface OffMatch {
  id: string;
  round: number;
  matchNo: number;
  entryAId: string | null;
  entryBId: string | null;
  status: string;
  scoreA: number;
  scoreB: number;
  venue: string | null;
  winnerEntryId: string | null;
  scoreDisplay: string | null;
}

interface OffEvent {
  id: string;
  name: string;
  sportKey: string;
  kind: string;
  discipline: string;
  format: string;
  entries: OffEntry[];
  matches: OffMatch[];
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
}

interface OffTournament {
  id: string;
  name: string;
  venues: string[];
  events: OffEvent[];
}

type ConsoleTab = "score" | "fixtures" | "standings" | "results";

// Mirrors the backend's per-sport final-score rules so referees get instant
// feedback; the API enforces the same rules server-side.
const GAME_SCORE_RULES: Record<string, { target: number; winBy: number; cap?: number; maxSets: number }> = {
  badminton: { target: 21, winBy: 2, cap: 30, maxSets: 3 },
  pickleball: { target: 11, winBy: 2, cap: 21, maxSets: 5 },
  "table-tennis": { target: 11, winBy: 2, cap: 21, maxSets: 7 },
  squash: { target: 11, winBy: 2, cap: 21, maxSets: 5 },
  tennis: { target: 6, winBy: 2, cap: 7, maxSets: 5 },
  volleyball: { target: 25, winBy: 2, maxSets: 5 },
  throwball: { target: 25, winBy: 2, maxSets: 5 },
};

function validateFinalScore(sportKey: string, a: number, b: number): string | null {
  if (a < 0 || b < 0) return "Scores cannot be negative.";
  if (a === b) return "A match needs a winner — enter a decider.";
  const rule = GAME_SCORE_RULES[sportKey];
  if (!rule) return null;
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  if (winner <= rule.maxSets && winner <= 7) {
    const maxNeeded = Math.floor(rule.maxSets / 2) + 1;
    if (winner < 2 || winner > maxNeeded || loser >= winner) {
      return `As sets, the winner takes 2–${maxNeeded} with fewer for the loser — e.g. 2-0 or ${maxNeeded}-${maxNeeded - 1}.`;
    }
    return null;
  }
  const capped = rule.cap != null && winner === rule.cap;
  const atTarget = winner === rule.target && winner - loser >= rule.winBy;
  const deuce = winner > rule.target && (rule.cap == null || winner < rule.cap) && winner - loser === rule.winBy;
  if (capped || atTarget || deuce) return null;
  return `Not a valid ${sportKey.replace("-", " ")} score: first to ${rule.target}, win by ${rule.winBy}${
    rule.cap ? `, cap ${rule.cap}` : ""
  } — or enter sets won (e.g. 2-0).`;
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: "text-emerald-300 border-emerald-400/40",
  awaiting_payment: "text-amber-300 border-amber-400/40",
  pending: "text-amber-300 border-amber-400/40",
  waitlisted: "text-slate-400 border-slate-500/40",
  rejected: "text-red-400 border-red-400/40",
  withdrawn: "text-slate-500 border-slate-600/40",
};

function offEntryName(entries: OffEntry[], id: string | null): string {
  if (!id) return "TBD";
  const e = entries.find((x) => x.id === id);
  return e ? (e.teamName ?? e.players[0]?.name ?? "—") : "TBD";
}

export default function PlayPortal() {
  const [user, setUser] = useState<TournamentUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState<OpenTournament[]>([]);
  const [entries, setEntries] = useState<MyEntry[]>([]);
  const [officiating, setOfficiating] = useState<OffTournament[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [role, setRole] = useState("registrant");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [rosters, setRosters] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});
  const [matchErrors, setMatchErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [consoleTab, setConsoleTab] = useState<Record<string, ConsoleTab>>({});

  const load = useCallback(async (u: TournamentUser) => {
    try {
      setError(null);
      const [openRes, entriesRes] = await Promise.all([
        tJson<OpenTournament[]>("/tournaments/open"),
        tJson<MyEntry[]>("/tournaments/my-entries"),
      ]);
      setOpen(openRes);
      setEntries(entriesRes);
      if (u.role === "official") setOfficiating(await tJson<OffTournament[]>("/tournaments/officiating"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tournaments.");
    }
  }, []);

  useEffect(() => {
    const session = tournamentSession();
    setUser(session?.user ?? null);
    setChecked(true);
    if (session?.user) load(session.user);
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (user) await load(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAuth() {
    setBusy(true);
    setError(null);
    try {
      const u =
        mode === "login"
          ? await tournamentLogin(email.trim(), password)
          : await tournamentSignup({ name: name.trim(), email: email.trim(), password, role });
      setUser(u);
      await load(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return null;

  const inputCls =
    "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none";

  return (
    <main className="min-h-screen px-4 py-10 md:px-10 max-w-3xl mx-auto text-slate-200">
      <header className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/whistle-logo.png" alt="Whistle" className="mx-auto mb-3 h-14 w-auto" />
        <p className="text-xs uppercase tracking-widest text-amber-400/80">Whistle Tournaments</p>
        <h1 className="text-3xl font-extrabold text-white mt-1">Play or officiate</h1>
        <p className="text-sm text-slate-400 mt-2">
          Open to everyone — no academy account needed. Register for events, pay your entry fee, and follow results.
        </p>
      </header>

      {!user ? (
        <section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-4 flex gap-2">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                  mode === m ? "bg-amber-400 text-slate-900" : "border border-white/15 text-slate-300"
                }`}
              >
                {m === "signup" ? "Create account" : "Login"}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {mode === "signup" && (
              <>
                <div className="flex gap-2">
                  {[
                    { key: "registrant", label: "Player / Team" },
                    { key: "official", label: "Official / Scorer" },
                  ].map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setRole(r.key)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                        role === r.key ? "border-amber-400 text-amber-300" : "border-white/15 text-slate-400"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <input className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              </>
            )}
            <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={inputCls} type="password" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={submitAuth}
              disabled={busy}
              className="w-full rounded-full bg-amber-400 py-2.5 text-sm font-bold text-slate-900 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Login"}
            </button>
            {mode === "signup" && role === "official" && (
              <p className="text-xs text-slate-500">
                After signing up, give the organizer this email — they appoint you, and your scoring console appears here.
              </p>
            )}
            {mode === "login" && (
              <p className="text-xs text-slate-500">
                One login for players and officials — your account remembers the role you chose at signup. Officials see
                their scoring console right after logging in.
              </p>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-white">{user.name}</span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                  user.role === "official"
                    ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                    : user.role === "organizer"
                      ? "border-purple-400/60 bg-purple-400/10 text-purple-300"
                      : "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                }`}
              >
                {user.role === "registrant" ? "player" : user.role}
              </span>
            </p>
            <button
              onClick={() => {
                clearTournamentSession();
                setUser(null);
                setEntries([]);
                setOfficiating([]);
              }}
              className="text-sm text-slate-400 hover:text-white"
            >
              Not you? Log out
            </button>
          </div>

          {user.role === "organizer" && (
            <div className="mb-6 rounded-xl border border-purple-400/30 bg-purple-400/5 px-4 py-3 text-sm text-slate-300">
              You&apos;re logged in with an <span className="font-semibold text-purple-300">organizer</span> account —
              this page is the player &amp; official portal. Create and manage your tournaments from the{" "}
              <a href="/organizer" className="font-semibold text-amber-300 hover:underline">
                Whistle admin console →
              </a>
            </div>
          )}

          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

          {/* Official scoring console */}
          {user.role === "official" && (
            <section className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
                <ClipboardList size={18} className="text-amber-300" /> Your scoring console
              </h2>
              {officiating.length === 0 && (
                <p className="text-sm text-slate-500">
                  No appointments yet — ask the organizer to appoint {user.email} from their manage page.
                </p>
              )}
              {officiating.map((t, ti) => {
                const pending = t.events.flatMap((ev) =>
                  ev.matches.filter((m) => m.status !== "completed" && m.entryAId && m.entryBId)
                ).length;
                const open = expanded[t.id] ?? ti === 0;
                return (
                <div key={t.id} className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04]">
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [t.id]: !open }))}
                    className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03]"
                  >
                    <span className="flex items-center gap-2 font-bold text-white">
                      <span className="text-base">{sportEmoji(t.events[0]?.sportKey)}</span> {t.name}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-slate-400">
                      <span className={pending > 0 ? "rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 font-bold text-amber-300" : ""}>
                        {pending} match{pending === 1 ? "" : "es"} to score
                      </span>
                      <ChevronRight size={16} className={`text-slate-300 transition-transform ${open ? "rotate-90" : ""}`} />
                    </span>
                  </button>
                  {open && (() => {
                    const tab = consoleTab[t.id] ?? "score";
                    const matchEvents = t.events.filter((ev) => ev.discipline === "match");
                    const TABS: { key: ConsoleTab; label: string; Icon: typeof Zap }[] = [
                      { key: "score", label: `Score${pending ? ` (${pending})` : ""}`, Icon: Zap },
                      { key: "fixtures", label: "Fixtures", Icon: CalendarDays },
                      { key: "standings", label: "Standings", Icon: Trophy },
                      { key: "results", label: "Results", Icon: CheckCircle2 },
                    ];
                    return (
                      <div className="px-5 pb-5">
                        {/* Console menu */}
                        <div className="mb-4 flex flex-wrap gap-2 border-b border-white/10 pb-3">
                          {TABS.map((tb) => (
                            <button
                              key={tb.key}
                              onClick={() => setConsoleTab((p) => ({ ...p, [t.id]: tb.key }))}
                              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                                tab === tb.key
                                  ? "bg-amber-400 text-slate-900"
                                  : "border border-white/15 text-slate-300 hover:border-amber-400/50"
                              }`}
                            >
                              <tb.Icon size={13} /> {tb.label}
                            </button>
                          ))}
                        </div>

                        {/* SCORE — scoreboard cards for matches awaiting a result */}
                        {tab === "score" &&
                          matchEvents.map((ev) => {
                            const toScore = ev.matches.filter((m) => m.status !== "completed" && m.entryAId && m.entryBId);
                            if (!toScore.length) return null;
                            return (
                              <div key={ev.id} className="mb-5">
                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{ev.name}</p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  {toScore.map((m) => {
                                    const s = scores[m.id] ?? { a: String(m.scoreA), b: String(m.scoreB) };
                                    // Cricket uses the full ball-by-ball console, not number boxes.
                                    if (ev.sportKey === "cricket") {
                                      return (
                                        <a
                                          key={m.id}
                                          href={`/score/cricket/${m.id}`}
                                          className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 hover:border-emerald-400/60"
                                        >
                                          <span>
                                            <span className="block text-[11px] text-slate-500">
                                              Round {m.round} · Match {m.matchNo}
                                              {m.venue ? ` · ${m.venue}` : ""}
                                            </span>
                                            <span className="text-sm font-semibold text-white">
                                              {offEntryName(ev.entries, m.entryAId)} vs {offEntryName(ev.entries, m.entryBId)}
                                            </span>
                                          </span>
                                          <span className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-900">
                                            🏏 Ball-by-ball →
                                          </span>
                                        </a>
                                      );
                                    }
                                    return (
                                      <div key={m.id} className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
                                        <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
                                          <span>
                                            Round {m.round} · Match {m.matchNo}
                                            {m.venue ? ` · ${m.venue}` : ""}
                                          </span>
                                          {m.status === "live" && (
                                            <span className="animate-pulse font-bold text-red-400">● LIVE</span>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                          <p className="truncate text-sm font-semibold text-white">
                                            {offEntryName(ev.entries, m.entryAId)}
                                          </p>
                                          <span className="text-xs text-slate-600">vs</span>
                                          <p className="truncate text-right text-sm font-semibold text-white">
                                            {offEntryName(ev.entries, m.entryBId)}
                                          </p>
                                          <input
                                            type="number"
                                            value={s.a}
                                            onChange={(e) => setScores((p) => ({ ...p, [m.id]: { ...s, a: e.target.value } }))}
                                            className="h-12 w-full rounded-lg border border-white/15 bg-white/5 text-center text-2xl font-extrabold text-amber-300 focus:border-amber-400 focus:outline-none"
                                          />
                                          <span className="text-center text-lg font-bold text-slate-600">:</span>
                                          <input
                                            type="number"
                                            value={s.b}
                                            onChange={(e) => setScores((p) => ({ ...p, [m.id]: { ...s, b: e.target.value } }))}
                                            className="h-12 w-full rounded-lg border border-white/15 bg-white/5 text-center text-2xl font-extrabold text-amber-300 focus:border-amber-400 focus:outline-none"
                                          />
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                          <button
                                            disabled={busy}
                                            onClick={() =>
                                              act(() =>
                                                tJson(`/tournaments/matches/${m.id}/score`, {
                                                  method: "POST",
                                                  body: JSON.stringify({ scoreA: Number(s.a) || 0, scoreB: Number(s.b) || 0, final: false }),
                                                })
                                              )
                                            }
                                            className="flex-1 rounded-lg border border-amber-400/60 py-2 text-xs font-bold text-amber-300 hover:bg-amber-400/10"
                                          >
                                            Update live
                                          </button>
                                          <button
                                            disabled={busy}
                                            onClick={() => {
                                              const a = Number(s.a) || 0;
                                              const b = Number(s.b) || 0;
                                              const invalid = validateFinalScore(ev.sportKey, a, b);
                                              if (invalid) {
                                                setMatchErrors((p) => ({ ...p, [m.id]: invalid }));
                                                return;
                                              }
                                              setMatchErrors((p) => {
                                                const next = { ...p };
                                                delete next[m.id];
                                                return next;
                                              });
                                              act(() =>
                                                tJson(`/tournaments/matches/${m.id}/score`, {
                                                  method: "POST",
                                                  body: JSON.stringify({ scoreA: a, scoreB: b, final: true }),
                                                })
                                              );
                                            }}
                                            className="flex-1 rounded-lg bg-amber-400 py-2 text-xs font-bold text-slate-900 hover:opacity-90"
                                          >
                                            Confirm final
                                          </button>
                                        </div>
                                        {matchErrors[m.id] && (
                                          <p className="mt-2 text-xs text-red-400">⚠ {matchErrors[m.id]}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        {tab === "score" && pending === 0 && (
                          <p className="text-sm text-slate-500">All caught up — no matches waiting for a score. 🎉</p>
                        )}

                        {/* FIXTURES — full schedule by round */}
                        {tab === "fixtures" &&
                          matchEvents.map((ev) => (
                            <div key={ev.id} className="mb-5">
                              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{ev.name}</p>
                              <div className="overflow-hidden rounded-xl border border-white/10">
                                {ev.matches.map((m, i) => (
                                  <div
                                    key={m.id}
                                    className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i % 2 ? "bg-white/[0.02]" : ""}`}
                                  >
                                    <span className="w-8 shrink-0 text-xs font-bold text-slate-500">R{m.round}</span>
                                    <span className="flex-1 truncate text-slate-200">
                                      {offEntryName(ev.entries, m.entryAId)}{" "}
                                      <span className="text-slate-600">vs</span> {offEntryName(ev.entries, m.entryBId)}
                                    </span>
                                    <span className="hidden text-xs text-slate-500 sm:inline">{m.venue ?? ""}</span>
                                    <span
                                      className={`w-20 shrink-0 text-right text-xs font-bold ${
                                        m.status === "live"
                                          ? "text-red-400"
                                          : m.status === "completed"
                                            ? "text-slate-500"
                                            : "text-emerald-300"
                                      }`}
                                    >
                                      {m.status === "completed" ? `${m.scoreA}–${m.scoreB}` : m.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}

                        {/* STANDINGS — points tables for league/round-robin events */}
                        {tab === "standings" &&
                          (matchEvents.some((ev) => (ev.standings?.length ?? 0) > 0 && ev.format !== "single_elim") ? (
                            matchEvents
                              .filter((ev) => (ev.standings?.length ?? 0) > 0 && ev.format !== "single_elim")
                              .map((ev) => (
                                <div key={ev.id} className="mb-5">
                                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{ev.name}</p>
                                  <div className="overflow-x-auto rounded-xl border border-white/10">
                                    <table className="w-full min-w-[420px] text-sm">
                                      <thead>
                                        <tr className="border-b border-white/10 bg-white/[0.06] text-left text-xs uppercase text-slate-400">
                                          <th className="px-3 py-2 w-10">#</th>
                                          <th className="px-3 py-2">{ev.kind === "team" ? "Team" : "Player"}</th>
                                          <th className="px-3 py-2 text-center">P</th>
                                          <th className="px-3 py-2 text-center">W</th>
                                          <th className="px-3 py-2 text-center">L</th>
                                          <th className="px-3 py-2 text-center">+/−</th>
                                          <th className="px-3 py-2 text-center">Pts</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ev.standings!.map((row, i) => {
                                          const diff = row.scoreFor - row.scoreAgainst;
                                          return (
                                            <tr key={row.entryId} className={`border-b border-white/5 last:border-0 ${i === 0 ? "bg-amber-400/10" : ""}`}>
                                              <td className="px-3 py-2 text-slate-400">{RANK_MEDALS[i] ?? i + 1}</td>
                                              <td className={`px-3 py-2 ${i === 0 ? "font-bold text-amber-300" : "text-slate-200"}`}>{row.name}</td>
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
                              ))
                          ) : (
                            <p className="text-sm text-slate-500">
                              No points tables here — knockout brackets live under Fixtures and Results.
                            </p>
                          ))}

                        {/* RESULTS — completed matches */}
                        {tab === "results" &&
                          (matchEvents.some((ev) => ev.matches.some((m) => m.status === "completed")) ? (
                            matchEvents.map((ev) => {
                              const done = ev.matches.filter((m) => m.status === "completed");
                              if (!done.length) return null;
                              return (
                                <div key={ev.id} className="mb-5">
                                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{ev.name}</p>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {done.map((m) => (
                                      <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                                        <p className="mb-1 text-[11px] text-slate-500">
                                          Round {m.round}
                                          {m.venue ? ` · ${m.venue}` : ""}
                                        </p>
                                        <p>
                                          <span className={m.winnerEntryId === m.entryAId ? "font-bold text-amber-300" : "text-slate-300"}>
                                            {m.winnerEntryId === m.entryAId ? "🏆 " : ""}
                                            {offEntryName(ev.entries, m.entryAId)}
                                          </span>
                                          <span className="mx-2 font-mono font-bold text-white">
                                            {m.scoreDisplay === "bye" ? "bye" : `${m.scoreA}–${m.scoreB}`}
                                          </span>
                                          <span className={m.winnerEntryId === m.entryBId ? "font-bold text-amber-300" : "text-slate-300"}>
                                            {offEntryName(ev.entries, m.entryBId)}
                                            {m.winnerEntryId === m.entryBId ? " 🏆" : ""}
                                          </span>
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-slate-500">No completed matches yet.</p>
                          ))}
                      </div>
                    );
                  })()}
                </div>
                );
              })}
            </section>
          )}

          {/* My entries */}
          {entries.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
                <Ticket size={18} className="text-amber-300" /> My entries
              </h2>
              {entries.map((e) => (
                <div key={e.id} className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {e.event.name}
                      {e.teamName ? ` — ${e.teamName}` : ""}
                    </p>
                    <p className="text-xs text-slate-400">
                      {e.event.tournament.name} ·{" "}
                      <a href={`/t/${e.event.tournament.publicSlug}`} className="text-amber-300 hover:underline">
                        view results
                      </a>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs ${STATUS_COLOR[e.status] ?? "text-slate-400 border-slate-500/40"}`}>
                      {e.status.replace("_", " ")}
                    </span>
                    {e.status === "awaiting_payment" && (
                      <button
                        disabled={busy}
                        onClick={() => act(() => tJson(`/tournaments/entries/${e.id}/pay`, { method: "POST" }))}
                        className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-bold text-slate-900"
                      >
                        Pay ₹{e.event.entryFee ?? 0}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Open tournaments */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <Megaphone size={18} className="text-amber-300" /> Open for registration
            </h2>
            {open.length === 0 && <p className="text-sm text-slate-500">Nothing open right now — check back soon.</p>}
            {open.map((t) => (
              <div key={t.id} className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-bold text-white">
                    <span className="text-base">{sportEmoji(t.sports[0])}</span> {t.name}
                  </h3>
                  <a href={`/t/${t.publicSlug}`} className="text-xs text-amber-300 hover:underline">
                    public page ↗
                  </a>
                </div>
                <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span>{t.organizer.organizationName ?? t.organizer.name}</span>
                  <span className="flex items-center gap-1">
                    <CalendarDays size={12} /> {new Date(t.startDate).toLocaleDateString()}
                  </span>
                  <span>{t.sports.map((s) => `${sportEmoji(s)} ${s}`).join("  ")}</span>
                </p>
                {t.events.map((ev) => {
                  const already = entries.some(
                    (en) => en.event.id === ev.id && !["withdrawn", "rejected"].includes(en.status)
                  );
                  return (
                    <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 py-2">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                          {ev.name}
                          {ev.duprRated && (
                            <span className="rounded-full border border-amber-400/60 bg-amber-400/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                              DUPR rated
                            </span>
                          )}
                        </p>
                        <p className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="capitalize">{ev.kind}</span>
                          <span className="flex items-center gap-1">
                            <Users size={12} /> {ev._count.entries} entered
                          </span>
                          <span className="flex items-center gap-1">
                            <Wallet size={12} /> {ev.entryFee ? `₹${ev.entryFee}` : "free entry"}
                          </span>
                        </p>
                      </div>
                      {user.role !== "official" &&
                        (already ? (
                          <span className="text-xs text-emerald-300">✓ entered</span>
                        ) : (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {ev.kind === "team" && (
                              <div className="flex flex-col gap-1.5">
                                <input
                                  className="w-52 rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                                  placeholder="Team / pair name *"
                                  value={teamNames[ev.id] ?? ""}
                                  onChange={(e) => setTeamNames((p) => ({ ...p, [ev.id]: e.target.value }))}
                                />
                                <input
                                  className="w-52 rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                                  placeholder="Players, comma separated (optional)"
                                  value={rosters[ev.id] ?? ""}
                                  onChange={(e) => setRosters((p) => ({ ...p, [ev.id]: e.target.value }))}
                                />
                              </div>
                            )}
                            <button
                              disabled={busy || (ev.kind === "team" && !(teamNames[ev.id] ?? "").trim())}
                              onClick={() => {
                                const roster = (rosters[ev.id] ?? "")
                                  .split(",")
                                  .map((n) => n.trim())
                                  .filter(Boolean)
                                  .map((n) => ({ name: n }));
                                act(() =>
                                  tJson(`/tournaments/events/${ev.id}/register`, {
                                    method: "POST",
                                    body: JSON.stringify({
                                      teamName: ev.kind === "team" ? teamNames[ev.id].trim() : undefined,
                                      players: roster.length ? roster : [{ name: user.name }],
                                    }),
                                  })
                                );
                              }}
                              className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-bold text-slate-900 disabled:opacity-40"
                            >
                              Register
                            </button>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        </>
      )}

      <footer className="mt-10 text-center text-xs text-slate-600">
        Powered by Whistle · organizers manage tournaments from the Whistle admin panel
      </footer>
    </main>
  );
}
