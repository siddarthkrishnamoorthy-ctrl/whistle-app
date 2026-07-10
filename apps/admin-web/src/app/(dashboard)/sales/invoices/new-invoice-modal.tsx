"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/modal";
import { Field, SelectField } from "@/components/ui";
import { useApiList } from "@/lib/hooks";
import type { Client } from "@/lib/types";

export interface CreateInvoicePayload {
  clientId: string;
  planId?: string;
  amount: number;
}

export function NewInvoiceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (dto: CreateInvoicePayload) => Promise<void>;
}) {
  const { data: clients } = useApiList<Client>("/clients");

  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClient = clients.find((c) => c.id === clientId);
  const activePlanId = selectedClient?.enrollments?.[0]?.planId;

  function reset() {
    setClientId("");
    setAmount("");
    setError(null);
  }

  async function handleSubmit() {
    if (!clientId || !amount) {
      setError("Client and amount are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreated({ clientId, planId: activePlanId, amount: Number(amount) });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invoice.");
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
      title="New Invoice"
      subtitle="Raise an invoice for a client"
      footer={
        <ModalFooter
          onCancel={() => {
            reset();
            onClose();
          }}
          onSubmit={handleSubmit}
          submitLabel="Create Invoice"
          submitting={submitting}
        />
      }
    >
      <SelectField label="Client *" value={clientId} onChange={(e) => setClientId(e.target.value)}>
        <option value="">Student…</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <Field label="Amount (₹) *" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
