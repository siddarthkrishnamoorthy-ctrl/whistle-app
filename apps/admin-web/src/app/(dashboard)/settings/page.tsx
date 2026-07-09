"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, Field, PrimaryButton, SelectField, Tabs, ToggleSwitch } from "@/components/ui";
import type { AcademySettings } from "@/lib/types";
import { SubscriptionTab } from "./subscription-tab";

type Tab = "general" | "policies" | "subscription";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<AcademySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [deductOnAbsence, setDeductOnAbsence] = useState("never");
  const [priorNoticeHours, setPriorNoticeHours] = useState("0");
  const [allowMakeupSessions, setAllowMakeupSessions] = useState(true);
  const [lessonPlanAssignmentMode, setLessonPlanAssignmentMode] = useState<"calendar" | "grade_sequence">("calendar");

  useEffect(() => {
    apiJson<AcademySettings>("/settings")
      .then((data) => {
        setSettings(data);
        setName(data.name ?? "");
        setContactEmail(data.contactEmail ?? "");
        setPhone(data.phone ?? "");
        setWebsite(data.website ?? "");
        setDeductOnAbsence(data.settings?.policies?.deductOnAbsence ?? "never");
        setPriorNoticeHours(String(data.settings?.policies?.priorNoticeHours ?? 0));
        setAllowMakeupSessions(data.settings?.policies?.allowMakeupSessions ?? true);
        setLessonPlanAssignmentMode(
          (data.settings as { lessonPlanAssignmentMode?: "calendar" | "grade_sequence" } | null)
            ?.lessonPlanAssignmentMode ?? "calendar"
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load settings."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const dto =
        tab === "general"
          ? { name, contactEmail, phone, website }
          : {
              policies: {
                deductOnAbsence,
                priorNoticeHours: Number(priorNoticeHours),
                allowMakeupSessions,
              },
              lessonPlanAssignmentMode,
            };
      await apiJson("/settings", { method: "PATCH", body: JSON.stringify(dto) });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error && !settings) return <p className="text-sm text-danger">{error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-text-secondary">Academy configuration</p>
      </div>

      <Tabs
        tabs={[
          { key: "general", label: "General" },
          { key: "policies", label: "Policies" },
          { key: "subscription", label: "Whistle Subscription" },
        ]}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setSaved(false);
        }}
      />

      {tab === "general" && (
        <Card className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Academy name" value={name} onChange={(e) => setName(e.target.value)} />
            <Field
              label="Contact email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Field label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
        </Card>
      )}

      {tab === "policies" && (
        <Card className="space-y-4">
          <SelectField
            label="Deduct session on absence"
            value={deductOnAbsence}
            onChange={(e) => setDeductOnAbsence(e.target.value)}
          >
            <option value="never">Never</option>
            <option value="always">Always</option>
            <option value="afterNoticeWindow">After notice window</option>
          </SelectField>
          <Field
            label="Prior notice required (hours)"
            type="number"
            min={0}
            value={priorNoticeHours}
            onChange={(e) => setPriorNoticeHours(e.target.value)}
          />
          <ToggleSwitch
            label="Allow makeup sessions"
            checked={allowMakeupSessions}
            onChange={setAllowMakeupSessions}
            tone="admin"
          />
          <SelectField
            label="Lesson plan assignment for coaches"
            value={lessonPlanAssignmentMode}
            onChange={(e) => setLessonPlanAssignmentMode(e.target.value as "calendar" | "grade_sequence")}
          >
            <option value="calendar">Via scheduled class calendar</option>
            <option value="grade_sequence">Grade-wise sequential curriculum</option>
          </SelectField>
          <p className="text-xs text-text-muted">
            Controls what coaches see in their app's Lessons tab: lesson plans attached to each scheduled session, or
            the grade-wise curriculum sequence you define under Curriculum.
          </p>
        </Card>
      )}

      {tab === "subscription" && <SubscriptionTab />}

      {tab !== "subscription" && error && <p className="text-sm text-danger">{error}</p>}
      {tab !== "subscription" && saved && <p className="text-sm text-success">Saved.</p>}

      {tab !== "subscription" && (
        <PrimaryButton className="w-auto px-6" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </PrimaryButton>
      )}
    </div>
  );
}
