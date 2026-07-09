"use client";

import { useState } from "react";
import Link from "next/link";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, EmptyState, PrimaryButton, SelectField, StatusPill, Table } from "@/components/ui";
import type { EventRoster, Fixture, InterschoolEvent } from "@/lib/types";

const STATUS_TONE = {
  draft: "neutral",
  scheduled: "info",
  live: "warning",
  pending_confirmation: "warning",
  completed: "success",
  abandoned: "danger",
} as const;

export function FixturesTab({ event, isHost }: { event: InterschoolEvent; isHost: boolean }) {
  const { data: fixtures, loading, error, refetch } = useApiList<Fixture>(`/fixtures?eventId=${event.id}`);
  const { data: rosters } = useApiList<EventRoster>(`/interschool/events/${event.id}/rosters`);

  const [sportKey, setSportKey] = useState(event.sports[0] ?? "");
  const [academyAId, setAcademyAId] = useState(event.hostAcademyId);
  const [academyBId, setAcademyBId] = useState("");
  const [entrantA, setEntrantA] = useState<string[]>([]);
  const [entrantB, setEntrantB] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [venue, setVenue] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const participatingAcademies = Array.from(
    new Map(
      [{ id: event.hostAcademyId, name: event.hostAcademy.name }, ...(event.invitations ?? [])
        .filter((i) => i.status === "accepted")
        .map((i) => ({ id: i.invitedAcademyId, name: i.invitedAcademy?.name ?? "Unknown" }))].map((a) => [a.id, a])
    ).values()
  );

  const rostersForSport = rosters.filter((r) => r.sportKey === sportKey && r.eligibilityStatus === "eligible");
  const rostersA = rostersForSport.filter((r) => r.academyId === academyAId);
  const rostersB = rostersForSport.filter((r) => r.academyId === academyBId);

  function toggle(setter: typeof setEntrantA, clientId: string) {
    setter((prev) => (prev.includes(clientId) ? prev.filter((c) => c !== clientId) : [...prev, clientId]));
  }

  async function handleCreate() {
    if (!sportKey || entrantA.length === 0 || entrantB.length === 0) {
      setFormError("Sport and at least one player per side are required.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await apiJson("/fixtures", {
        method: "POST",
        body: JSON.stringify({
          eventId: event.id,
          sportKey,
          formatType: event.formatType,
          entrantA,
          entrantB,
          scheduledAt: scheduledAt || undefined,
          venue: venue || undefined,
        }),
      });
      setEntrantA([]);
      setEntrantB([]);
      setScheduledAt("");
      setVenue("");
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create fixture.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {isHost && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Create fixture</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectField label="Sport" value={sportKey} onChange={(e) => setSportKey(e.target.value)}>
              {event.sports.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
            <Field2 label="Scheduled at" type="datetime-local" value={scheduledAt} onChange={setScheduledAt} />
            <Field2 label="Venue" value={venue} onChange={setVenue} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <SelectField label="Side A school" value={academyAId} onChange={(e) => setAcademyAId(e.target.value)}>
                {participatingAcademies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </SelectField>
              <div className="mt-2 flex flex-wrap gap-2">
                {rostersA.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(setEntrantA, r.clientId)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      entrantA.includes(r.clientId) ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
                    }`}
                  >
                    {r.client.name}
                  </button>
                ))}
                {rostersA.length === 0 && <p className="text-xs text-text-muted">No eligible players nominated for this sport.</p>}
              </div>
            </div>
            <div>
              <SelectField label="Side B school" value={academyBId} onChange={(e) => setAcademyBId(e.target.value)}>
                <option value="">Select opponent school…</option>
                {participatingAcademies
                  .filter((a) => a.id !== academyAId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </SelectField>
              <div className="mt-2 flex flex-wrap gap-2">
                {rostersB.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(setEntrantB, r.clientId)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      entrantB.includes(r.clientId) ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
                    }`}
                  >
                    {r.client.name}
                  </button>
                ))}
                {rostersB.length === 0 && <p className="text-xs text-text-muted">No eligible players nominated for this sport.</p>}
              </div>
            </div>
          </div>

          {formError && <p className="text-sm text-danger">{formError}</p>}
          <PrimaryButton className="w-auto px-6" onClick={handleCreate} disabled={busy}>
            Create Fixture
          </PrimaryButton>
        </Card>
      )}

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : fixtures.length === 0 ? (
        <Card>
          <EmptyState message="No fixtures yet." />
        </Card>
      ) : (
        <Table columns={["Sport", "Entrants", "Scheduled", "Venue", "Status", ""]}>
          {fixtures.map((f) => (
            <tr key={f.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3 font-medium text-text-primary">{f.sportKey}</td>
              <td className="px-4 py-3 text-text-secondary">
                {f.entrantA.length} vs {f.entrantB.length}
              </td>
              <td className="px-4 py-3 text-text-secondary">{f.scheduledAt ? f.scheduledAt.slice(0, 16).replace("T", " ") : "—"}</td>
              <td className="px-4 py-3 text-text-secondary">{f.venue ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusPill tone={STATUS_TONE[f.status]}>{f.status}</StatusPill>
              </td>
              <td className="px-4 py-3">
                <Link href={`/interschool/fixtures/${f.id}`} className="text-sm text-accent hover:underline">
                  Open →
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function Field2({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-text-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-surface-alt px-3.5 py-2.5 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </label>
  );
}
