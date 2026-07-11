"use client";

// Whistle operator console v2 (2026-07): the platform company's own cockpit.
// Tabbed — Overview (revenue), Tenants (searchable list with per-tenant
// controls: allowance, billing mode, sport access grant, branding, suspend),
// Content Library (the Whistle-curated drill bank + lesson-plan repository
// tenants consume read-only), Tournaments & Events (platform-wide view of the
// shared competition features), Invoices. Only platform_owner can load it.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Flag,
  IndianRupee,
  Plus,
  ReceiptText,
  School,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { brandFont, brandLogoSrc, FONT_OPTIONS, type BrandTheme } from "@/components/tenant-brand";

interface Tenant {
  id: string;
  name: string;
  contactEmail: string | null;
  createdAt: string;
  suspended: boolean;
  studentAllowance: number | null;
  allowanceMode: string;
  allowedSports: string[];
  brandTheme: BrandTheme | null;
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

interface Sport {
  key: string;
  name: string;
}

interface PlatformDrill {
  id: string;
  title: string;
  sportKey: string;
  level: string | null;
  durationMin: number | null;
  description: string | null;
  equipment: string[];
  media: { videoUrl?: string } | null;
  sport: Sport;
}

interface PlatformPlan {
  id: string;
  title: string;
  sportKey: string | null;
  level: string | null;
  goals: string | null;
  targetDurationMin: number | null;
  sessionFlow: { drillId: string; drillTitle: string; durationMin: number }[];
  sport: Sport | null;
}

interface PlatformTournament {
  id: string;
  name: string;
  sports: string[];
  status: string;
  startDate: string;
  publicSlug: string;
  organizer: { name: string; email: string | null };
  _count: { events: number };
}

interface PlatformEvent {
  id: string;
  name: string;
  sports: string[];
  status: string;
  startDate: string;
  venue: string | null;
  hostAcademy: { id: string; name: string };
  _count: { fixtures: number; rosters: number };
}

type Tab = "overview" | "tenants" | "library" | "competitions" | "invoices";

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "overview", label: "Overview", icon: IndianRupee },
  { key: "tenants", label: "Tenants", icon: Building2 },
  { key: "library", label: "Content Library", icon: BookOpen },
  { key: "competitions", label: "Tournaments & Events", icon: Trophy },
  { key: "invoices", label: "Invoices", icon: ReceiptText },
];

const SUB_STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-400/15 text-emerald-300",
  trial: "bg-sky-400/15 text-sky-300",
  past_due: "bg-amber-400/15 text-amber-300",
  cancelled: "bg-rose-400/15 text-rose-300",
  pending_quote: "bg-violet-400/15 text-violet-300",
};

function inr(n: number | string) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN")}`;
}

const inputCls =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60";

export default function PlatformConsolePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiJson<Tenant[]>("/platform/tenants").then(setTenants).catch((e) => setError(e instanceof Error ? e.message : "Failed to load tenants."));
    apiJson<Revenue>("/platform/revenue").then(setRevenue).catch(() => {});
    apiJson<PlatformInvoice[]>("/platform/invoices").then(setInvoices).catch(() => {});
    apiJson<Sport[]>("/sports").then(setSports).catch(() => {});
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
          <a href="/rankings" className="text-xs text-text-secondary hover:text-accent">Public rankings ↗</a>
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={1.8} /> {user.name}
          </span>
          <button onClick={() => signOut().then(() => router.replace("/login"))} className="text-xs text-text-secondary hover:text-danger">
            Log out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="flex gap-1 overflow-x-auto border-b border-border bg-white/[0.02] px-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                active ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {error && <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

        {tab === "overview" && <OverviewTab revenue={revenue} invoices={invoices} tenants={tenants} />}
        {tab === "tenants" && <TenantsTab tenants={tenants} sports={sports} onChanged={load} />}
        {tab === "library" && <LibraryTab sports={sports} />}
        {tab === "competitions" && <CompetitionsTab />}
        {tab === "invoices" && <InvoicesTab invoices={invoices} onChanged={load} />}
      </main>
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({ revenue, invoices, tenants }: { revenue: Revenue | null; invoices: PlatformInvoice[]; tenants: Tenant[] }) {
  if (!revenue) return <p className="text-sm text-text-secondary">Loading…</p>;
  const tiles = [
    { label: "Tenants on Whistle", value: String(revenue.tenants), sub: `${revenue.suspended} suspended`, icon: Building2, chip: "bg-sky-400/15 text-sky-300" },
    { label: "Students across tenants", value: revenue.students.toLocaleString("en-IN"), sub: `${revenue.schools} schools`, icon: Users, chip: "bg-emerald-400/15 text-emerald-300" },
    { label: "Platform revenue collected", value: inr(revenue.collected), sub: `of ${inr(revenue.invoiced)} invoiced`, icon: IndianRupee, chip: "bg-amber-400/15 text-amber-300" },
    { label: "Outstanding", value: inr(revenue.outstanding), sub: "pending platform invoices", icon: ReceiptText, chip: "bg-rose-400/15 text-rose-300" },
  ];
  const topTenants = [...tenants].sort((a, b) => b.counts.clients - a.counts.clients).slice(0, 5);
  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white/[0.04] p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Largest tenants</h3>
          {topTenants.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
              <span className="text-sm font-medium text-text-primary">{t.name}</span>
              <span className="text-xs text-text-secondary">{t.counts.clients.toLocaleString("en-IN")} students</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-white/[0.04] p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Recent platform invoices</h3>
          {invoices.slice(0, 5).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
              <span className="text-sm text-text-primary">{inv.academy.name}</span>
              <span className="text-xs">
                <span className="font-semibold text-text-primary">{inr(inv.amount)}</span>{" "}
                <span className={inv.status === "paid" ? "text-emerald-300" : "text-amber-300"}>{inv.status}</span>
              </span>
            </div>
          ))}
          {invoices.length === 0 && <p className="text-sm text-text-secondary">None yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

function TenantsTab({ tenants, sports, onChanged }: { tenants: Tenant[]; sports: Sport[]; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? tenants.filter((t) => t.name.toLowerCase().includes(q) || (t.contactEmail ?? "").toLowerCase().includes(q)) : tenants;
  }, [tenants, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-muted" strokeWidth={1.8} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tenants.length} tenants…`}
            className={`${inputCls} w-72 pl-9`}
          />
        </div>
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
            onChanged();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {visible.map((t) => (
        <TenantCard
          key={t.id}
          tenant={t}
          sports={sports}
          expanded={expandedId === t.id}
          onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
          onChanged={onChanged}
        />
      ))}
      {visible.length === 0 && (
        <div className="rounded-2xl border border-border bg-white/[0.04] p-8 text-center text-sm text-text-secondary">
          {tenants.length === 0 ? "No tenants yet — create the first school or academy above." : "No tenants match your search."}
        </div>
      )}
    </div>
  );
}

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

  return (
    <div className={`rounded-2xl border ${t.suspended ? "border-danger/40 bg-danger/[0.06]" : "border-border bg-white/[0.04]"}`}>
      {/* Summary row — click to expand the manage panel */}
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
        <div className="space-y-4 border-t border-border/60 p-5">
          {/* Row 1: allowance + billing controls */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.04] px-2.5 py-1.5 text-xs text-text-secondary">
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
            <select
              value={t.allowanceMode}
              onChange={(e) => patch({ allowanceMode: e.target.value })}
              disabled={busy}
              className={`${inputCls} py-1.5 text-xs`}
              title="hard = block the N+1th student · true-up = allow growth, bill the real count"
            >
              <option value="true_up">True-up billing</option>
              <option value="hard">Hard cap</option>
            </select>
            {t.subscription && (
              <label className="flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.04] px-2.5 py-1.5 text-xs text-text-secondary">
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
            <button
              onClick={closePeriod}
              disabled={busy}
              className="rounded-lg border border-border bg-white/[0.04] px-3 py-1.5 text-xs text-text-secondary hover:border-accent/50 hover:text-accent disabled:opacity-50"
            >
              <ReceiptText className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.8} /> Close period
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

          {/* Row 2: sport access grant */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Sport access — {t.allowedSports.length === 0 ? "all sports (no restriction)" : `${t.allowedSports.length} granted`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sports.map((s) => {
                const granted = t.allowedSports.length === 0 || t.allowedSports.includes(s.key);
                const explicit = t.allowedSports.includes(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => toggleSport(s.key)}
                    disabled={busy}
                    title={t.allowedSports.length === 0 ? "Click to start restricting to specific sports" : undefined}
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
              Tenants only see granted sports in their dropdowns, drill views and the lesson-plan repository.
            </p>
          </div>

          {/* Row 3: branding — display name, font, logo */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Branding — shown top-right for their admins, coaches &amp; parents</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                defaultValue={t.brandTheme?.displayName ?? ""}
                placeholder={t.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (t.brandTheme?.displayName ?? "")) patch({ brandTheme: { displayName: v } });
                }}
                className={`${inputCls} w-64`}
              />
              <select
                value={t.brandTheme?.fontKey ?? "default"}
                onChange={(e) => patch({ brandTheme: { fontKey: e.target.value } })}
                disabled={busy}
                className={`${inputCls} text-xs`}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key}>
                    Font: {f.label}
                  </option>
                ))}
              </select>
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
              <span className="rounded-lg border border-border bg-white/[0.04] px-3 py-1.5 text-sm font-bold text-text-primary" style={{ fontFamily: brandFont(t.brandTheme?.fontKey) }}>
                {t.brandTheme?.displayName || t.name}
              </span>
              {logo && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logo} alt="logo" className="h-9 w-9 rounded-lg border border-border object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
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

  return (
    <form onSubmit={submit} className="rounded-2xl border border-accent/40 bg-accent/[0.06] p-5">
      <h3 className="mb-3 text-sm font-bold text-text-primary">Onboard a school or academy</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <input className={inputCls} placeholder="School / academy name *" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        <input className={inputCls} type="email" placeholder="Contact email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        <select className={inputCls} value={form.allowanceMode} onChange={(e) => set("allowanceMode", e.target.value)}>
          <option value="true_up">True-up billing (grow freely)</option>
          <option value="hard">Hard cap (block over allowance)</option>
        </select>
        <input className={inputCls} placeholder="Their admin's name *" value={form.adminName} onChange={(e) => set("adminName", e.target.value)} required />
        <input className={inputCls} type="email" placeholder="Admin login email *" value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} required />
        <input className={inputCls} type="password" placeholder="Admin password *" value={form.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} required minLength={6} />
        <input className={inputCls} type="number" min={1} placeholder="Student allowance (e.g. 200)" value={form.studentAllowance} onChange={(e) => set("studentAllowance", e.target.value)} />
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

// ─── Content Library ──────────────────────────────────────────────────────────

function LibraryTab({ sports }: { sports: Sport[] }) {
  const [drills, setDrills] = useState<PlatformDrill[]>([]);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [sportFilter, setSportFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNewDrill, setShowNewDrill] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);

  const load = useCallback(() => {
    apiJson<PlatformDrill[]>("/platform/drills").then(setDrills).catch(() => {});
    apiJson<PlatformPlan[]>("/platform/lesson-plans").then(setPlans).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const visibleDrills = sportFilter ? drills.filter((d) => d.sportKey === sportFilter) : drills;
  const visiblePlans = sportFilter ? plans.filter((p) => p.sportKey === sportFilter) : plans;

  async function del(kind: "drills" | "lesson-plans", id: string, label: string) {
    if (!window.confirm(`Delete "${label}" from the platform library? Tenants will stop seeing it.`)) return;
    setBusy(true);
    try {
      await apiJson(`/platform/${kind}/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3 text-xs text-text-secondary">
        This library is <span className="font-semibold text-accent">made by Whistle</span> — tenants can&apos;t author drills or
        repository plans; they view the lesson plans for their granted sports and adopt copies into their academies.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} className={inputCls}>
          <option value="">All sports</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewDrill((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent/15 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/25"
          >
            <Dumbbell className="h-4 w-4" strokeWidth={1.8} /> New drill
          </button>
          <button
            onClick={() => setShowNewPlan((v) => !v)}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
          >
            <BookOpen className="h-4 w-4" strokeWidth={1.8} /> New lesson plan
          </button>
        </div>
      </div>

      {showNewDrill && <NewDrillForm sports={sports} onDone={() => { setShowNewDrill(false); load(); }} onCancel={() => setShowNewDrill(false)} />}
      {showNewPlan && <NewPlanForm sports={sports} drills={drills} onDone={() => { setShowNewPlan(false); load(); }} onCancel={() => setShowNewPlan(false)} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            <Dumbbell className="mr-1 inline h-4 w-4" strokeWidth={1.8} /> Drill bank · {visibleDrills.length}
          </h3>
          <div className="space-y-2">
            {visibleDrills.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white/[0.04] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{d.title}</p>
                  <p className="text-xs text-text-secondary">
                    {d.sport?.name} {d.level ? `· ${d.level}` : ""} {d.durationMin ? `· ${d.durationMin} min` : ""}
                    {d.media?.videoUrl ? " · 🎬 video" : ""}
                  </p>
                  {d.description && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{d.description}</p>}
                </div>
                <button onClick={() => del("drills", d.id, d.title)} disabled={busy} className="text-text-muted hover:text-danger" title="Delete drill">
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            ))}
            {visibleDrills.length === 0 && <p className="text-sm text-text-secondary">No drills yet for this filter.</p>}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            <BookOpen className="mr-1 inline h-4 w-4" strokeWidth={1.8} /> Lesson plan repository · {visiblePlans.length}
          </h3>
          <div className="space-y-2">
            {visiblePlans.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white/[0.04] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{p.title}</p>
                  <p className="text-xs text-text-secondary">
                    {p.sport?.name} {p.level ? `· ${p.level}` : ""} · {p.sessionFlow.length} drills
                    {p.targetDurationMin ? ` · ${p.targetDurationMin} min` : ""}
                  </p>
                  {p.goals && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{p.goals}</p>}
                </div>
                <button onClick={() => del("lesson-plans", p.id, p.title)} disabled={busy} className="text-text-muted hover:text-danger" title="Delete plan">
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            ))}
            {visiblePlans.length === 0 && <p className="text-sm text-text-secondary">No repository plans yet for this filter.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function NewDrillForm({ sports, onDone, onCancel }: { sports: Sport[]; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: "", sportKey: "", level: "beginner", durationMin: "10", description: "", equipment: "", videoUrl: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiJson("/platform/drills", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          sportKey: form.sportKey,
          level: form.level,
          durationMin: form.durationMin ? Number(form.durationMin) : undefined,
          description: form.description || undefined,
          equipment: form.equipment ? form.equipment.split(",").map((s) => s.trim()).filter(Boolean) : [],
          videoUrl: form.videoUrl || undefined,
        }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the drill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-accent/40 bg-accent/[0.06] p-5">
      <h3 className="mb-3 text-sm font-bold text-text-primary">New platform drill</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <input className={inputCls} placeholder="Drill title *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        <select className={inputCls} value={form.sportKey} onChange={(e) => setForm((f) => ({ ...f, sportKey: e.target.value }))} required>
          <option value="">Sport *</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
        <select className={inputCls} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>
          {["beginner", "intermediate", "advanced", "elite"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input className={inputCls} type="number" min={1} placeholder="Duration (min)" value={form.durationMin} onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))} />
        <input className={inputCls} placeholder="Equipment (comma separated)" value={form.equipment} onChange={(e) => setForm((f) => ({ ...f, equipment: e.target.value }))} />
        <input className={inputCls} placeholder="YouTube / video URL" value={form.videoUrl} onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))} />
        <textarea className={`${inputCls} sm:col-span-2 xl:col-span-3`} rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button type="submit" disabled={saving} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : "Add drill"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-text-secondary hover:text-text-primary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function NewPlanForm({ sports, drills, onDone, onCancel }: { sports: Sport[]; drills: PlatformDrill[]; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: "", sportKey: "", level: "beginner", goals: "" });
  const [selectedDrills, setSelectedDrills] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sportDrills = form.sportKey ? drills.filter((d) => d.sportKey === form.sportKey) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiJson("/platform/lesson-plans", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          sportKey: form.sportKey,
          level: form.level,
          goals: form.goals || undefined,
          drillIds: [...selectedDrills],
        }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-accent/40 bg-accent/[0.06] p-5">
      <h3 className="mb-3 text-sm font-bold text-text-primary">New repository lesson plan</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input className={inputCls} placeholder="Plan title *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        <select
          className={inputCls}
          value={form.sportKey}
          onChange={(e) => {
            setForm((f) => ({ ...f, sportKey: e.target.value }));
            setSelectedDrills(new Set());
          }}
          required
        >
          <option value="">Sport *</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
        <select className={inputCls} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>
          {["beginner", "intermediate", "advanced", "elite"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <textarea className={`${inputCls} sm:col-span-3`} rows={2} placeholder="Goals" value={form.goals} onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))} />
      </div>
      {form.sportKey && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Session flow — pick drills in order</p>
          <div className="flex flex-wrap gap-1.5">
            {sportDrills.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() =>
                  setSelectedDrills((prev) => {
                    const next = new Set(prev);
                    if (next.has(d.id)) next.delete(d.id);
                    else next.add(d.id);
                    return next;
                  })
                }
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  selectedDrills.has(d.id) ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-white/[0.04] text-text-secondary"
                }`}
              >
                {d.title} {d.durationMin ? `(${d.durationMin}m)` : ""}
              </button>
            ))}
            {sportDrills.length === 0 && <p className="text-xs text-text-muted">No platform drills for this sport yet — add drills first.</p>}
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button type="submit" disabled={saving} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : "Publish to repository"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-text-secondary hover:text-text-primary">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Tournaments & Events (shared features, platform-wide view) ───────────────

function CompetitionsTab() {
  const [tournaments, setTournaments] = useState<PlatformTournament[]>([]);
  const [events, setEvents] = useState<PlatformEvent[]>([]);

  useEffect(() => {
    apiJson<PlatformTournament[]>("/platform/tournaments").then(setTournaments).catch(() => {});
    apiJson<PlatformEvent[]>("/platform/events").then(setEvents).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          <Flag className="mr-1 inline h-4 w-4" strokeWidth={1.8} /> Tournaments across the platform · {tournaments.length}
        </h3>
        <div className="space-y-2">
          {tournaments.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-white/[0.04] px-4 py-3">
              <div className="flex items-center justify-between">
                <a href={`/t/${t.publicSlug}`} className="text-sm font-semibold text-text-primary hover:text-accent">
                  {t.name} ↗
                </a>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-text-secondary">{t.status.replace("_", " ")}</span>
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                {t.sports.join(", ")} · {t._count.events} events · organizer {t.organizer.name} · {t.startDate.slice(0, 10)}
              </p>
            </div>
          ))}
          {tournaments.length === 0 && <p className="text-sm text-text-secondary">No tournaments yet.</p>}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          <Trophy className="mr-1 inline h-4 w-4" strokeWidth={1.8} /> Match Center events across tenants · {events.length}
        </h3>
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="rounded-xl border border-border bg-white/[0.04] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">{e.name}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-text-secondary">{e.status}</span>
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                <School className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.8} />
                {e.hostAcademy.name} · {e.sports.join(", ")} · {e._count.fixtures} fixtures · {e._count.rosters} rosters
                {e.venue ? ` · ${e.venue}` : ""}
              </p>
            </div>
          ))}
          {events.length === 0 && <p className="text-sm text-text-secondary">No Match Center events yet.</p>}
        </div>
      </section>
    </div>
  );
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

function InvoicesTab({ invoices, onChanged }: { invoices: PlatformInvoice[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markPaid(id: string) {
    setBusyId(id);
    try {
      await apiJson(`/platform/invoices/${id}/mark-paid`, { method: "POST" });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not mark paid.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {invoices.map((inv) => (
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
                onClick={() => markPaid(inv.id)}
                disabled={busyId === inv.id}
                className="rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/25 disabled:opacity-50"
              >
                Mark paid
              </button>
            )}
          </div>
        </div>
      ))}
      {invoices.length === 0 && (
        <div className="rounded-xl border border-border bg-white/[0.04] p-6 text-center text-sm text-text-secondary">
          No platform invoices yet — use “Close period” on a tenant to raise one.
        </div>
      )}
    </div>
  );
}
