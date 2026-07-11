"use client";

// Whistle operator console (2026-07): the platform company's own dashboard.
// Cross-tenant by design — every school/academy on Whistle, their student
// counts, allowances, subscriptions, suspension and platform revenue. Only
// the seeded platform_owner role can load any of this data.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Building2,
  CheckCircle2,
  IndianRupee,
  Plus,
  ReceiptText,
  School,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";

interface Tenant {
  id: string;
  name: string;
  contactEmail: string | null;
  createdAt: string;
  suspended: boolean;
  studentAllowance: number | null;
  allowanceMode: string;
  counts: { clients: number; users: number; schools: number; centers: number };
  subscription: {
    id: string;
    status: string;
    declaredStrength: number;
    billingCycle: string;
    tier: string | null;
    pricePerStudentMonth: string | null;
    currentPeriodEnd: string;
  } | null;
  revenue: { collected: number; outstanding: number };
}

interface Revenue {
  tenants: number;
  students: number;
  schools: number;
  suspended: number;
  subscriptionsByStatus: Record<string, number>;
  invoiced: number;
  collected: number;
  outstanding: number;
}

interface PlatformInvoice {
  id: string;
  amount: string;
  status: string;
  issuedAt: string;
  billableStudentCount: number;
  academy: { id: string; name: string };
}

function inr(n: number | string) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN")}`;
}

const SUB_STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-400/15 text-emerald-300",
  trial: "bg-sky-400/15 text-sky-300",
  past_due: "bg-amber-400/15 text-amber-300",
  cancelled: "bg-rose-400/15 text-rose-300",
  pending_quote: "bg-violet-400/15 text-violet-300",
};

export default function PlatformConsolePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAllInvoices, setShowAllInvoices] = useState(false);

  const load = useCallback(() => {
    apiJson<Tenant[]>("/platform/tenants").then(setTenants).catch((e) => setError(e instanceof Error ? e.message : "Failed to load tenants."));
    apiJson<Revenue>("/platform/revenue").then(setRevenue).catch(() => {});
    apiJson<PlatformInvoice[]>("/platform/invoices").then(setInvoices).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role !== "platform_owner") router.replace("/dashboard");
    if (!loading && user?.role === "platform_owner") load();
  }, [loading, user, router, load]);

  if (loading || !user || user.role !== "platform_owner") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-secondary">Loading Whistle…</p>
      </div>
    );
  }

  async function patchTenant(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await apiJson(`/platform/tenants/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function patchSubscription(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await apiJson(`/platform/tenants/${id}/subscription`, { method: "PATCH", body: JSON.stringify(body) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function closePeriod(t: Tenant) {
    if (!window.confirm(`Close the current billing period for ${t.name}? This raises their next platform invoice (true-up on actual students).`)) return;
    setBusyId(t.id);
    try {
      await apiJson(`/platform/tenants/${t.id}/close-period`, { method: "POST" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Period close failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function markInvoicePaid(id: string) {
    setBusyId(id);
    try {
      await apiJson(`/platform/invoices/${id}/mark-paid`, { method: "POST" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not mark paid.");
    } finally {
      setBusyId(null);
    }
  }

  const tiles = revenue
    ? [
        { label: "Tenants on Whistle", value: String(revenue.tenants), sub: `${revenue.suspended} suspended`, icon: Building2, chip: "bg-sky-400/15 text-sky-300" },
        { label: "Students across tenants", value: revenue.students.toLocaleString("en-IN"), sub: `${revenue.schools} schools`, icon: Users, chip: "bg-emerald-400/15 text-emerald-300" },
        { label: "Platform revenue collected", value: inr(revenue.collected), sub: `of ${inr(revenue.invoiced)} invoiced`, icon: IndianRupee, chip: "bg-amber-400/15 text-amber-300" },
        { label: "Outstanding", value: inr(revenue.outstanding), sub: "pending platform invoices", icon: ReceiptText, chip: "bg-rose-400/15 text-rose-300" },
      ]
    : [];

  const visibleInvoices = showAllInvoices ? invoices : invoices.slice(0, 6);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-white/[0.03] px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/whistle-logo.png" alt="Whistle" className="h-9 w-auto" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-accent">Whistle</span>
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                Platform operator
              </span>
            </div>
            <div className="text-[11px] text-text-muted">Every school &amp; academy on Whistle</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={1.8} /> {user.name}
          </span>
          <button
            onClick={() => signOut().then(() => router.replace("/login"))}
            className="text-xs text-text-secondary hover:text-danger"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {error && <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

        {/* Revenue overview */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.label} className="rounded-2xl border border-border bg-white/[0.04] p-5">
                <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${t.chip}`}>
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                </div>
                <div className="text-2xl font-bold text-text-primary">{t.value}</div>
                <div className="text-sm font-medium text-text-secondary">{t.label}</div>
                <div className="mt-0.5 text-xs text-text-muted">{t.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Tenants */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Tenants · {tenants.length}
            </h2>
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} /> New tenant
            </button>
          </div>

          {showCreate && (
            <CreateTenantCard
              onDone={() => {
                setShowCreate(false);
                load();
              }}
              onCancel={() => setShowCreate(false)}
            />
          )}

          {tenants.map((t) => (
            <div key={t.id} className={`rounded-2xl border p-5 ${t.suspended ? "border-danger/40 bg-danger/[0.06]" : "border-border bg-white/[0.04]"}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-text-primary">{t.name}</span>
                    {t.suspended && (
                      <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger">SUSPENDED</span>
                    )}
                    {t.subscription && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SUB_STATUS_TONE[t.subscription.status] ?? "bg-white/10 text-text-secondary"}`}>
                        {t.subscription.tier ?? "no tier"} · {t.subscription.status.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    <Users className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.8} />
                    {t.counts.clients} students · {t.counts.users} users ·{" "}
                    <School className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.8} />
                    {t.counts.schools} schools · {t.counts.centers} centers
                    {t.contactEmail ? ` · ${t.contactEmail}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Platform revenue: <span className="text-emerald-300">{inr(t.revenue.collected)} collected</span>
                    {t.revenue.outstanding > 0 && <span className="text-amber-300"> · {inr(t.revenue.outstanding)} pending</span>}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.04] px-2.5 py-1.5 text-xs text-text-secondary">
                    Allowance
                    <input
                      type="number"
                      min={0}
                      defaultValue={t.studentAllowance ?? ""}
                      placeholder={String(t.subscription?.declaredStrength ?? "—")}
                      onBlur={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (v !== t.studentAllowance) patchTenant(t.id, { studentAllowance: v });
                      }}
                      className="w-16 bg-transparent text-right font-semibold text-text-primary outline-none"
                    />
                  </label>
                  <select
                    value={t.allowanceMode}
                    onChange={(e) => patchTenant(t.id, { allowanceMode: e.target.value })}
                    disabled={busyId === t.id}
                    className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary"
                    title="hard = block the N+1th student · true-up = allow growth, bill the real count"
                  >
                    <option value="true_up">True-up billing</option>
                    <option value="hard">Hard cap</option>
                  </select>
                  {t.subscription && (
                    <label className="flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.04] px-2.5 py-1.5 text-xs text-text-secondary">
                      Declared
                      <input
                        type="number"
                        min={1}
                        defaultValue={t.subscription.declaredStrength}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v > 0 && v !== t.subscription!.declaredStrength) patchSubscription(t.id, { declaredStrength: v });
                        }}
                        className="w-16 bg-transparent text-right font-semibold text-text-primary outline-none"
                      />
                    </label>
                  )}
                  <button
                    onClick={() => closePeriod(t)}
                    disabled={busyId === t.id}
                    className="rounded-lg border border-border bg-white/[0.04] px-3 py-1.5 text-xs text-text-secondary hover:border-accent/50 hover:text-accent disabled:opacity-50"
                    title="Raise this period's platform invoice (true-up on actual students)"
                  >
                    <ReceiptText className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.8} />
                    Close period
                  </button>
                  <button
                    onClick={() => {
                      if (t.suspended || window.confirm(`Suspend ${t.name}? Every user of this tenant is locked out until reinstated.`))
                        patchTenant(t.id, { suspended: !t.suspended });
                    }}
                    disabled={busyId === t.id}
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
            </div>
          ))}
          {tenants.length === 0 && (
            <div className="rounded-2xl border border-border bg-white/[0.04] p-8 text-center text-sm text-text-secondary">
              No tenants yet — create the first school or academy above.
            </div>
          )}
        </section>

        {/* Platform invoices */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Platform invoices · {invoices.length}
          </h2>
          {visibleInvoices.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white/[0.04] px-4 py-3">
              <div>
                <span className="font-semibold text-text-primary">{inv.academy.name}</span>
                <span className="ml-2 text-xs text-text-secondary">
                  {inv.issuedAt.slice(0, 10)} · {inv.billableStudentCount} billable students
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-text-primary">{inr(inv.amount)}</span>
                {inv.status === "paid" ? (
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">paid</span>
                ) : (
                  <button
                    onClick={() => markInvoicePaid(inv.id)}
                    disabled={busyId === inv.id}
                    className="rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/25 disabled:opacity-50"
                  >
                    Mark paid
                  </button>
                )}
              </div>
            </div>
          ))}
          {invoices.length > 6 && (
            <button onClick={() => setShowAllInvoices((v) => !v)} className="text-xs font-semibold text-accent hover:underline">
              {showAllInvoices ? "Show fewer" : `View all ${invoices.length} invoices`}
            </button>
          )}
          {invoices.length === 0 && (
            <div className="rounded-xl border border-border bg-white/[0.04] p-6 text-center text-sm text-text-secondary">
              No platform invoices yet — use “Close period” on a tenant to raise one.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function CreateTenantCard({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: "",
    contactEmail: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    studentAllowance: "",
    allowanceMode: "true_up",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiJson("/platform/tenants", {
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
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the tenant.");
    } finally {
      setSaving(false);
    }
  }

  const input =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-accent/40 bg-accent/[0.06] p-5">
      <h3 className="mb-3 text-sm font-bold text-text-primary">Onboard a school or academy</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <input className={input} placeholder="School / academy name *" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        <input className={input} type="email" placeholder="Contact email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        <select className={input} value={form.allowanceMode} onChange={(e) => set("allowanceMode", e.target.value)}>
          <option value="true_up">True-up billing (grow freely)</option>
          <option value="hard">Hard cap (block over allowance)</option>
        </select>
        <input className={input} placeholder="Their admin's name *" value={form.adminName} onChange={(e) => set("adminName", e.target.value)} required />
        <input className={input} type="email" placeholder="Admin login email *" value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} required />
        <input className={input} type="password" placeholder="Admin password *" value={form.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} required minLength={6} />
        <input className={input} type="number" min={1} placeholder="Student allowance (e.g. 200)" value={form.studentAllowance} onChange={(e) => set("studentAllowance", e.target.value)} />
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={saving} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90 disabled:opacity-50">
          {saving ? "Creating…" : "Create tenant + admin"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-text-secondary hover:text-text-primary">
          Cancel
        </button>
      </div>
      <p className="mt-3 text-xs text-text-muted">
        The admin you create here owns the tenant — they log in on this console and see only their school/academy.
      </p>
    </form>
  );
}
