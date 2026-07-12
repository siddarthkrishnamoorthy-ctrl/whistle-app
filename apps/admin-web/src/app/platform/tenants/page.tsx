"use client";

// Tenants — every school/academy on Whistle. Search, onboard (with branding:
// name, font, logo), and manage each tenant: allowance, billing mode,
// declared strength, sport access grant, branding, suspension.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Building2, CheckCircle2, ChevronDown, ChevronUp, IndianRupee, ReceiptText, Search, Users } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Card, Field, PrimaryButton, SelectField } from "@/components/ui";
import { Modal, ModalFooter } from "@/components/modal";
import { brandFont, brandLogoSrc, FONT_OPTIONS } from "@/components/tenant-brand";
import { inr, PageHeader, SUB_STATUS_TONE, type Tenant } from "../platform-ui";

interface Sport {
  key: string;
  name: string;
}

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiJson<Tenant[]>("/platform/tenants").then(setTenants).catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
    apiJson<Sport[]>("/sports").then(setSports).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? tenants.filter((t) => t.name.toLowerCase().includes(q) || (t.contactEmail ?? "").toLowerCase().includes(q)) : tenants;
  }, [tenants, search]);

  const totalStudents = tenants.reduce((s, t) => s + t.counts.clients, 0);
  const totalCenters = tenants.reduce((s, t) => s + t.counts.centers, 0);
  const collected = tenants.reduce((s, t) => s + t.revenue.collected, 0);
  const activeSubs = tenants.filter((t) => t.subscription?.status === "active" || t.subscription?.status === "trial").length;
  const suspended = tenants.filter((t) => t.suspended).length;

  const stats = [
    { label: "Academies & Schools", value: String(tenants.length), sub: `${suspended} suspended`, icon: Building2, chip: "bg-sky-400/15 text-sky-300" },
    { label: "Students", value: totalStudents.toLocaleString("en-IN"), sub: `${totalCenters} centers`, icon: Users, chip: "bg-emerald-400/15 text-emerald-300" },
    { label: "Active subscriptions", value: String(activeSubs), sub: `of ${tenants.length}`, icon: CheckCircle2, chip: "bg-violet-400/15 text-violet-300" },
    { label: "Revenue collected", value: inr(collected), sub: "lifetime", icon: IndianRupee, chip: "bg-amber-400/15 text-amber-300" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academies & Schools"
        subtitle="Every academy and school on Whistle — onboard, brand, meter and manage."
        action={
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
          >
            + Onboard Academy / School
          </button>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
              <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${s.chip}`}>
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </div>
              <div className="text-xl font-bold text-text-primary">{s.value}</div>
              <div className="text-xs font-medium text-text-secondary">{s.label}</div>
              <div className="text-[11px] text-text-muted">{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-muted" strokeWidth={1.8} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search academies & schools…"
          className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60"
        />
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      <div className="space-y-3">
        {visible.map((t) => (
          <TenantCard
            key={t.id}
            tenant={t}
            sports={sports}
            expanded={expandedId === t.id}
            onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
            onChanged={load}
          />
        ))}
        {visible.length === 0 && (
          <Card className="p-8 text-center text-sm text-text-secondary">
            {tenants.length === 0 ? "No academies yet — onboard the first school or academy." : "Nothing matches your search."}
          </Card>
        )}
      </div>

      <CreateTenantModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          load();
        }}
      />
    </div>
  );
}

// ─── Tenant card with expandable manage panel ────────────────────────────────

function TenantCard({
  tenant: t,
  sports,
  expanded,
  onToggle,
  onChanged,
}: {
  tenant: Tenant;
  sports: Sport[];
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const logo = brandLogoSrc(t.brandTheme?.logoUrl);

  async function patch(body: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await apiJson(`/platform/tenants/${t.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function patchSubscription(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await apiJson(`/platform/tenants/${t.id}/subscription`, { method: "PATCH", body: JSON.stringify(body) });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function closePeriod() {
    if (!window.confirm(`Close the current billing period for ${t.name}? This raises their next platform invoice.`)) return;
    setBusy(true);
    try {
      await apiJson(`/platform/tenants/${t.id}/close-period`, { method: "POST" });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Period close failed.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiJson(`/platform/tenants/${t.id}/logo`, { method: "POST", body: form });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Logo upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggleSport(key: string) {
    const current = new Set(t.allowedSports);
    if (current.has(key)) current.delete(key);
    else current.add(key);
    patch({ allowedSports: [...current] });
  }

  const chipCls = "flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.04] px-2.5 py-1.5 text-xs text-text-secondary";

  return (
    <div className={`rounded-lg border ${t.suspended ? "border-danger/40 bg-danger/[0.06]" : "border-border bg-surface"}`}>
      <button onClick={onToggle} className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left">
        <div className="flex items-center gap-3">
          {logo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logo} alt="" className="h-10 w-10 rounded-xl border border-border object-contain" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-bold text-text-secondary">
              {t.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-text-primary" style={{ fontFamily: brandFont(t.brandTheme?.fontKey) }}>
                {t.brandTheme?.displayName || t.name}
              </span>
              {t.suspended && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger">SUSPENDED</span>}
              {t.subscription && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SUB_STATUS_TONE[t.subscription.status] ?? "bg-white/10 text-text-secondary"}`}>
                  {t.subscription.tier ?? "no tier"} · {t.subscription.status.replace("_", " ")}
                </span>
              )}
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-text-secondary">
                {t.allowedSports.length === 0 ? "All sports" : `${t.allowedSports.length} sports`}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {t.counts.clients} students · {t.counts.users} users · {t.counts.schools} schools · {t.counts.centers} centers
              {" · "}
              <span className="text-emerald-300">{inr(t.revenue.collected)} collected</span>
              {t.revenue.outstanding > 0 && <span className="text-amber-300"> · {inr(t.revenue.outstanding)} pending</span>}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-xs font-semibold text-accent">
          Manage {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 border-t border-border/60 p-5 lg:grid-cols-2">
          {/* Access & billing */}
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Access &amp; billing</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className={chipCls}>
                  Student allowance
                  <input
                    type="number"
                    min={0}
                    defaultValue={t.studentAllowance ?? ""}
                    placeholder={String(t.subscription?.declaredStrength ?? "—")}
                    onBlur={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      if (v !== t.studentAllowance) patch({ studentAllowance: v });
                    }}
                    className="w-16 bg-transparent text-right font-semibold text-text-primary outline-none"
                  />
                </label>
                <SelectField
                  compact
                  label=""
                  value={t.allowanceMode}
                  onChange={(e) => patch({ allowanceMode: e.target.value })}
                  disabled={busy}
                  className="w-auto"
                  title="hard = block the N+1th student · true-up = allow growth, bill the real count"
                >
                  <option value="true_up">True-up billing</option>
                  <option value="hard">Hard cap</option>
                </SelectField>
                {t.subscription && (
                  <label className={chipCls}>
                    Declared strength
                    <input
                      type="number"
                      min={1}
                      defaultValue={t.subscription.declaredStrength}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && v !== t.subscription!.declaredStrength) patchSubscription({ declaredStrength: v });
                      }}
                      className="w-16 bg-transparent text-right font-semibold text-text-primary outline-none"
                    />
                  </label>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={closePeriod}
                  disabled={busy}
                  className="rounded-lg border border-border bg-white/[0.04] px-3 py-1.5 text-xs text-text-secondary hover:border-accent/50 hover:text-accent disabled:opacity-50"
                >
                  <ReceiptText className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.8} /> Close billing period
                </button>
                <button
                  onClick={() =>
                    patch(
                      { suspended: !t.suspended },
                      t.suspended ? undefined : `Suspend ${t.name}? Every user of this tenant is locked out until reinstated.`
                    )
                  }
                  disabled={busy}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                    t.suspended
                      ? "border border-emerald-400/50 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                      : "border border-danger/50 bg-danger/10 text-danger hover:bg-danger/20"
                  }`}
                >
                  {t.suspended ? (
                    <>
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.8} /> Reinstate
                    </>
                  ) : (
                    <>
                      <Ban className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.8} /> Suspend
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Sport access — {t.allowedSports.length === 0 ? "all sports" : `${t.allowedSports.length} granted`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sports.map((s) => {
                  const explicit = t.allowedSports.includes(s.key);
                  const granted = t.allowedSports.length === 0 || explicit;
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleSport(s.key)}
                      disabled={busy}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                        explicit
                          ? "border-accent/60 bg-accent/15 text-accent"
                          : granted
                            ? "border-border bg-white/[0.04] text-text-secondary hover:border-accent/40"
                            : "border-border bg-transparent text-text-muted opacity-60 hover:opacity-100"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
                {t.allowedSports.length > 0 && (
                  <button
                    onClick={() => patch({ allowedSports: [] })}
                    disabled={busy}
                    className="rounded-full border border-border px-3 py-1 text-xs text-text-muted hover:text-text-primary"
                  >
                    Reset to all
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-text-muted">
                Granted sports drive their dropdowns, drill views and lesson-plan repository.
              </p>
            </div>
          </div>

          {/* Branding */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Branding — shown top-right for their admins, coaches &amp; parents
            </p>
            <div className="space-y-2">
              <Field
                label="Display name"
                defaultValue={t.brandTheme?.displayName ?? ""}
                placeholder={t.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (t.brandTheme?.displayName ?? "")) patch({ brandTheme: { displayName: v } });
                }}
              />
              <SelectField label="Font" value={t.brandTheme?.fontKey ?? "default"} onChange={(e) => patch({ brandTheme: { fontKey: e.target.value } })}>
                {FONT_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </SelectField>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer rounded-lg border border-border bg-white/[0.04] px-3 py-2 text-xs text-text-secondary hover:border-accent/50 hover:text-accent">
                  {t.brandTheme?.logoUrl ? "Replace logo" : "Upload logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadLogo(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-text-muted">Preview:</span>
                <span
                  className="rounded-lg border border-border bg-white/[0.04] px-3 py-1.5 text-sm font-bold text-text-primary"
                  style={{ fontFamily: brandFont(t.brandTheme?.fontKey) }}
                >
                  {t.brandTheme?.displayName || t.name}
                </span>
                {logo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logo} alt="logo" className="h-9 w-9 rounded-lg border border-border object-contain" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Onboard modal (identity + admin + access + branding in one flow) ────────

function CreateTenantModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    contactEmail: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    studentAllowance: "",
    allowanceMode: "true_up",
    displayName: "",
    fontKey: "default",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.name.trim() || !form.adminName.trim() || !form.adminEmail.trim() || form.adminPassword.length < 6) {
      setError("Tenant name, admin name, email and a 6+ character password are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await apiJson<{ academy: { id: string } }>("/platform/tenants", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          contactEmail: form.contactEmail || undefined,
          adminName: form.adminName,
          adminEmail: form.adminEmail,
          adminPassword: form.adminPassword,
          studentAllowance: form.studentAllowance ? Number(form.studentAllowance) : undefined,
          declaredStrength: form.studentAllowance ? Number(form.studentAllowance) : undefined,
          allowanceMode: form.allowanceMode,
        }),
      });
      // Branding rides along in the same flow: font/display name first, then
      // the logo (which needs the freshly created tenant id).
      if (form.displayName.trim() || form.fontKey !== "default") {
        await apiJson(`/platform/tenants/${created.academy.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            brandTheme: {
              ...(form.displayName.trim() ? { displayName: form.displayName.trim() } : {}),
              fontKey: form.fontKey,
            },
          }),
        });
      }
      if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        await apiJson(`/platform/tenants/${created.academy.id}/logo`, { method: "POST", body: fd });
      }
      setForm({ name: "", contactEmail: "", adminName: "", adminEmail: "", adminPassword: "", studentAllowance: "", allowanceMode: "true_up", displayName: "", fontKey: "default" });
      setLogoFile(null);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the tenant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Onboard a school or academy"
      subtitle="Creates the tenant, their admin login, and their branding in one go."
      wide
      footer={<ModalFooter onCancel={onClose} onSubmit={submit} submitLabel="Create tenant" submitting={saving} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="School / academy name *" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sunrise International" />
        <Field label="Contact email" type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="office@school.com" />
        <Field label="Their admin's name *" value={form.adminName} onChange={(e) => set("adminName", e.target.value)} />
        <Field label="Admin login email *" type="email" value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} />
        <Field label="Admin password *" type="password" value={form.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} placeholder="min 6 characters" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Student allowance" type="number" min={1} value={form.studentAllowance} onChange={(e) => set("studentAllowance", e.target.value)} placeholder="e.g. 200" />
          <SelectField label="Billing mode" value={form.allowanceMode} onChange={(e) => set("allowanceMode", e.target.value)}>
            <option value="true_up">True-up</option>
            <option value="hard">Hard cap</option>
          </SelectField>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white/[0.03] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Branding — name, font &amp; logo shown across their apps
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Display name"
            value={form.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder={form.name || "Defaults to the tenant name"}
          />
          <SelectField label="Font" value={form.fontKey} onChange={(e) => set("fontKey", e.target.value)}>
            {FONT_OPTIONS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-border bg-white/[0.04] px-3 py-2 text-xs text-text-secondary hover:border-accent/50 hover:text-accent">
            {logoFile ? `Logo: ${logoFile.name}` : "Choose logo image…"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <span className="text-xs text-text-muted">Preview:</span>
          <span className="rounded-lg border border-border bg-white/[0.04] px-3 py-1.5 text-sm font-bold text-text-primary" style={{ fontFamily: brandFont(form.fontKey) }}>
            {form.displayName || form.name || "School name"}
          </span>
          {logoFile && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={URL.createObjectURL(logoFile)} alt="logo preview" className="h-9 w-9 rounded-lg border border-border object-contain" />
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-text-muted">The admin you create owns the tenant — they log in and see only their school/academy.</p>
    </Modal>
  );
}
