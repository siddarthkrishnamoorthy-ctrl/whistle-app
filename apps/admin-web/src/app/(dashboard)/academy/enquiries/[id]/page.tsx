"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, PrimaryButton, SelectField, StatusPill } from "@/components/ui";
import type { Enquiry, Plan, WhistleClass } from "@/lib/types";

const TEMP_TONE = { hot: "danger", warm: "warning", cold: "info" } as const;

export default function EnquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [planId, setPlanId] = useState("");
  const [classId, setClassId] = useState("");
  const { data: plans } = useApiList<Plan>("/plans");
  const { data: classes } = useApiList<WhistleClass>("/classes");

  async function load() {
    setLoading(true);
    try {
      const data = await apiJson<Enquiry>(`/enquiries/${id}`);
      setEnquiry(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load enquiry.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleConvert() {
    if (!planId || !classId) {
      alert("Select a plan and a class first.");
      return;
    }
    setConverting(true);
    try {
      const client = await apiJson<{ id: string }>(`/enquiries/${id}/convert`, {
        method: "POST",
        body: JSON.stringify({ planId, classId }),
      });
      router.push(`/academy/clients/${client.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not convert enquiry.");
    } finally {
      setConverting(false);
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !enquiry) return <p className="text-sm text-danger">{error ?? "Enquiry not found."}</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/academy/enquiries" className="text-sm text-text-secondary hover:text-accent">
          ← Enquiries
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{enquiry.name}</h1>
        <p className="text-sm text-text-secondary">Enquiry · {enquiry.stage}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusPill tone={TEMP_TONE[enquiry.status]}>{enquiry.status}</StatusPill>
          </div>
          <div className="text-sm text-text-secondary">{enquiry.email ?? "No email"}</div>
          <div className="text-sm text-text-secondary">{enquiry.phone ?? "No phone"}</div>
          <div className="text-sm text-text-secondary">
            {enquiry.sport?.name ?? "—"} · {enquiry.level ?? "—"}
          </div>
          <div className="text-sm text-text-secondary">Assigned to {enquiry.assignedStaff?.name ?? "Unassigned"}</div>
          <div className="text-sm text-text-secondary">
            Follow-up {enquiry.followUpDate ? enquiry.followUpDate.slice(0, 10) : "—"}
          </div>
          {enquiry.note && (
            <div className="mt-2 rounded-md border border-border bg-surface-alt p-3 text-sm text-text-secondary">
              {enquiry.note}
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Activity &amp; follow-ups</h2>
          <div className="space-y-2">
            {enquiry.activityLog.length === 0 && <p className="text-sm text-text-secondary">No activity yet.</p>}
            {enquiry.activityLog.map((entry, i) => (
              <div key={i} className="border-l-2 border-border pl-3 text-sm">
                <div className="text-text-primary">{entry.text}</div>
                <div className="text-xs text-text-muted">{new Date(entry.at).toLocaleString("en-IN")}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {enquiry.stage !== "closed" && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Convert to client</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectField label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Plan…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </SelectField>
            <SelectField label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </SelectField>
            <div className="flex items-end">
              <PrimaryButton onClick={handleConvert} disabled={converting}>
                {converting ? "Converting…" : "✓ Convert to client"}
              </PrimaryButton>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
