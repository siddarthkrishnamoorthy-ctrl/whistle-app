"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/modal";
import { SelectField } from "@/components/ui";
import { useApiList } from "@/lib/hooks";
import type { Client, EventFormatType, Sport } from "@/lib/types";

export interface CreatePracticeFixturePayload {
  sportKey: string;
  formatType: EventFormatType;
  entrantA: string[];
  entrantB: string[];
  matchType: "practice" | "internal_ladder";
}

export function NewFixtureModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (dto: CreatePracticeFixturePayload) => Promise<void>;
}) {
  const { data: sports } = useApiList<Sport>("/sports");
  const { data: clients } = useApiList<Client>("/clients");

  const [sportKey, setSportKey] = useState("");
  const [formatType, setFormatType] = useState<EventFormatType>("team");
  const [matchType, setMatchType] = useState<"practice" | "internal_ladder">("practice");
  const [entrantA, setEntrantA] = useState<string[]>([]);
  const [entrantB, setEntrantB] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSportKey("");
    setFormatType("team");
    setMatchType("practice");
    setEntrantA([]);
    setEntrantB([]);
    setError(null);
  }

  function toggle(setter: typeof setEntrantA, clientId: string) {
    setter((prev) => (prev.includes(clientId) ? prev.filter((c) => c !== clientId) : [...prev, clientId]));
  }

  async function handleSubmit() {
    if (!sportKey || entrantA.length === 0 || entrantB.length === 0) {
      setError("Sport and at least one client per side are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreated({ sportKey, formatType, entrantA, entrantB, matchType });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create fixture.");
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
      title="New Internal Match"
      subtitle="Practice match or rated internal ladder — scored with the same engine"
      wide
      footer={
        <ModalFooter
          onCancel={() => {
            reset();
            onClose();
          }}
          onSubmit={handleSubmit}
          submitLabel="Create Fixture"
          submitting={submitting}
        />
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <SelectField label="Sport *" value={sportKey} onChange={(e) => setSportKey(e.target.value)}>
          <option value="">Select…</option>
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
        <SelectField label="Match type" value={matchType} onChange={(e) => setMatchType(e.target.value as typeof matchType)}>
          <option value="practice">Practice (not rated)</option>
          <option value="internal_ladder">Internal ladder (rated)</option>
        </SelectField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="mb-1.5 block text-sm text-text-secondary">Side A</span>
          <div className="flex flex-wrap gap-2">
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(setEntrantA, c.id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  entrantA.includes(c.id) ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm text-text-secondary">Side B</span>
          <div className="flex flex-wrap gap-2">
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(setEntrantB, c.id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  entrantB.includes(c.id) ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
