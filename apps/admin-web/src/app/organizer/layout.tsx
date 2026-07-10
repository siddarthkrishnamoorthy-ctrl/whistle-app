import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

// Standalone organizer portal shell — OUTSIDE the academy admin (dashboard)
// group. Organizers manage tournaments here with their own tournament login;
// no academy account is needed to reach this URL.
export default function OrganizerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-white/[0.03] px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          {/* Brand is the way home — clicking it always returns to the portal's home screen */}
          <Link href="/organizer" className="flex items-center gap-3 hover:opacity-90">
            <Image src="/whistle-logo.png" alt="Whistle" width={34} height={31} />
            <div>
              <p className="text-sm font-bold text-text-primary">Whistle Tournaments · Organizer Portal</p>
              <p className="text-xs text-text-secondary">Host and run open tournaments — separate from the academy</p>
            </div>
          </Link>
          <nav className="flex items-center gap-4 text-xs">
            <Link href="/organizer" className="font-semibold text-accent hover:underline">
              🏠 Portal home
            </Link>
            <a href="/play" className="text-text-secondary hover:text-text-primary">
              Player portal ↗
            </a>
            <a href="/rankings" className="text-text-secondary hover:text-text-primary">
              Rankings ↗
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
