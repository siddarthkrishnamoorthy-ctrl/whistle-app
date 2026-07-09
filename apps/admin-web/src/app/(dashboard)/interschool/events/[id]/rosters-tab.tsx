"use client";

import { useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, EmptyState, OutlineButton, PrimaryButton, SelectField, StatusPill, Table } from "@/components/ui";
import type { Client, EventRoster, InterschoolEvent } from "@/lib/types";

const ELIGIBILITY_TONE = { eligible: "success", ineligible: "danger", pending: "warning" } as const;

export function RostersTab({ event }: { event: InterschoolEvent }) {
  const { data: rosters, loading, error, refetch } = useApiList<EventRoster>(`/interschool/events/${event.id}/rosters`);
  const { data: clients } = useApiList<Client>("/clients");

  const [sportKey, setSportKey] = useState(event.sports[0] ?? "");
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [nominateError, setNominateError] = useState<string | null>(null);

  async function handleNominate() {
    if (!sportKey || !clientId) return;
    setBusy(true);
    setNominateError(null);
    try {
      await apiJson(`/interschool/events/${event.id}/rosters`, {
        method: "POST",
        body: JSON.stringify({ sportKey, clientId }),
      });
      setClientId("");
      refetch();
    } catch (err) {
      setNominateError(err instanceof Error ? err.message : "Could not nominate client.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(rosterId: string) {
    setBusy(true);
    try {
      await apiJson(`/interschool/events/${event.id}/rosters/${rosterId}`, { method: "DELETE" });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not remove nomination.");
    } finally {
      setBusy(false);
    }
  }

  // Pay-to-Join (Addendum v3 3.2): marks the linked invoice paid, then
  // re-nominates the same player so eligibility is recomputed against the
  // now-paid invoice — the nominate endpoint is an idempotent upsert.
  async function handleMarkPaidAndRecheck(roster: EventRoster) {
    if (!roster.invoice) return;
    setBusy(true);
    try {
      await apiJson(`/invoices/${roster.invoice.id}/mark-paid`, { method: "POST" });
      await apiJson(`/interschool/events/${event.id}/rosters`, {
        method: "POST",
        body: JSON.stringify({ sportKey: roster.sportKey, clientId: roster.clientId }),
      });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not mark payment complete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Nominate a player</h2>
        <div className="flex items-end gap-3">
          <SelectField label="Sport" value={sportKey} onChange={(e) => setSportKey(e.target.value)}>
            {event.sports.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
          <SelectField label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <PrimaryButton className="w-auto px-6" onClick={handleNominate} disabled={busy || !clientId}>
            Nominate
          </PrimaryButton>
        </div>
        {nominateError && <p className="text-sm text-danger">{nominateError}</p>}
      </Card>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : rosters.length === 0 ? (
        <Card>
          <EmptyState message="No players nominated yet." />
        </Card>
      ) : (
        <Table columns={event.payToJoin ? ["Player", "School", "Sport", "Eligibility", "Consent", "Payment", ""] : ["Player", "School", "Sport", "Eligibility", "Consent", ""]}>
          {rosters.map((r) => (
            <tr key={r.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3 font-medium text-text-primary">{r.client.name}</td>
              <td className="px-4 py-3 text-text-secondary">{r.academy.name}</td>
              <td className="px-4 py-3 text-text-secondary">{r.sportKey}</td>
              <td className="px-4 py-3">
                <StatusPill tone={ELIGIBILITY_TONE[r.eligibilityStatus]}>{r.eligibilityStatus}</StatusPill>
              </td>
              <td className="px-4 py-3 text-text-secondary">{r.consentConfirmed ? "Yes" : "No"}</td>
              {event.payToJoin && (
                <td className="px-4 py-3">
                  {r.invoice ? (
                    r.invoice.status === "paid" ? (
                      <StatusPill tone="success">Paid</StatusPill>
                    ) : (
                      <div className="flex items-center gap-2">
                        <StatusPill tone="warning">Pending payment</StatusPill>
                        <OutlineButton
                          className="w-auto px-3 py-1 text-xs"
                          onClick={() => handleMarkPaidAndRecheck(r)}
                          disabled={busy}
                        >
                          Mark Paid
                        </OutlineButton>
                      </div>
                    )
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td className="px-4 py-3">
                <OutlineButton className="w-auto px-4 py-1.5 text-xs" onClick={() => handleRemove(r.id)} disabled={busy}>
                  Remove
                </OutlineButton>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
