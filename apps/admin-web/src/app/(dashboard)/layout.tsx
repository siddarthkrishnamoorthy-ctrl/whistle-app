"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NAV_SECTIONS } from "@/lib/nav-config";
import { initials } from "@whistle/shared";
import clsx from "clsx";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-secondary">Loading Whistle…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-white/[0.03] backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/whistle-logo.png" alt="Whistle" className="h-9 w-auto" />
          <div>
            <div className="text-lg font-bold tracking-tight text-accent">Whistle</div>
            <div className="text-[11px] text-text-muted">By School of Sports</div>
          </div>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section, i) => (
            <div key={i}>
              {section.label && (
                <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-2.5 rounded-md border-l-2 px-2.5 py-2 text-sm transition",
                      active
                        ? "border-accent bg-accent/15 text-accent shadow-[0_0_14px_rgba(245,185,63,0.25)]"
                        : "border-transparent text-text-secondary hover:bg-white/[0.06] hover:text-text-primary"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <div className="rounded-md border border-admin-action/40 bg-admin-action/10 p-3 text-xs text-text-secondary">
            <span className="font-semibold text-admin-action">
              {user?.role === "account_manager" ? "Account Manager · School Admin" : "Admin · Full Access"}
            </span>
            <p className="mt-1">
              {user?.role === "account_manager"
                ? "You can manage students, classes, centers and coaches with default access."
                : "You can manage academies, plans, staff, students, classes and reports."}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-white/[0.03] px-6 py-3 backdrop-blur-xl">
          <div className="text-sm text-text-secondary">Whistle Sports</div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => signOut().then(() => router.replace("/login"))}
              className="text-xs text-text-secondary hover:text-danger"
            >
              Log out
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-text">
              {user ? initials(user.name) : "?"}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
