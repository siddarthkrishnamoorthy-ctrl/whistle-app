"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, EmptyState, Field, Table, ToggleSwitch } from "@/components/ui";
import type { InterschoolSettings, MemberSchool } from "@/lib/types";

export default function MemberSchoolsPage() {
  const { data: schools, loading, error } = useApiList<MemberSchool>("/interschool/member-schools");
  const [settings, setSettings] = useState<InterschoolSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiJson<InterschoolSettings>("/interschool/settings").then(setSettings);
  }, []);

  async function toggleOptIn() {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await apiJson<InterschoolSettings>("/interschool/settings", {
        method: "PATCH",
        body: JSON.stringify({ networkOptIn: !settings.networkOptIn }),
      });
      setSettings(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update network opt-in.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleReliabilityScore() {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await apiJson<InterschoolSettings>("/interschool/settings/reliability-score", {
        method: "PATCH",
        body: JSON.stringify({ showReliabilityScore: !settings.showReliabilityScore }),
      });
      setSettings(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update reliability score setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Member Schools</h1>
        <p className="text-sm text-text-secondary">Academies opted into the Interschool Network</p>
      </div>

      <Card className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-text-primary">Your academy's network participation</div>
          <div className="text-xs text-text-secondary">
            {settings?.networkOptIn ? "Enabled — visible to other schools" : "Disabled — hidden from other schools"}
          </div>
        </div>
        <ToggleSwitch
          checked={Boolean(settings?.networkOptIn)}
          onChange={toggleOptIn}
          disabled={saving || !settings}
          tone="admin"
        />
      </Card>

      <Card className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-text-primary">Show numeric reliability score</div>
          <div className="text-xs text-text-secondary">
            Additive to the Low/Medium/High confidence badge — a percentage based on matches played and recency.
          </div>
        </div>
        <ToggleSwitch
          checked={Boolean(settings?.showReliabilityScore)}
          onChange={toggleReliabilityScore}
          disabled={saving || !settings}
          tone="admin"
        />
      </Card>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {schools.length > 0 && (
        <Field
          label=""
          placeholder="Search schools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      )}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : schools.length === 0 ? (
        <Card>
          <EmptyState message="No other schools have opted into the network yet." />
        </Card>
      ) : (
        <Table columns={["School", "Centers", "School Ratings"]}>
          {schools
            .filter((s) => !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase()))
            .map((s) => (
            <tr key={s.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3 font-medium text-text-primary">{s.name}</td>
              <td className="px-4 py-3 text-text-secondary">{s.centers.map((c) => c.name).join(", ") || "—"}</td>
              <td className="px-4 py-3 text-text-secondary">
                {s.schoolRatings.length > 0
                  ? s.schoolRatings.map((r) => `${r.sportKey}: ${r.aggregateRating ?? "—"}`).join(", ")
                  : "—"}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
