"use client";

// Tournaments & Match Center events across the whole platform — the shared
// competition features, seen from the operator's chair.

import { useEffect, useState } from "react";
import { Flag, School, Trophy } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState } from "@/components/ui";
import { PageHeader } from "../platform-ui";

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

const LIST_PREVIEW = 8;

export default function PlatformCompetitionsPage() {
  const [tournaments, setTournaments] = useState<PlatformTournament[]>([]);
  const [events, setEvents] = useState<PlatformEvent[]>([]);
  const [showAllTournaments, setShowAllTournaments] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);

  useEffect(() => {
    apiJson<PlatformTournament[]>("/platform/tournaments").then(setTournaments).catch(() => {});
    apiJson<PlatformEvent[]>("/platform/events").then(setEvents).catch(() => {});
  }, []);

  const visibleTournaments = showAllTournaments ? tournaments : tournaments.slice(0, LIST_PREVIEW);
  const visibleEvents = showAllEvents ? events : events.slice(0, LIST_PREVIEW);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tournaments & Events"
        subtitle="Every competition running on Whistle — organizer tournaments and tenant Match Center events."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            <Flag className="mr-1 inline h-4 w-4" strokeWidth={1.8} /> Tournaments · {tournaments.length}
          </h3>
          {visibleTournaments.map((t) => (
            <Card key={t.id}>
              <div className="flex items-center justify-between">
                <a href={`/t/${t.publicSlug}`} className="text-sm font-semibold text-text-primary hover:text-accent">
                  {t.name} ↗
                </a>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-text-secondary">
                  {t.status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                {t.sports.join(", ")} · {t._count.events} events · organizer {t.organizer.name} · {t.startDate.slice(0, 10)}
              </p>
            </Card>
          ))}
          {tournaments.length > LIST_PREVIEW && (
            <button onClick={() => setShowAllTournaments((v) => !v)} className="text-xs font-semibold text-accent hover:underline">
              {showAllTournaments ? "Show fewer" : `View all ${tournaments.length}`}
            </button>
          )}
          {tournaments.length === 0 && (
            <Card>
              <EmptyState message="No tournaments yet." />
            </Card>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            <Trophy className="mr-1 inline h-4 w-4" strokeWidth={1.8} /> Match Center events · {events.length}
          </h3>
          {visibleEvents.map((e) => (
            <Card key={e.id}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">{e.name}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-text-secondary">{e.status}</span>
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                <School className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.8} />
                {e.hostAcademy.name} · {e.sports.join(", ")} · {e._count.fixtures} fixtures · {e._count.rosters} rosters
                {e.venue ? ` · ${e.venue}` : ""}
              </p>
            </Card>
          ))}
          {events.length > LIST_PREVIEW && (
            <button onClick={() => setShowAllEvents((v) => !v)} className="text-xs font-semibold text-accent hover:underline">
              {showAllEvents ? "Show fewer" : `View all ${events.length}`}
            </button>
          )}
          {events.length === 0 && (
            <Card>
              <EmptyState message="No Match Center events yet." />
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
