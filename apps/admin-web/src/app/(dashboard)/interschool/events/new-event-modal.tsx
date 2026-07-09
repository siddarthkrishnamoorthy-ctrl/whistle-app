"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/modal";
import { Field, SelectField } from "@/components/ui";
import { useApiList } from "@/lib/hooks";
import type { EventFormatType, Sport } from "@/lib/types";
import { AGE_GROUPS } from "@whistle/shared";

export interface CreateEventPayload {
  name: string;
  sports: string[];
  formatType: EventFormatType;
  ageBands: string[];
  startDate: string;
  endDate: string;
  payToJoin?: boolean;
  pricePerHead?: number;
}

export function NewEventModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (dto: CreateEventPayload) => Promise<void>;
}) {
  const { data: sports } = useApiList<Sport>("/sports");

  const [name, setName] = useState("");
  const [sportKeys, setSportKeys] = useState<string[]>([]);
  const [formatType, setFormatType] = useState<EventFormatType>("team");
  const [ageBands, setAgeBands] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [payToJoin, setPayToJoin] = useState(false);
  const [pricePerHead, setPricePerHead] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setSportKeys([]);
    setFormatType("team");
    setAgeBands([]);
    setStartDate("");
    setEndDate("");
    setPayToJoin(false);
    setPricePerHead("");
    setError(null);
  }

  function toggleSport(key: string) {
    setSportKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleAgeBand(band: string) {
    setAgeBands((prev) => (prev.includes(band) ? prev.filter((b) => b !== band) : [...prev, band]));
  }

  async function handleSubmit() {
    if (!name.trim() || sportKeys.length === 0 || ageBands.length === 0 || !startDate || !endDate) {
      setError("Name, at least one sport, one age band, and both dates are required.");
      return;
    }
    if (payToJoin && (!pricePerHead || Number(pricePerHead) <= 0)) {
      setError("Set a price per head when Pay-to-Join is enabled.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreated({
        name: name.trim(),
        sports: sportKeys,
        formatType,
        ageBands,
        startDate,
        endDate,
        payToJoin,
        pricePerHead: payToJoin ? Number(pricePerHead) : undefined,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create event.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New Interschool Event"
      subtitle="Details → invite schools → format/rules"
      wide
      footer={
        <ModalFooter
          onCancel={() => {
            reset();
            onClose();
          }}
          onSubmit={handleSubmit}
          submitLabel="Create Event (Draft)"
          submitting={submitting}
        />
      }
    >
      <Field label="Event name *" placeholder="e.g. Summer Dual Meet 2026" value={name} onChange={(e) => setName(e.target.value)} />

      <div>
        <span className="mb-1.5 block text-sm text-text-secondary">Sports *</span>
        <div className="flex flex-wrap gap-2">
          {sports.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSport(s.key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                sportKeys.includes(s.key) ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Format *" value={formatType} onChange={(e) => setFormatType(e.target.value as EventFormatType)}>
          <option value="individual">Individual</option>
          <option value="pair">Pair</option>
          <option value="team">Team</option>
        </SelectField>
        <div>
          <span className="mb-1.5 block text-sm text-text-secondary">Age bands *</span>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleAgeBand(g)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  ageBands.includes(g) ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date *" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Field label="End date *" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      <div className="rounded-md border border-border p-3">
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input type="checkbox" checked={payToJoin} onChange={(e) => setPayToJoin(e.target.checked)} className="h-4 w-4 rounded border-border" />
          Pay-to-Join — participants must pay before their roster spot is confirmed
        </label>
        {payToJoin && (
          <div className="mt-2">
            <Field
              label="Price per head (₹) *"
              type="number"
              min={0}
              value={pricePerHead}
              onChange={(e) => setPricePerHead(e.target.value)}
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
