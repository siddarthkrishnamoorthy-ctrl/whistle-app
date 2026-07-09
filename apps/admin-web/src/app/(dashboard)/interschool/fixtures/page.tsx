"use client";

import { useState } from "react";
import Link from "next/link";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, StatusPill, Table } from "@/components/ui";
import type { Fixture } from "@/lib/types";
import { NewFixtureModal, type CreatePracticeFixturePayload } from "./new-fixture-modal";

const STATUS_TONE = {
  draft: "neutral",
  scheduled: "info",
  live: "warning",
  pending_confirmation: "warning",
  completed: "success",
  abandoned: "danger",
} as const;

export default function FixturesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: fixtures, loading, error, refetch } = useApiList<Fixture>("/fixtures");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Fixtures</h1>
          <p className="text-sm text-text-secondary">Interschool, internal ladder, and practice matches</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          + New Internal Match
        </button>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : fixtures.length === 0 ? (
        <Card>
          <EmptyState message="No fixtures yet." />
        </Card>
      ) : (
        <Table columns={["Sport", "Type", "Event", "Entrants", "Scheduled", "Status", ""]}>
          {fixtures.map((f) => (
            // Amber left edge = active operation (live / awaiting confirmation).
            <tr
              key={f.id}
              className={
                f.status === "live" || f.status === "pending_confirmation"
                  ? "border-l-2 border-l-warning"
                  : "border-l-2 border-l-transparent"
              }
            >
              <td className="px-4 py-3 font-medium text-text-primary">{f.sportKey}</td>
              <td className="px-4 py-3 text-text-secondary capitalize">{f.matchType.replace("_", " ")}</td>
              <td className="px-4 py-3 text-text-secondary">{f.event?.name ?? "—"}</td>
              <td className="px-4 py-3 text-text-secondary">
                {f.entrantA.length} vs {f.entrantB.length}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {f.scheduledAt ? f.scheduledAt.slice(0, 16).replace("T", " ") : "—"}
              </td>
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

      <NewFixtureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async (dto: CreatePracticeFixturePayload) => {
          await apiJson("/fixtures", { method: "POST", body: JSON.stringify(dto) });
          setModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
