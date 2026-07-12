"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Card, OutlineButton, PrimaryButton, SelectField, StatusPill } from "@/components/ui";
import type { Fixture, ScoringTemplate } from "@/lib/types";

const STATUS_TONE = {
  draft: "neutral",
  scheduled: "info",
  live: "warning",
  pending_confirmation: "warning",
  completed: "success",
  abandoned: "danger",
} as const;

function computeTally(fixture: Fixture, template: ScoringTemplate | null) {
  const session = fixture.scoringSessions?.[fixture.scoringSessions.length - 1];
  const events = session?.events ?? [];
  const tally: Record<string, { A: number; B: number }> = {};
  if (!template) return tally;
  for (const field of template.scoreFields) {
    tally[field.key] = { A: 0, B: 0 };
  }
  for (const ev of events) {
    const payload = (ev.payload ?? {}) as { side?: "A" | "B"; option?: number | string };
    const side = payload.side;
    if (!side || !tally[ev.actionType]) continue;
    if (typeof payload.option === "number") tally[ev.actionType][side] += payload.option;
    else tally[ev.actionType][side] += 1;
  }
  return tally;
}

export default function FixtureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [template, setTemplate] = useState<ScoringTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scoringSide, setScoringSide] = useState<"A" | "B">("A");

  const [winnerSide, setWinnerSide] = useState<"A" | "B" | "draw">("A");
  const [scoreDisplay, setScoreDisplay] = useState("");

  async function loadReal() {
    setLoading(true);
    setError(null);
    try {
      const f = await apiJson<Fixture>(`/fixtures/${id}`);
      setFixture(f);
      try {
        const t = await apiJson<ScoringTemplate>(`/scoring-templates/${f.sportKey}/${f.formatType}`);
        setTemplate(t);
      } catch {
        setTemplate(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load fixture.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) loadReal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !fixture) return <p className="text-sm text-danger">{error ?? "Fixture not found."}</p>;

  const activeSession = fixture.scoringSessions?.[fixture.scoringSessions.length - 1];
  const sessionLive = activeSession && !activeSession.endedAt;
  const tally = computeTally(fixture, template);

  async function handleStart() {
    setBusy(true);
    try {
      await apiJson(`/fixtures/${id}/sessions`, { method: "POST" });
      await loadReal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not start match.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTap(actionType: string, option?: number | string) {
    if (!activeSession) return;
    setBusy(true);
    try {
      await apiJson(`/scoring-sessions/${activeSession.id}/events`, {
        method: "POST",
        body: JSON.stringify({
          clientEventId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          actionType,
          payload: { side: scoringSide, option },
          clientTimestamp: new Date().toISOString(),
        }),
      });
      await loadReal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not record action.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUndo() {
    if (!activeSession) return;
    setBusy(true);
    try {
      await apiJson(`/scoring-sessions/${activeSession.id}/undo`, { method: "POST" });
      await loadReal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Nothing to undo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (!activeSession) return;
    if (!scoreDisplay.trim()) {
      alert("Enter a score display summary before ending the match.");
      return;
    }
    setBusy(true);
    try {
      await apiJson(`/scoring-sessions/${activeSession.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ winnerSide, scoreDisplay }),
      });
      await loadReal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not complete match.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(force = false) {
    setBusy(true);
    try {
      await apiJson(`/fixtures/${id}/confirm`, { method: "POST", body: JSON.stringify({ force }) });
      await loadReal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not confirm result.");
    } finally {
      setBusy(false);
    }
  }

  const myConfirmation = fixture.resultConfirmations?.[user?.academyId ?? ""];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/interschool/fixtures" className="text-sm text-text-secondary hover:text-accent">
          ← Fixtures
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold capitalize">{fixture.sportKey}</h1>
          <StatusPill tone={STATUS_TONE[fixture.status]}>{fixture.status.replace("_", " ")}</StatusPill>
        </div>
        {fixture.event && <p className="text-sm text-text-secondary">Event: {fixture.event.name}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <div className="text-xs text-text-secondary">Side A</div>
          <div className="mt-1 text-sm font-medium text-text-primary">
            {fixture.entrantAClients?.map((c) => c.name).join(", ") ?? fixture.entrantA.join(", ")}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-text-secondary">Side B</div>
          <div className="mt-1 text-sm font-medium text-text-primary">
            {fixture.entrantBClients?.map((c) => c.name).join(", ") ?? fixture.entrantB.join(", ")}
          </div>
        </Card>
      </div>

      {fixture.status === "abandoned" && (
        <Card className="text-sm text-danger">Abandoned — {fixture.abandonReason}</Card>
      )}

      {(fixture.status === "scheduled" || fixture.status === "draft") && (
        <PrimaryButton className="w-auto px-6" onClick={handleStart} disabled={busy}>
          Start Match
        </PrimaryButton>
      )}

      {fixture.status === "live" && sessionLive && template && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Live scorer — {template.displayFormat}</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setScoringSide("A")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${scoringSide === "A" ? "bg-accent text-accent-text" : "bg-surface-alt text-text-secondary"}`}
              >
                Scoring for A
              </button>
              <button
                onClick={() => setScoringSide("B")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${scoringSide === "B" ? "bg-accent text-accent-text" : "bg-surface-alt text-text-secondary"}`}
              >
                Scoring for B
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 text-center">
            <div>
              <div className="text-xs text-text-secondary">Side A</div>
              <div className="text-lg font-bold text-text-primary">
                {Object.entries(tally)
                  .map(([k, v]) => `${k}: ${v.A}`)
                  .join(" · ")}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-secondary">Side B</div>
              <div className="text-lg font-bold text-text-primary">
                {Object.entries(tally)
                  .map(([k, v]) => `${k}: ${v.B}`)
                  .join(" · ")}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {template.scoreFields.map((field) => (
              <div key={field.key}>
                <div className="mb-1 text-xs font-medium text-text-secondary">{field.label}</div>
                <div className="flex flex-wrap gap-2">
                  {field.options && field.options.length > 0 ? (
                    field.options.map((opt) => (
                      <button
                        key={String(opt)}
                        onClick={() => handleTap(field.key, opt as number | string)}
                        disabled={busy}
                        className="rounded-lg border border-border bg-surface-alt px-4 py-3 text-lg font-semibold text-text-primary hover:border-accent disabled:opacity-50"
                      >
                        {String(opt)}
                      </button>
                    ))
                  ) : (
                    <button
                      onClick={() => handleTap(field.key)}
                      disabled={busy}
                      className="rounded-lg border border-border bg-surface-alt px-4 py-3 text-sm font-semibold text-text-primary hover:border-accent disabled:opacity-50"
                    >
                      {field.label}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <OutlineButton className="w-auto px-6" onClick={handleUndo} disabled={busy}>
            Undo last action
          </OutlineButton>

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-text-primary">End match</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SelectField
                label=""
                value={winnerSide}
                onChange={(e) => setWinnerSide(e.target.value as "A" | "B" | "draw")}
              >
                <option value="A">Side A wins</option>
                <option value="B">Side B wins</option>
                <option value="draw">Draw</option>
              </SelectField>
              <input
                placeholder="Score summary e.g. 146/4 vs 140/8"
                value={scoreDisplay}
                onChange={(e) => setScoreDisplay(e.target.value)}
                className="rounded-md border border-border bg-surface-alt px-3.5 py-2.5 text-text-primary sm:col-span-2"
              />
            </div>
            <PrimaryButton className="w-auto px-6" onClick={handleComplete} disabled={busy}>
              Confirm & End Match
            </PrimaryButton>
          </div>
        </Card>
      )}

      {fixture.status === "pending_confirmation" && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Result: {fixture.resultSummary?.scoreDisplay}</h2>
          <p className="text-sm text-text-secondary">
            Winner: {fixture.resultSummary?.winnerSide === "draw" ? "Draw" : `Side ${fixture.resultSummary?.winnerSide}`}
          </p>
          <p className="text-xs text-text-muted">
            Awaiting confirmation from both schools before ratings are recalculated.
          </p>
          {myConfirmation ? (
            <p className="text-sm text-success">✓ Your academy has confirmed.</p>
          ) : (
            <div className="flex gap-3">
              <PrimaryButton className="w-auto px-6" onClick={() => handleConfirm(false)} disabled={busy}>
                Confirm Result
              </PrimaryButton>
              <OutlineButton className="w-auto px-6" onClick={() => handleConfirm(true)} disabled={busy}>
                Force-confirm (Admin)
              </OutlineButton>
            </div>
          )}
        </Card>
      )}

      {fixture.status === "completed" && (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary">Final result: {fixture.resultSummary?.scoreDisplay}</h2>
          <p className="text-sm text-text-secondary">
            Winner: {fixture.resultSummary?.winnerSide === "draw" ? "Draw" : `Side ${fixture.resultSummary?.winnerSide}`}
          </p>
          {(fixture.matchType === "interschool" || fixture.matchType === "internal_ladder") && (
            <p className="text-sm text-success">✓ Ratings recalculated for all featured players.</p>
          )}
        </Card>
      )}
    </div>
  );
}
