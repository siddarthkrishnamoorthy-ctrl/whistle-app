"use client";

import { useState } from "react";
import { useApiList } from "@/lib/hooks";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, StatusPill, Table } from "@/components/ui";
import type { StaffProfile } from "@/lib/types";
import { NewStaffModal, type CreateStaffPayload } from "./new-staff-modal";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  coach: "Coach",
  head_coach: "Head Coach",
  account_manager: "Account Manager",
  venue_manager: "Venue Manager",
};

const SALARY_LABEL: Record<string, string> = { fixed: "Fixed", session: "Session", days_present: "Days present" };

export default function StaffUsersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: staff, loading, error, refetch } = useApiList<StaffProfile>("/staff");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Staff</h1>
          <p className="text-sm text-text-secondary">{staff.length} staff members</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          + Add Staff
        </button>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : staff.length === 0 ? (
        <Card>
          <EmptyState message="No staff added yet." />
        </Card>
      ) : (
        <Table columns={["Name", "Role", "Skills", "Center", "Salary"]}>
          {staff.map((s) => (
            <tr key={s.userId} className="hover:bg-surface-alt">
              <td className="px-4 py-3">
                <div className="font-medium text-text-primary">{s.user.name}</div>
                <div className="text-xs text-text-muted">{s.user.email}</div>
              </td>
              <td className="px-4 py-3">
                <StatusPill tone="info">{ROLE_LABEL[s.user.role] ?? s.user.role}</StatusPill>
              </td>
              <td className="px-4 py-3 text-text-secondary">{s.skills.length > 0 ? s.skills.join(", ") : "All"}</td>
              <td className="px-4 py-3 text-text-secondary">{s.center?.name ?? "All centers"}</td>
              <td className="px-4 py-3 text-text-secondary">
                {s.salaryBasis
                  ? `${SALARY_LABEL[s.salaryBasis]} · ₹${Number(s.salaryAmount ?? 0).toLocaleString("en-IN")}`
                  : "Not set"}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <NewStaffModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async (dto: CreateStaffPayload) => {
          await apiJson("/staff", { method: "POST", body: JSON.stringify(dto) });
          setModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
