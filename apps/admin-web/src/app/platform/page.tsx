"use client";

// Operator Overview — platform-wide numbers at a glance. Deeper work lives on
// the dedicated sidebar pages (Tenants, Drill Bank, Lesson Plans, …).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, IndianRupee, ReceiptText, Users } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Card } from "@/components/ui";
import { inr, PageHeader, type PlatformInvoice, type Revenue, type Tenant } from "./platform-ui";

export default function PlatformOverviewPage() {
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);

  useEffect(() => {
    apiJson<Revenue>("/platform/revenue").then(setRevenue).catch(() => {});
    apiJson<Tenant[]>("/platform/tenants").then(setTenants).catch(() => {});
    apiJson<PlatformInvoice[]>("/platform/invoices").then(setInvoices).catch(() => {});
  }, []);

  const tiles = revenue
    ? [
        { label: "Tenants on Whistle", value: String(revenue.tenants), sub: `${revenue.suspended} suspended`, icon: Building2, chip: "bg-sky-400/15 text-sky-300", href: "/platform/tenants" },
        { label: "Students across tenants", value: revenue.students.toLocaleString("en-IN"), sub: `${revenue.schools} schools`, icon: Users, chip: "bg-emerald-400/15 text-emerald-300", href: "/platform/tenants" },
        { label: "Revenue collected", value: inr(revenue.collected), sub: `of ${inr(revenue.invoiced)} invoiced`, icon: IndianRupee, chip: "bg-amber-400/15 text-amber-300", href: "/platform/invoices" },
        { label: "Outstanding", value: inr(revenue.outstanding), sub: "pending platform invoices", icon: ReceiptText, chip: "bg-rose-400/15 text-rose-300", href: "/platform/invoices" },
      ]
    : [];
  const topTenants = [...tenants].sort((a, b) => b.counts.clients - a.counts.clients).slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="How Whistle is doing across every tenant." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.label} href={t.href} className="rounded-lg border border-border bg-surface p-5 transition hover:border-accent/50">
              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${t.chip}`}>
                <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
              </div>
              <div className="text-2xl font-bold text-text-primary">{t.value}</div>
              <div className="text-sm font-medium text-text-secondary">{t.label}</div>
              <div className="mt-0.5 text-xs text-text-muted">{t.sub}</div>
            </Link>
          );
        })}
        {!revenue && <Card className="text-sm text-text-secondary sm:col-span-2 xl:col-span-4">Loading…</Card>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Largest tenants</h3>
          {topTenants.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
              <span className="text-sm font-medium text-text-primary">{t.name}</span>
              <span className="text-xs text-text-secondary">{t.counts.clients.toLocaleString("en-IN")} students</span>
            </div>
          ))}
          {topTenants.length === 0 && <p className="text-sm text-text-secondary">No tenants yet.</p>}
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Recent platform invoices</h3>
          {invoices.slice(0, 6).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
              <span className="text-sm text-text-primary">{inv.academy.name}</span>
              <span className="text-xs">
                <span className="font-semibold text-text-primary">{inr(inv.amount)}</span>{" "}
                <span className={inv.status === "paid" ? "text-emerald-300" : "text-amber-300"}>{inv.status}</span>
              </span>
            </div>
          ))}
          {invoices.length === 0 && <p className="text-sm text-text-secondary">None yet.</p>}
        </Card>
      </div>
    </div>
  );
}
