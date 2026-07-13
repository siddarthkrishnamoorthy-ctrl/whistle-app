"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ScrollText, Upload, UserCheck, Wallet } from "lucide-react";
import { Card, EmptyState, PrimaryButton, OutlineButton, StatusPill } from "@/components/ui";
import { tJson, tournamentSession } from "@/lib/tournament-client";
import { RANK_MEDALS, sportEmoji } from "@/lib/sport-icons";

interface Entry {
  id: string;
  teamName: string | null;
  players: { name: string }[];
  status: string;
  seed: number | null;
}

interface Match {
  id: string;
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
  stage?: string;
  groupNo?: number | null;
  roundLabel?: string | null;
}

interface TEvent {
  id: string;
  name: string;
  kind: string;
  sportKey: string;
  discipline: string;
  format: string;
  unit: string;
  groupCount?: number;
  playoffMode?: string;
  duprRated: boolean;
  entryFee: string | null;
  entries: Entry[];
  matches: Match[];
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
  heatRanking?: { rank: number; entryId: string; name: string; value: number; unit: string; heat: number }[];
  finalRanking?: { rank: number; entryId: string; name: string; value: number; unit: string }[];
}

interface TDetail {
  id: string;
  name: string;
  status: string;
  publicSlug: string;
  startDate: string;
  venues: string[];
  rules: string | null;
  series: string;
  events: TEvent[];
  officials: { user: { name: string; email: string } }[];
}

interface PaySummary {
  collected: number;
  platformFeePct: number;
  platformFee: number;
  netPayable: number;
  paidEntries: number;
}

function entryName(entries: Entry[], id: string | null): string {
  if (!id) return "TBD";
  const e = entries.find((x) => x.id === id);
  return e ? (e.teamName ?? e.players[0]?.name ?? "—") : "TBD";
}

// Accepts a pasted/typed list (one name per line, or commas) or a .csv/.txt
// file. For CSV rows only the first cell is the name; a header row like
// "Name, Phone" is skipped automatically.
function parseNameList(text: string): string[] {
  const names = text
    .split(/\r?\n/)
    .flatMap((line) => (line.includes(",") && !line.match(/^[^,]+,\s*$/) ? [line.split(/[,;\t]/)[0]] : line.split(/[;\t]/)))
    .map((n) => n.replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);
  if (names.length && /^(name|player|team|participant)s?$/i.test(names[0])) names.shift();
  return [...new Set(names)];
}

const ENTRY_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  confirmed: "success",
  awaiting_payment: "warning",
  pending: "warning",
  waitlisted: "neutral",
  rejected: "danger",
  withdrawn: "neutral",
};

export default function ManageTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<TDetail | null>(null);
  const [pay, setPay] = useState<PaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quickNames, setQuickNames] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});
  const [times, setTimes] = useState<Record<string, string>>({});
  const [phaseByEvent, setPhaseByEvent] = useState<Record<string, "heat" | "final">>({});
  // Each event manages entries, fixtures, scoring and standings — collapsed
  // by default (first event open) so multi-event tournaments stay scannable.
  const [openEvents, setOpenEvents] = useState<Record<string, boolean>>({});
  // Per-match scheduling editor state (datetime-local + court).
  const [schedOpen, setSchedOpen] = useState<Record<string, boolean>>({});
  const [sched, setSched] = useState<Record<string, { at: string; venue: string }>>({});
  const [officialEmail, setOfficialEmail] = useState("");
  const [rulesDraft, setRulesDraft] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setDetail(await tJson<TDetail>(`/tournaments/${id}`));
      setPay(await tJson<PaySummary>(`/tournaments/${id}/payment-summary`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tournament.");
    }
  }, [id]);

  useEffect(() => {
    if (!tournamentSession()) {
      router.replace("/organizer");
      return;
    }
    load();
  }, [load, router]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return <Card className="text-sm text-text-secondary">{error ?? "Loading…"}</Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={detail.series === "lbl" ? "/organizer?series=lbl" : "/organizer"}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            ← {detail.series === "lbl" ? "LBL - Tournaments" : "Whistle - Tournaments"}
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{detail.name}</h1>
          <p className="text-sm text-text-secondary">
            {new Date(detail.startDate).toLocaleDateString()} · {detail.venues.join(", ") || "venue TBA"} ·{" "}
            <a href={`/t/${detail.publicSlug}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              public page ↗
            </a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill tone={detail.status === "draft" ? "neutral" : "success"}>{detail.status.replace("_", " ")}</StatusPill>
          {detail.status === "draft" && (
            <PrimaryButton onClick={() => act(() => tJson(`/tournaments/${id}/publish`, { method: "POST" }))} disabled={busy}>
              Open Registration
            </PrimaryButton>
          )}
        </div>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      <div className="grid grid-cols-2 gap-4">
        {/* Payments (BRD 6.7) */}
        {pay && (
          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <Wallet size={16} className="text-accent" /> Payments
            </h2>
            <dl className="space-y-1 text-sm">
              {[
                ["Collected", `₹${pay.collected}`],
                [`Platform fee (${pay.platformFeePct}%)`, `-₹${pay.platformFee}`],
                ["Net payable to you", `₹${pay.netPayable}`],
                ["Paid entries", String(pay.paidEntries)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-text-secondary">{label}</dt>
                  <dd className="font-medium text-text-primary">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {/* Officials */}
        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <UserCheck size={16} className="text-accent" /> Officials
          </h2>
          {detail.officials.length === 0 && (
            <p className="mb-2 text-sm text-text-secondary">No officials yet — they can score all matches.</p>
          )}
          <ul className="mb-3 space-y-1 text-sm">
            {detail.officials.map((o) => (
              <li key={o.user.email} className="text-text-primary">
                {o.user.name} <span className="text-text-secondary">({o.user.email})</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={officialEmail}
              onChange={(e) => setOfficialEmail(e.target.value)}
              placeholder="official's tournament-account email"
              className="flex-1 rounded-md border border-border bg-surface-alt px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
            <OutlineButton
              disabled={busy || !officialEmail.trim()}
              onClick={() =>
                act(async () => {
                  await tJson(`/tournaments/${id}/officials`, {
                    method: "POST",
                    body: JSON.stringify({ email: officialEmail.trim() }),
                  });
                  setOfficialEmail("");
                })
              }
            >
              Appoint
            </OutlineButton>
          </div>
        </Card>
      </div>

      {/* Rules & regulations — editable any time, shown on the public page */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <ScrollText size={16} className="text-accent" /> Rules &amp; regulations
          </h2>
          <span className="text-xs text-text-secondary">shown on the public page</span>
        </div>
        <textarea
          value={rulesDraft ?? detail.rules ?? ""}
          onChange={(e) => setRulesDraft(e.target.value)}
          rows={5}
          placeholder={"e.g.\n• Matches are best of 3 games to 11, win by 2\n• 5-minute walkover if a player is absent\n• Referee's decision is final\n• No refunds after fixtures are published"}
          className="w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
        />
        <div className="mt-2">
          <OutlineButton
            disabled={busy || rulesDraft === null || rulesDraft === (detail.rules ?? "")}
            onClick={() =>
              act(async () => {
                await tJson(`/tournaments/${id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ rules: rulesDraft }),
                });
                setRulesDraft(null);
              })
            }
          >
            Save rules
          </OutlineButton>
        </div>
      </Card>

      {detail.events.map((ev, evIdx) => {
        const confirmed = ev.entries.filter((e) => e.status === "confirmed");
        const phase = phaseByEvent[ev.id] ?? "heat";
        const open = openEvents[ev.id] ?? evIdx === 0;
        return (
          <Card key={ev.id} className="space-y-4">
            <button
              type="button"
              onClick={() => setOpenEvents((p) => ({ ...p, [ev.id]: !open }))}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span>{sportEmoji(ev.sportKey)}</span>
                  {ev.name}
                  {ev.duprRated && (
                    <span className="rounded-full border border-accent/60 bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">
                      DUPR rated
                    </span>
                  )}
                </h2>
                <p className="text-xs text-text-secondary">
                  {ev.kind} · {ev.discipline === "timed" ? `timed (${ev.unit})` : ev.format.replace("_", " ")} ·{" "}
                  {ev.entries.length} entries ({confirmed.length} confirmed) · {ev.matches.length} matches
                  {ev.entryFee ? ` · entry ₹${ev.entryFee}` : " · free"}
                </p>
              </div>
              <span className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
            </button>

            {open && (
            <>
            {/* Entries + quick add */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Entries ({ev.entries.length})</h3>
              {ev.entries.length === 0 && <EmptyState message="No entries yet." />}
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
                {ev.entries.map((en) => (
                  <li key={en.id} className="flex items-center justify-between text-sm">
                    <span className="text-text-primary">
                      {en.seed ? `[${en.seed}] ` : ""}
                      {en.teamName ?? en.players[0]?.name ?? "—"}
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusPill tone={ENTRY_TONE[en.status] ?? "neutral"}>{en.status.replace("_", " ")}</StatusPill>
                      {en.status === "pending" && (
                        <button
                          className="text-xs font-semibold text-accent hover:underline"
                          onClick={() =>
                            act(() =>
                              tJson(`/tournaments/entries/${en.id}/approve`, {
                                method: "POST",
                                body: JSON.stringify({ approve: true }),
                              })
                            )
                          }
                        >
                          Approve
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {/* Add participants: type/paste a list, or upload a .csv/.txt file */}
              <div className="mt-3 rounded-lg border border-border bg-surface-alt/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Add {ev.kind === "team" ? "teams" : "players"}
                  </span>
                  <label className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-accent hover:underline">
                    <Upload className="h-3.5 w-3.5" strokeWidth={2} /> Upload list (.csv / .txt)
                    <input
                      type="file"
                      accept=".csv,.txt,.tsv,text/csv,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const names = parseNameList(String(reader.result ?? ""));
                          setQuickNames((p) => ({
                            ...p,
                            [ev.id]: [(p[ev.id] ?? "").trim(), names.join("\n")].filter(Boolean).join("\n"),
                          }));
                        };
                        reader.readAsText(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <textarea
                  value={quickNames[ev.id] ?? ""}
                  onChange={(e) => setQuickNames((p) => ({ ...p, [ev.id]: e.target.value }))}
                  rows={3}
                  placeholder={"Write one name per line (or comma separated):\nRahul S\nPriya M, Anil K"}
                  className="w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    {parseNameList(quickNames[ev.id] ?? "").length} {ev.kind === "team" ? "teams" : "players"} ready — added as
                    confirmed entries
                  </span>
                  <OutlineButton
                    disabled={busy || parseNameList(quickNames[ev.id] ?? "").length === 0}
                    onClick={() => {
                      const names = parseNameList(quickNames[ev.id] ?? "");
                      if (!names.length) return;
                      act(async () => {
                        await tJson(`/tournaments/events/${ev.id}/quick-entries`, {
                          method: "POST",
                          body: JSON.stringify({ names }),
                        });
                        setQuickNames((p) => ({ ...p, [ev.id]: "" }));
                      });
                    }}
                  >
                    Add all
                  </OutlineButton>
                </div>
              </div>
            </div>

            {/* Match events */}
            {ev.discipline === "match" &&
              (ev.matches.length === 0 ? (
                <PrimaryButton
                  disabled={busy || confirmed.length < 2}
                  onClick={() => act(() => tJson(`/tournaments/events/${ev.id}/fixtures`, { method: "POST", body: JSON.stringify({}) }))}
                >
                  {busy ? "Working…" : `Generate Fixtures (${confirmed.length} entries)`}
                </PrimaryButton>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Matches</h3>
                    {/* The organizer's post-league confirmation: once every
                        group match is done, build the configured bracket. */}
                    {(ev.format === "round_robin" || ev.format === "league") &&
                      (ev.playoffMode ?? "none") !== "none" &&
                      !ev.matches.some((m) => m.stage === "playoff") && (
                        <OutlineButton
                          className="w-auto px-4 py-1.5 text-xs"
                          disabled={busy || ev.matches.some((m) => m.status !== "completed")}
                          title={
                            ev.matches.some((m) => m.status !== "completed")
                              ? "Available once every league match is completed"
                              : undefined
                          }
                          onClick={() => act(() => tJson(`/tournaments/events/${ev.id}/playoffs`, { method: "POST", body: "{}" }))}
                        >
                          🏆 Proceed to{" "}
                          {ev.playoffMode === "final" ? "the Final" : ev.playoffMode === "semis" ? "Semi-finals" : "Quarter-finals"}
                        </OutlineButton>
                      )}
                  </div>
                  <div className="divide-y divide-border">
                    {ev.matches.map((m) => {
                      const s = scores[m.id] ?? { a: String(m.scoreA), b: String(m.scoreB) };
                      const canScore = m.status !== "completed" && m.entryAId && m.entryBId;
                      const when = (m as { scheduledAt?: string | null }).scheduledAt;
                      const whenLabel = when
                        ? new Date(when).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                        : null;
                      const editor = sched[m.id] ?? {
                        at: when ? new Date(new Date(when).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
                        venue: m.venue ?? "",
                      };
                      return (
                        <div key={m.id}>
                        <div className="flex flex-wrap items-center gap-3 py-2 text-sm">
                          <span className="w-28 text-xs text-text-secondary">
                            {m.stage === "playoff" ? (
                              <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-accent">
                                🏆 {m.roundLabel ?? "Playoff"}
                              </span>
                            ) : m.groupNo ? (
                              <>
                                Grp {String.fromCharCode(64 + m.groupNo)} · M{m.matchNo}
                              </>
                            ) : (
                              <>
                                R{m.round} · M{m.matchNo}
                              </>
                            )}
                          </span>
                          <span className="min-w-[220px] flex-1 font-medium text-text-primary">
                            {entryName(ev.entries, m.entryAId)} vs {entryName(ev.entries, m.entryBId)}
                          </span>
                          {/* Schedule chip — organizer staggers times & courts per match */}
                          {m.status !== "completed" ? (
                            <button
                              type="button"
                              onClick={() => setSchedOpen((p) => ({ ...p, [m.id]: !p[m.id] }))}
                              className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary transition hover:border-accent/60 hover:text-text-primary"
                              title="Set match time & court"
                            >
                              🕒 {whenLabel ?? "Set time"}
                              {m.venue ? ` · ${m.venue}` : ""}
                            </button>
                          ) : (
                            <span className="text-xs text-text-secondary">
                              {whenLabel ?? ""}
                              {m.venue ? `${whenLabel ? " · " : ""}${m.venue}` : whenLabel ? "" : "—"}
                            </span>
                          )}
                          {m.status === "completed" ? (
                            <span className="text-accent">
                              {m.scoreDisplay === "bye"
                                ? "Bye — auto-advanced"
                                : ev.sportKey === "cricket" && m.scoreDisplay
                                  ? m.scoreDisplay
                                  : `${m.scoreA}–${m.scoreB} · ${entryName(ev.entries, m.winnerEntryId)} wins`}
                            </span>
                          ) : ev.sportKey === "cricket" && canScore ? (
                            <a
                              href={`/score/cricket/${m.id}`}
                              className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-text hover:opacity-90"
                            >
                              🏏 Ball-by-ball scoring →
                            </a>
                          ) : canScore ? (
                            <span className="flex items-center gap-2">
                              {m.status === "live" && <StatusPill tone="warning">live</StatusPill>}
                              {(["a", "b"] as const).map((side) => (
                                <input
                                  key={side}
                                  type="number"
                                  value={s[side]}
                                  onChange={(e) => setScores((p) => ({ ...p, [m.id]: { ...s, [side]: e.target.value } }))}
                                  className="w-14 rounded-md border border-border bg-surface-alt px-2 py-1 text-center text-sm text-text-primary focus:border-accent focus:outline-none"
                                />
                              ))}
                              <OutlineButton
                                disabled={busy}
                                onClick={() =>
                                  act(() =>
                                    tJson(`/tournaments/matches/${m.id}/score`, {
                                      method: "POST",
                                      body: JSON.stringify({ scoreA: Number(s.a) || 0, scoreB: Number(s.b) || 0, final: false }),
                                    })
                                  )
                                }
                              >
                                Live
                              </OutlineButton>
                              <PrimaryButton
                                disabled={busy}
                                onClick={() =>
                                  act(() =>
                                    tJson(`/tournaments/matches/${m.id}/score`, {
                                      method: "POST",
                                      body: JSON.stringify({ scoreA: Number(s.a) || 0, scoreB: Number(s.b) || 0, final: true }),
                                    })
                                  )
                                }
                              >
                                Final
                              </PrimaryButton>
                            </span>
                          ) : (
                            <span className="text-xs text-text-secondary">waiting for both slots</span>
                          )}
                        </div>
                        {schedOpen[m.id] && m.status !== "completed" && (
                          <div className="mb-2 ml-20 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-alt/50 px-3 py-2">
                            <input
                              type="datetime-local"
                              value={editor.at}
                              onChange={(e) => setSched((p) => ({ ...p, [m.id]: { ...editor, at: e.target.value } }))}
                              className="rounded-md border border-border bg-surface-alt px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                            />
                            <input
                              value={editor.venue}
                              onChange={(e) => setSched((p) => ({ ...p, [m.id]: { ...editor, venue: e.target.value } }))}
                              placeholder="Court / ground"
                              className="w-32 rounded-md border border-border bg-surface-alt px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                            />
                            <OutlineButton
                              disabled={busy || (!editor.at && !editor.venue.trim())}
                              className="!px-3 !py-1 text-xs"
                              onClick={() =>
                                act(async () => {
                                  await tJson(`/tournaments/matches/${m.id}/schedule`, {
                                    method: "POST",
                                    body: JSON.stringify({
                                      ...(editor.at ? { scheduledAt: new Date(editor.at).toISOString() } : {}),
                                      venue: editor.venue.trim() || undefined,
                                    }),
                                  });
                                  setSchedOpen((p) => ({ ...p, [m.id]: false }));
                                })
                              }
                            >
                              Save
                            </OutlineButton>
                          </div>
                        )}
                        </div>
                      );
                    })}
                  </div>
                  {(ev.format === "round_robin" || ev.format === "league") && (ev.standings?.length ?? 0) > 0 && (
                    <div className="mt-4">
                      <h3 className="mb-2 text-sm font-semibold">Points table</h3>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full min-w-[420px] text-sm">
                          <thead>
                            <tr className="border-b border-border bg-surface-alt/60 text-left text-xs uppercase tracking-wide text-text-secondary">
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
                                <tr
                                  key={row.entryId}
                                  className={`border-b border-border/50 last:border-0 ${i === 0 ? "bg-accent/10" : ""}`}
                                >
                                  <td className="px-3 py-2">
                                    {RANK_MEDALS[i] ? (
                                      <span className="text-base">{RANK_MEDALS[i]}</span>
                                    ) : (
                                      <span className="text-text-secondary">{i + 1}</span>
                                    )}
                                  </td>
                                  <td className={`px-3 py-2 ${i === 0 ? "font-semibold text-accent" : "font-medium text-text-primary"}`}>
                                    {row.name}
                                  </td>
                                  <td className="px-3 py-2 text-center text-text-secondary">{row.played}</td>
                                  <td className="px-3 py-2 text-center text-text-primary">{row.won}</td>
                                  <td className="px-3 py-2 text-center text-text-secondary">{row.lost}</td>
                                  <td className={`px-3 py-2 text-center ${diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-text-secondary"}`}>
                                    {diff > 0 ? `+${diff}` : diff}
                                  </td>
                                  <td className="px-3 py-2 text-center font-bold text-text-primary">{row.points}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}

            {/* Timed events */}
            {ev.discipline === "timed" && (
              <div>
                <div className="mb-2 flex gap-2">
                  {(["heat", "final"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPhaseByEvent((prev) => ({ ...prev, [ev.id]: p }))}
                      className={`rounded-full px-4 py-1 text-xs font-semibold ${
                        phase === p ? "bg-accent text-accent-text" : "border border-border text-text-secondary"
                      }`}
                    >
                      {p === "heat" ? "Heats" : "Final"}
                    </button>
                  ))}
                </div>
                <h3 className="mb-2 text-sm font-semibold">
                  Record {phase} results ({ev.unit})
                </h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  {confirmed.map((en) => {
                    const key = `${ev.id}:${en.id}:${phase}`;
                    return (
                      <div key={en.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-text-primary">{en.teamName ?? en.players[0]?.name ?? "—"}</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder={ev.unit === "sec" ? "12.34" : "5.20"}
                          value={times[key] ?? ""}
                          onChange={(e) => setTimes((p) => ({ ...p, [key]: e.target.value }))}
                          className="w-24 rounded-md border border-border bg-surface-alt px-2 py-1 text-center text-sm text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <PrimaryButton
                    disabled={busy}
                    onClick={() => {
                      const results = confirmed
                        .map((en) => ({ entryId: en.id, value: Number(times[`${ev.id}:${en.id}:${phase}`]) }))
                        .filter((r) => times[`${ev.id}:${r.entryId}:${phase}`] && !Number.isNaN(r.value));
                      if (!results.length) return;
                      act(() =>
                        tJson(`/tournaments/events/${ev.id}/timed-results`, {
                          method: "POST",
                          body: JSON.stringify({ results: results.map((r) => ({ ...r, phase })) }),
                        })
                      );
                    }}
                  >
                    Save {phase} results
                  </PrimaryButton>
                </div>
                {(phase === "heat" ? ev.heatRanking : ev.finalRanking)?.length ? (
                  <div className="mt-4">
                    <h3 className="mb-1 text-sm font-semibold">{phase === "heat" ? "Heat ranking" : "Final result"}</h3>
                    <ol className="space-y-0.5 text-sm">
                      {(phase === "heat" ? ev.heatRanking! : ev.finalRanking!).map((r) => (
                        <li key={r.entryId} className="flex justify-between">
                          <span className={phase === "final" && r.rank <= 3 ? "font-semibold text-accent" : "text-text-primary"}>
                            {r.rank}. {r.name}
                          </span>
                          <span className="font-mono text-text-secondary">
                            {r.value} {r.unit}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            )}
            </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
