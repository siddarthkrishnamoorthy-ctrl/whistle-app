"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Field, SelectField, StatusPill } from "@/components/ui";
import { Modal, ModalFooter } from "@/components/modal";
import { useApiList } from "@/lib/hooks";
import type { Sport } from "@/lib/types";

interface LblRegistration {
  id: string;
  sportKey: string;
  status: "pending_payment" | "paid";
  amount?: string | number | null;
  academy: { id: string; name: string };
}

interface LblEvent {
  id: string;
  name: string;
  sports: string[];
  formatType: string;
  startDate: string;
  endDate: string;
  status: string;
  payToJoin: boolean;
  pricePerHead?: string | number | null;
  hostAcademy?: { id: string; name: string };
  _count?: { fixtures: number; lblRegistrations: number };
}

export default function LblPage() {
  const { data: sports } = useApiList<Sport>("/sports");
  const [events, setEvents] = useState<LblEvent[]>([]);
  const [regs, setRegs] = useState<Record<string, LblRegistration[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [formatType, setFormatType] = useState("team");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refetch = useCallback(() => {
    apiJson<LblEvent[]>("/interschool/lbl/events")
      .then(async (all) => {
        setEvents(all);
        const regMap: Record<string, LblRegistration[]> = {};
        for (const e of all) {
          regMap[e.id] = await apiJson<LblRegistration[]>(`/interschool/lbl/events/${e.id}/registrations`).catch(
            () => []
          );
        }
        setRegs(regMap);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load LBL tournaments."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refetch, [refetch]);

  async function createTournament() {
    if (!name.trim() || selectedSports.length === 0 || !startDate || !endDate) {
      setError("Name, at least one sport and both dates are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const event = await apiJson<{ id: string }>("/interschool/events", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          sports: selectedSports,
          formatType,
          ageBands: ["Open"],
          startDate,
          endDate,
          isLbl: true,
          payToJoin: Boolean(price),
          pricePerHead: price ? Number(price) : undefined,
        }),
      });
      await apiJson(`/interschool/events/${event.id}/publish`, { method: "POST", body: JSON.stringify({}) });
      setModalOpen(false);
      setName("");
      setSelectedSports([]);
      setStartDate("");
      setEndDate("");
      setPrice("");
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the tournament.");
    } finally {
      setSubmitting(false);
    }
  }

  async function generate(eventId: string) {
    try {
      const res = await apiJson<{ created: number; skipped: { sportKey: string; reason: string }[] }>(
        `/interschool/lbl/events/${eventId}/generate-fixtures`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setNotice(
        `${res.created} fixture(s) created.` +
          (res.skipped.length ? ` Skipped: ${res.skipped.map((s) => `${s.sportKey} (${s.reason})`).join("; ")}` : "")
      );
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate fixtures.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="border-l-4 border-accent pl-3">
          <h1 className="text-xl font-bold tracking-wide text-accent">LBL TOURNAMENTS</h1>
          <p className="text-sm text-text-secondary">
            Open tournaments schools register for per sport — with payment, rosters and generated fixtures
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          + New LBL Tournament
        </button>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}
      {notice && <Card className="text-sm text-success">{notice}</Card>}

      {events.length > 0 && (
        <Field
          label=""
          placeholder="Search LBL tournaments…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      )}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : events.length === 0 ? (
        <Card>
          <EmptyState message="No LBL tournaments yet — create one and network schools can register from their coach app." />
        </Card>
      ) : (
        <div className="space-y-4">
          {events
            .filter((e) => !search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase()))
            .map((e) => (
            <Card key={e.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-text-primary">{e.name}</div>
                  <div className="mt-0.5 text-xs text-text-secondary">
                    {e.startDate.slice(0, 10)} → {e.endDate.slice(0, 10)} · {e.sports.join(", ")} · {e.formatType}
                    {e.payToJoin && e.pricePerHead != null ? ` · ₹${Number(e.pricePerHead)} per sport` : " · free"}
                    {" · Host: "}
                    {e.hostAcademy?.name ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={e.status === "live" ? "warning" : "info"}>{e.status}</StatusPill>
                  <button
                    onClick={() => generate(e.id)}
                    className="rounded-full border border-warning/60 px-3.5 py-1.5 text-xs font-semibold text-warning hover:bg-warning/10"
                  >
                    Generate fixtures ({e._count?.fixtures ?? 0})
                  </button>
                </div>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <div className="mb-1.5 text-xs uppercase tracking-wide text-text-muted">School registrations</div>
                {(regs[e.id] ?? []).length === 0 ? (
                  <p className="text-sm text-text-secondary">No schools registered yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(regs[e.id] ?? []).map((r) => (
                      <li key={r.id} className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">
                          <span className="font-medium text-text-primary">{r.academy.name}</span> · {r.sportKey}
                        </span>
                        <StatusPill tone={r.status === "paid" ? "success" : "warning"}>
                          {r.status === "paid" ? "paid" : `awaiting ₹${Number(r.amount ?? 0)}`}
                        </StatusPill>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New LBL Tournament"
        subtitle="Published immediately so schools can register"
        footer={
          <ModalFooter
            onCancel={() => setModalOpen(false)}
            onSubmit={createTournament}
            submitLabel="Create & Publish"
            submitting={submitting}
          />
        }
      >
        <Field label="Tournament name *" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <span className="mb-1.5 block text-sm text-text-secondary">Sports *</span>
          <div className="flex flex-wrap gap-2">
            {sports.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() =>
                  setSelectedSports((prev) =>
                    prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key]
                  )
                }
                className={`rounded-full border px-3 py-1 text-xs ${
                  selectedSports.includes(s.key)
                    ? "border-accent bg-accent text-accent-text"
                    : "border-border text-text-secondary"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Format" value={formatType} onChange={(e) => setFormatType(e.target.value)}>
            <option value="individual">Individual</option>
            <option value="pair">Pair</option>
            <option value="team">Team</option>
          </SelectField>
          <Field
            label="Entry fee per sport (₹, empty = free)"
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date *" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Field label="End date *" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
