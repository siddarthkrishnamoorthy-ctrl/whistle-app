"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, OutlineButton } from "@/components/ui";
import type { WhatsappSettings } from "@/lib/types";

const TOGGLES: { key: keyof WhatsappSettings; label: string; description: string }[] = [
  {
    key: "automatedReminders",
    label: "Automated Reminders",
    description: "Session and renewal reminders sent automatically via WhatsApp.",
  },
  {
    key: "invoiceGenerationAlerts",
    label: "Invoice Generation Alerts",
    description: "Notify clients by WhatsApp when a new invoice is raised.",
  },
  {
    key: "classCancellationNotices",
    label: "Class Cancellation Notices",
    description: "Alert affected clients when a class or session is cancelled.",
  },
];

export function WhatsappTab() {
  const [settings, setSettings] = useState<WhatsappSettings | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    apiJson<WhatsappSettings>("/communication/whatsapp-settings").then(setSettings);
  }, []);

  async function toggle(key: keyof WhatsappSettings) {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSaving(key);
    try {
      await apiJson("/communication/whatsapp-settings", { method: "PATCH", body: JSON.stringify({ [key]: next[key] }) });
    } catch (err) {
      setSettings(settings);
      alert(err instanceof Error ? err.message : "Could not update setting.");
    } finally {
      setSaving(null);
    }
  }

  if (!settings) return <p className="text-sm text-text-secondary">Loading…</p>;

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <h3 className="font-semibold text-text-primary">Automated transactional messaging</h3>
        {TOGGLES.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-4 border-b border-border pb-4 last:border-0 last:pb-0">
            <div>
              <div className="text-sm font-medium text-text-primary">{t.label}</div>
              <div className="text-xs text-text-secondary">{t.description}</div>
            </div>
            <button
              onClick={() => toggle(t.key)}
              disabled={saving === t.key}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                settings[t.key] ? "bg-accent" : "bg-surface-alt"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                  settings[t.key] ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </Card>

      <Card className="space-y-2">
        <h3 className="font-semibold text-text-primary">WhatsApp Business API</h3>
        <p className="text-sm text-text-secondary">
          Connect your WhatsApp Business API credentials to send the messages above. Not yet configured.
        </p>
        <OutlineButton className="w-auto px-6" disabled>
          Configure WhatsApp API
        </OutlineButton>
      </Card>
    </div>
  );
}
