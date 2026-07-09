"use client";

import { useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, OutlineButton, PrimaryButton, SelectField, StatusPill } from "@/components/ui";
import type { InterschoolEvent, MemberSchool } from "@/lib/types";

export function OverviewTab({ event, onRefetch }: { event: InterschoolEvent; onRefetch: () => void }) {
  const { data: memberSchools } = useApiList<MemberSchool>("/interschool/member-schools");
  const [inviteAcademyId, setInviteAcademyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invitedIds = new Set((event.invitations ?? []).map((i) => i.invitedAcademyId));
  const invitableSchools = memberSchools.filter((s) => !invitedIds.has(s.id));

  async function handlePublish() {
    setBusy(true);
    setError(null);
    try {
      await apiJson(`/interschool/events/${event.id}/publish`, { method: "POST" });
      onRefetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish event.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    setBusy(true);
    setError(null);
    try {
      await apiJson(`/interschool/events/${event.id}/close`, { method: "POST" });
      onRefetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close event.");
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite() {
    if (!inviteAcademyId) return;
    setBusy(true);
    setError(null);
    try {
      await apiJson(`/interschool/events/${event.id}/invitations`, {
        method: "POST",
        body: JSON.stringify({ academyIds: [inviteAcademyId] }),
      });
      setInviteAcademyId("");
      onRefetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-xs text-text-secondary">Host</div>
          <div className="mt-1 font-semibold text-text-primary">{event.hostAcademy.name}</div>
        </Card>
        <Card>
          <div className="text-xs text-text-secondary">Sports</div>
          <div className="mt-1 font-semibold text-text-primary">{event.sports.join(", ")}</div>
        </Card>
        <Card>
          <div className="text-xs text-text-secondary">Format</div>
          <div className="mt-1 font-semibold capitalize text-text-primary">{event.formatType}</div>
        </Card>
        <Card>
          <div className="text-xs text-text-secondary">Age bands</div>
          <div className="mt-1 font-semibold text-text-primary">{event.ageBands.join(", ")}</div>
        </Card>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Invited schools</h2>
          {event.status === "draft" && (
            <PrimaryButton className="w-auto px-6" onClick={handlePublish} disabled={busy}>
              Publish Event
            </PrimaryButton>
          )}
          {event.status === "completed" && (
            <OutlineButton className="w-auto px-6" onClick={handleClose} disabled={busy}>
              Close Event
            </OutlineButton>
          )}
        </div>

        {(event.invitations ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">No schools invited yet.</p>
        ) : (
          <div className="space-y-2">
            {event.invitations!.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="text-text-primary">{inv.invitedAcademy?.name}</span>
                <StatusPill
                  tone={inv.status === "accepted" ? "success" : inv.status === "declined" ? "danger" : "warning"}
                >
                  {inv.status}
                </StatusPill>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3">
          <SelectField label="Invite a member school" value={inviteAcademyId} onChange={(e) => setInviteAcademyId(e.target.value)}>
            <option value="">Select a school…</option>
            {invitableSchools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <PrimaryButton className="w-auto px-6" onClick={handleInvite} disabled={busy || !inviteAcademyId}>
            Invite
          </PrimaryButton>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>
    </div>
  );
}
