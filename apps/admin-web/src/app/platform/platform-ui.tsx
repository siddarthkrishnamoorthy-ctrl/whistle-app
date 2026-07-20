"use client";

// Shared types + helpers for the Whistle operator console pages.

import type { BrandTheme } from "@/components/tenant-brand";

export interface Tenant {
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

export interface Revenue {
  tenants: number;
  students: number;
  schools: number;
  suspended: number;
  subscriptionsByStatus: Record<string, number>;
  invoiced: number;
  collected: number;
  outstanding: number;
}

export interface PlatformInvoice {
  id: string;
  amount: string;
  status: string;
  issuedAt: string;
  billableStudentCount: number;
  academy: { id: string; name: string };
}

export interface PlatformDrill {
  id: string;
  title: string;
  sportKey: string;
  level: string | null;
  ageBand: string | null;
  durationMin: number | null;
  description: string | null;
  equipment: string[];
  media: { type: string; url: string }[] | null;
  sport: { key: string; name: string };
}

export interface PlatformPlan {
  id: string;
  title: string;
  sportKey: string | null;
  level: string | null;
  ageBand: string | null;
  goals: string | null;
  targetDurationMin: number | null;
  whatToBring: string[];
  sessionFlow: { drillId: string; drillTitle: string; durationMin: number }[];
  sport: { key: string; name: string } | null;
}

export const SUB_STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-400/15 text-emerald-300",
  trial: "bg-sky-400/15 text-sky-300",
  past_due: "bg-amber-400/15 text-amber-300",
  cancelled: "bg-rose-400/15 text-rose-300",
  pending_quote: "bg-violet-400/15 text-violet-300",
};

export function inr(n: number | string) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN")}`;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
