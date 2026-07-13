"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, IndianRupee, Inbox, MapPin, RefreshCw, School, Swords, Trophy, Users, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { Card, StatusPill } from "@/components/ui";

interface InvoiceSummary {
  totalInvoiced: number;
  received: number;
  outstanding: number;
}

interface FixtureRow {
  id: string;
  sportKey: string;
  matchType: string;
  status: string;
  scheduledAt?: string | null;
  event?: { name: string } | null;
}

interface RenewalRow {
  id: string;
  endDate: string;
  status: string;
  client: { name: string };
  plan: { title: string };
}

interface Snapshot {
  activeClients: number;
  totalClients: number;
  sessionsToday: number;
  invoices: InvoiceSummary;
  renewals: RenewalRow[];
  openEnquiries: number;
  fixtures: FixtureRow[];
  eventsCount: number;
  enrollment: { academiesOnPlatform: number; mySchools: number; myCenters: number } | null;
}

const FIXTURE_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  scheduled: "info",
  live: "warning",
  pending_confirmation: "warning",
  completed: "success",
  abandoned: "danger",
};

function inr(n: number) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN")}`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      apiJson<{ status: string }[]>("/clients").catch(() => []),
      apiJson<unknown[]>(`/schedule?date=${today}`).catch(() => []),
      apiJson<InvoiceSummary>("/invoices/summary").catch(() => ({ totalInvoiced: 0, received: 0, outstanding: 0 })),
      apiJson<RenewalRow[]>("/renewals").catch(() => []),
      apiJson<{ stage?: string }[]>("/enquiries").catch(() => []),
      apiJson<FixtureRow[]>("/fixtures").catch(() => []),
      apiJson<unknown[]>("/interschool/events").catch(() => []),
      apiJson<{ academiesOnPlatform: number; mySchools: number; myCenters: number }>(
        "/reports/platform-enrollment"
      ).catch(() => null),
    ])
      .then(([clients, sessions, invoices, renewals, enquiries, fixtures, events, enrollment]) => {
        setSnap({
          activeClients: clients.filter((c) => c.status === "active").length,
          totalClients: clients.length,
          sessionsToday: sessions.length,
          invoices,
          renewals: renewals.filter((r) => r.status === "due" || r.status === "overdue").slice(0, 5),
          openEnquiries: enquiries.filter((e) => (e.stage ?? "lead") === "lead").length,
          fixtures: fixtures
            .filter((f) => f.status === "live" || f.status === "scheduled" || f.status === "pending_confirmation")
            .slice(0, 5),
          eventsCount: events.length,
          enrollment,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load dashboard."));
  }, []);

  const collectionRate =
    snap && snap.invoices.totalInvoiced > 0
      ? Math.round((snap.invoices.received / snap.invoices.totalInvoiced) * 100)
      : 0;
  const activeRate = snap && snap.totalClients > 0 ? Math.round((snap.activeClients / snap.totalClients) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Tile system in the style of current club-management dashboards: a tinted
  // icon chip per metric, big number, quiet context line, optional meter.
  const stats = snap
    ? [
        {
          label: "Active students",
          value: String(snap.activeClients),
          sub: `${activeRate}% of ${snap.totalClients} enrolled`,
          icon: Users,
          href: "/academy/clients",
          chip: "bg-accent/15 text-accent",
          bar: { pct: activeRate, cls: "bg-accent" },
        },
        {
          label: "Sessions today",
          value: String(snap.sessionsToday),
          sub: "across all centers",
          icon: CalendarDays,
          href: "/academy/schedule",
          chip: "bg-accent/15 text-accent",
        },
        {
          label: "Fees received",
          value: inr(snap.invoices.received),
          sub: `${collectionRate}% of ${inr(snap.invoices.totalInvoiced)} collected`,
          icon: Wallet,
          href: "/sales/invoices",
          chip: "bg-accent/15 text-accent",
          bar: { pct: collectionRate, cls: "bg-accent" },
        },
        {
          label: "Open enquiries",
          value: String(snap.openEnquiries),
          sub: "leads waiting for follow-up",
          icon: Inbox,
          href: "/academy/enquiries",
          chip: "bg-accent/15 text-accent",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Hero — gradient banner with the platform-enrollment chips inline */}
      <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/15 via-white/[0.03] to-transparent p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {greeting}, {user?.name?.split(" ")[0] ?? "there"} 👋
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} — here&apos;s
              how your academy looks right now.
            </p>
          </div>
          {snap?.enrollment && (
            <div className="flex flex-wrap gap-2">
              {[
                // Tenant dashboards are scoped to THEIR school/academy only —
                // platform-wide counts live on Whistle's /platform console.
                { label: "Partner schools", value: snap.enrollment.mySchools, icon: School, href: "/academy/schools" },
                { label: "Centers", value: snap.enrollment.myCenters, icon: MapPin, href: "/academy/centers" },
              ].map((c) => {
                const Icon = c.icon;
                return (
                  <Link
                    key={c.label}
                    href={c.href}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 transition hover:border-accent/50"
                  >
                    <Icon className="h-4 w-4 text-accent" strokeWidth={1.8} />
                    <span className="text-lg font-bold text-text-primary">{c.value}</span>
                    <span className="text-xs text-text-secondary">{c.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}
      {!snap && !error && <Card className="text-sm text-text-secondary">Loading metrics…</Card>}

      {snap && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <Link key={s.label} href={s.href}>
                  <Card className="h-full transition hover:-translate-y-0.5 hover:border-accent/50">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.chip}`}>
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs uppercase tracking-wide text-text-muted">{s.label}</div>
                        <div className="mt-1 truncate text-2xl font-bold text-text-primary">{s.value}</div>
                        <div className="mt-0.5 text-xs text-text-secondary">{s.sub}</div>
                        {s.bar && (
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                            <div className={`h-full rounded-full ${s.bar.cls}`} style={{ width: `${s.bar.pct}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <Swords className="h-4 w-4 text-warning" strokeWidth={1.8} /> Match Center
                </div>
                <Link href="/interschool/fixtures" className="text-xs text-accent hover:underline">
                  All fixtures →
                </Link>
              </div>
              {snap.fixtures.length === 0 ? (
                <p className="text-sm text-text-secondary">No live or upcoming fixtures.</p>
              ) : (
                <ul className="space-y-2.5">
                  {snap.fixtures.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-text-secondary">
                        <span className="font-medium text-text-primary">{f.sportKey}</span>
                        {" · "}
                        {f.event?.name ?? f.matchType.replace("_", " ")}
                      </span>
                      <StatusPill tone={FIXTURE_TONE[f.status] ?? "neutral"}>{f.status.replace("_", " ")}</StatusPill>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-text-muted">
                <Trophy className="mr-1 inline h-3.5 w-3.5" /> {snap.eventsCount} event(s) in your network
              </p>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <RefreshCw className="h-4 w-4 text-warning" strokeWidth={1.8} /> Renewals due
                </div>
                <Link href="/academy/renewals" className="text-xs text-accent hover:underline">
                  Manage →
                </Link>
              </div>
              {snap.renewals.length === 0 ? (
                <p className="text-sm text-text-secondary">Nothing due — all enrollments current.</p>
              ) : (
                <ul className="space-y-2.5">
                  {snap.renewals.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-text-secondary">
                        <span className="font-medium text-text-primary">{r.client.name}</span> · {r.plan.title}
                      </span>
                      <StatusPill tone={r.status === "overdue" ? "danger" : "warning"}>
                        {r.endDate.slice(0, 10)}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Collections ring gauge — received vs outstanding at a glance */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <IndianRupee className="h-4 w-4 text-warning" strokeWidth={1.8} /> Collections
                </div>
                <Link href="/sales/invoices" className="text-xs text-accent hover:underline">
                  Invoices →
                </Link>
              </div>
              <div className="flex items-center gap-5">
                <div className="relative h-28 w-28 shrink-0">
                  <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="13" />
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="13"
                      strokeLinecap="round"
                      strokeDasharray={String(2 * Math.PI * 48)}
                      strokeDashoffset={String(2 * Math.PI * 48 * (1 - collectionRate / 100))}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-text-primary">{collectionRate}%</span>
                    <span className="text-[10px] text-text-muted">collected</span>
                  </div>
                </div>
                <div className="min-w-0 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="text-text-secondary">Received</span>
                    <span className="ml-auto font-semibold text-text-primary">{inr(snap.invoices.received)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="text-text-secondary">Outstanding</span>
                    <span className="ml-auto font-semibold text-text-primary">{inr(snap.invoices.outstanding)}</span>
                  </div>
                  <p className="text-xs text-text-muted">of {inr(snap.invoices.totalInvoiced)} invoiced</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
