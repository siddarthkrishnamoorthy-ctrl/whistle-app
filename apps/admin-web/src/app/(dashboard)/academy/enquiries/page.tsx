"use client";

import { useState } from "react";
import Link from "next/link";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, StatusPill, Table, Tabs } from "@/components/ui";
import type { Enquiry, EnquiryStage } from "@/lib/types";
import { NewEnquiryModal, type CreateEnquiryPayload } from "./new-enquiry-modal";

const TABS: { key: EnquiryStage; label: string }[] = [
  { key: "lead", label: "Leads" },
  { key: "closed", label: "Closed" },
  { key: "junk", label: "Junk" },
];

const TEMP_TONE = { hot: "danger", warm: "warning", cold: "info" } as const;

export default function EnquiriesPage() {
  const [tab, setTab] = useState<EnquiryStage>("lead");
  const [modalOpen, setModalOpen] = useState(false);
  const { data: enquiries, loading, error, refetch } = useApiList<Enquiry>(`/enquiries?stage=${tab}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Enquiries</h1>
          <p className="text-sm text-text-secondary">{enquiries.length} enquiries</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          + Add Enquiry
        </button>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : enquiries.length === 0 ? (
        <Card>
          <EmptyState message="No enquiries in this category yet." />
        </Card>
      ) : (
        <Table columns={["Name", "Enquired For", "Status", "Assigned To", "Follow-up"]}>
          {enquiries.map((enquiry) => (
            <tr key={enquiry.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3">
                <Link href={`/academy/enquiries/${enquiry.id}`} className="font-medium text-text-primary hover:text-accent">
                  {enquiry.name}
                </Link>
                <div className="text-xs text-text-muted">{enquiry.phone}</div>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {[enquiry.sport?.name, enquiry.level, enquiry.centerId ? "Center set" : null].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="px-4 py-3">
                <StatusPill tone={TEMP_TONE[enquiry.status]}>{enquiry.status}</StatusPill>
              </td>
              <td className="px-4 py-3 text-text-secondary">{enquiry.assignedStaff?.name ?? "Unassigned"}</td>
              <td className="px-4 py-3 text-text-secondary">
                {enquiry.followUpDate ? enquiry.followUpDate.slice(0, 10) : "—"}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <NewEnquiryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async (dto: CreateEnquiryPayload) => {
          await apiJson("/enquiries", { method: "POST", body: JSON.stringify(dto) });
          setModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
