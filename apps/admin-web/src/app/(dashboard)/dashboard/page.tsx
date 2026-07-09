"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, IndianRupee, Inbox, RefreshCw, Swords, Trophy, Users, Wallet } from "lucide-react";
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
    ])
      .then(([clients, sessions, invoices, renewals, enquiries, fixtures, events]) => {
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
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load dashboard."));
  }, []);

  const stats = snap
    ? [
        { label: "Active students", value: String(snap.activeClients), sub: `${snap.totalClients} total`, icon: Users, href: "/academy/clients" },
        { label: "Sessions today", value: String(snap.sessionsToday), sub: "across all centers", icon: CalendarDays, href: "/academy/schedule" },
        { label: "Fees received", value: inr(snap.invoices.received), sub: `of ${inr(snap.invoices.totalInvoiced)} invoiced`, icon: Wallet, href: "/sales/invoices" },
        { label: "Outstanding", value: inr(snap.invoices.outstanding), sub: "pending collection", icon: IndianRupee, href: "/sales/invoices" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-text-secondary">Welcome back, {user?.name ?? "there"}.</p>
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
                  <Card className="transition hover:border-accent/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-text-muted">{s.label}</div>
                        <div className="mt-2 text-2xl font-bold text-text-primary">{s.value}</div>
                        <div className="mt-1 text-xs text-text-secondary">{s.sub}</div>
                      </div>
                      <Icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
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

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <Inbox className="h-4 w-4 text-info" strokeWidth={1.8} /> Enquiries
                </div>
                <Link href="/academy/enquiries" className="text-xs text-accent hover:underline">
                  Open CRM →
                </Link>
              </div>
              <div className="text-3xl font-bold text-text-primary">{snap.openEnquiries}</div>
              <p className="mt-1 text-sm text-text-secondary">open leads waiting for follow-up</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
