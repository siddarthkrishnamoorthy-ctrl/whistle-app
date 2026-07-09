"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, Field, PrimaryButton, SelectField, StatusPill, Table } from "@/components/ui";
import type { Client, EventFormatType, InterschoolSettings, Rating, RatingTransaction, Sport } from "@/lib/types";

export default function RatingsAdminPage() {
  const { data: clients } = useApiList<Client>("/clients");
  const { data: sports } = useApiList<Sport>("/sports");
  const [settings, setSettings] = useState<InterschoolSettings | null>(null);

  useEffect(() => {
    apiJson<InterschoolSettings>("/interschool/settings").then(setSettings);
  }, []);

  const [clientId, setClientId] = useState("");
  const [sportKey, setSportKey] = useState("");
  const [formatType, setFormatType] = useState<EventFormatType>("individual");
  const [rating, setRating] = useState<Rating | null>(null);
  const [history, setHistory] = useState<RatingTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overrideValue, setOverrideValue] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideBusy, setOverrideBusy] = useState(false);

  async function search() {
    if (!clientId || !sportKey) return;
    setLoading(true);
    setError(null);
    setRating(null);
    try {
      const [r, h] = await Promise.all([
        apiJson<Rating>(`/ratings/${clientId}/${sportKey}/${formatType}`),
        apiJson<RatingTransaction[]>(`/ratings/${clientId}/${sportKey}/${formatType}/history`),
      ]);
      setRating(r);
      setHistory(h);
      setOverrideValue(r.currentRating);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rating.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOverride() {
    setOverrideBusy(true);
    setError(null);
    try {
      await apiJson(`/ratings/${clientId}/${sportKey}/${formatType}/override`, {
        method: "POST",
        body: JSON.stringify({ rating: Number(overrideValue), reason: overrideReason }),
      });
      await search();
      setOverrideReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not override rating.");
    } finally {
      setOverrideBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Whistle Standings</h1>
        <p className="text-sm text-text-secondary">Search any student/sport to view rating history</p>
      </div>

      <Card className="flex items-end gap-3">
        <SelectField label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Sport" value={sportKey} onChange={(e) => setSportKey(e.target.value)}>
          <option value="">Select a sport…</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Format" value={formatType} onChange={(e) => setFormatType(e.target.value as EventFormatType)}>
          <option value="individual">Individual</option>
          <option value="pair">Pair</option>
          <option value="team">Team</option>
        </SelectField>
        <PrimaryButton className="w-auto px-6" onClick={search} disabled={loading || !clientId || !sportKey}>
          Search
        </PrimaryButton>
      </Card>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {rating && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card>
              <div className="text-xs text-text-secondary">Current rating</div>
              <div className="mt-1 text-2xl font-semibold text-accent">{Number(rating.currentRating).toFixed(2)}</div>
            </Card>
            <Card>
              <div className="text-xs text-text-secondary">Matches played</div>
              <div className="mt-1 text-2xl font-semibold text-text-primary">{rating.matchesPlayed}</div>
            </Card>
            <Card>
              <div className="text-xs text-text-secondary">Confidence</div>
              <div className="mt-1 text-2xl font-semibold capitalize text-text-primary">
                {rating.confidence}
                {settings?.showReliabilityScore && rating.reliabilityPct !== undefined && (
                  <span className="ml-2 text-sm font-normal text-text-muted">({rating.reliabilityPct}% reliable)</span>
                )}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-text-secondary">Status</div>
              <div className="mt-1">
                <StatusPill tone={rating.isProvisional ? "warning" : "success"}>
                  {rating.isProvisional ? "Provisional" : "Established"}
                </StatusPill>
              </div>
            </Card>
          </div>

          {rating.matchesPlayed === 0 && (
            <Card className="space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">Manual starting-rating override</h2>
              <p className="text-xs text-text-secondary">
                Only available before the first rated match, within ±0.5 of the mapped seed value. Always logged with reason.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="New rating"
                  type="number"
                  step="0.01"
                  min={2}
                  max={8}
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(e.target.value)}
                />
                <Field label="Reason *" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
              </div>
              <PrimaryButton
                className="w-auto px-6"
                onClick={handleOverride}
                disabled={overrideBusy || !overrideReason.trim()}
              >
                {overrideBusy ? "Saving…" : "Apply Override"}
              </PrimaryButton>
            </Card>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-text-primary">Rating history</h2>
            {history.length === 0 ? (
              <Card className="text-sm text-text-secondary">No rating changes yet.</Card>
            ) : (
              <Table columns={["Date", "Pre", "Post", "Δ", "K used", "Reason"]}>
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-surface-alt">
                    <td className="px-4 py-3 text-text-secondary">{h.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td className="px-4 py-3 text-text-secondary">{Number(h.preRating).toFixed(2)}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{Number(h.postRating).toFixed(2)}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {(Number(h.postRating) - Number(h.preRating)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{Number(h.kFactorUsed).toFixed(2)}</td>
                    <td className="px-4 py-3 text-text-secondary">{h.overrideReason ?? (h.fixtureId ? "Match result" : "—")}</td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
