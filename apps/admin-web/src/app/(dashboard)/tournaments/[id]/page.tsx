"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, EmptyState, PrimaryButton, OutlineButton, StatusPill } from "@/components/ui";
import { tJson, tournamentSession } from "@/lib/tournament-client";

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
}

interface TEvent {
  id: string;
  name: string;
  kind: string;
  discipline: string;
  format: string;
  unit: string;
  entryFee: string | null;
  entries: Entry[];
  matches: Match[];
  standings?: { entryId: string; name: string; won: number; lost: number; points: number }[];
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
  const [officialEmail, setOfficialEmail] = useState("");

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
      router.replace("/tournaments");
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
          <Link href="/tournaments" className="text-sm text-text-secondary hover:text-text-primary">
            ← All tournaments
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
            <h2 className="mb-2 font-semibold">Payments</h2>
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
          <h2 className="mb-2 font-semibold">Officials</h2>
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

      {detail.events.map((ev) => {
        const confirmed = ev.entries.filter((e) => e.status === "confirmed");
        const phase = phaseByEvent[ev.id] ?? "heat";
        return (
          <Card key={ev.id} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{ev.name}</h2>
              <p className="text-xs text-text-secondary">
                {ev.kind} · {ev.discipline === "timed" ? `timed (${ev.unit})` : ev.format.replace("_", " ")} ·{" "}
                {confirmed.length} confirmed{ev.entryFee ? ` · entry ₹${ev.entryFee}` : " · free"}
              </p>
            </div>

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
              <div className="mt-3 flex gap-2">
                <input
                  value={quickNames[ev.id] ?? ""}
                  onChange={(e) => setQuickNames((p) => ({ ...p, [ev.id]: e.target.value }))}
                  placeholder="Quick add (comma separated): name1, name2, …"
                  className="flex-1 rounded-md border border-border bg-surface-alt px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
                <OutlineButton
                  disabled={busy}
                  onClick={() => {
                    const names = (quickNames[ev.id] ?? "").split(",").map((n) => n.trim()).filter(Boolean);
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
                  Add
                </OutlineButton>
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
                  <h3 className="mb-2 text-sm font-semibold">Matches</h3>
                  <div className="divide-y divide-border">
                    {ev.matches.map((m) => {
                      const s = scores[m.id] ?? { a: String(m.scoreA), b: String(m.scoreB) };
                      const canScore = m.status !== "completed" && m.entryAId && m.entryBId;
                      return (
                        <div key={m.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                          <span className="w-20 text-xs text-text-secondary">
                            R{m.round} · M{m.matchNo}
                          </span>
                          <span className="min-w-[220px] flex-1 font-medium text-text-primary">
                            {entryName(ev.entries, m.entryAId)} vs {entryName(ev.entries, m.entryBId)}
                          </span>
                          <span className="w-24 text-xs text-text-secondary">{m.venue ?? "—"}</span>
                          {m.status === "completed" ? (
                            <span className="text-accent">
                              {m.scoreDisplay === "bye"
                                ? "Bye — auto-advanced"
                                : `${m.scoreA}–${m.scoreB} · ${entryName(ev.entries, m.winnerEntryId)} wins`}
                            </span>
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
                      );
                    })}
                  </div>
                  {ev.format === "round_robin" && (ev.standings?.length ?? 0) > 0 && (
                    <div className="mt-4">
                      <h3 className="mb-1 text-sm font-semibold">Standings</h3>
                      <ol className="space-y-0.5 text-sm">
                        {ev.standings!.map((row, i) => (
                          <li key={row.entryId} className="flex justify-between">
                            <span className="text-text-primary">
                              {i + 1}. {row.name}
                            </span>
                            <span className="text-text-secondary">
                              {row.won}W–{row.lost}L · {row.points} pts
                            </span>
                          </li>
                        ))}
                      </ol>
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
          </Card>
        );
      })}
    </div>
  );
}
