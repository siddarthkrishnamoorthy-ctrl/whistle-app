"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { StatusPill, Tabs } from "@/components/ui";
import type { InterschoolEvent } from "@/lib/types";
import { OverviewTab } from "./overview-tab";
import { RostersTab } from "./rosters-tab";
import { FixturesTab } from "./fixtures-tab";
import { LeaderboardTab } from "./leaderboard-tab";

type Tab = "overview" | "rosters" | "fixtures" | "leaderboard";

export default function EventWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [event, setEvent] = useState<InterschoolEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiJson<InterschoolEvent>(`/interschool/events/${id}`);
      setEvent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load event.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !event) return <p className="text-sm text-danger">{error ?? "Event not found."}</p>;

  const isHost = event.hostAcademyId === user?.academyId;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/interschool/events" className="text-sm text-text-secondary hover:text-accent">
          ← Interschool Events
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{event.name}</h1>
          <StatusPill tone="info">{event.status}</StatusPill>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "rosters", label: "Rosters" },
          { key: "fixtures", label: "Fixtures" },
          { key: "leaderboard", label: "Leaderboard" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && <OverviewTab event={event} onRefetch={load} />}
      {tab === "rosters" && <RostersTab event={event} />}
      {tab === "fixtures" && <FixturesTab event={event} isHost={isHost} />}
      {tab === "leaderboard" && <LeaderboardTab event={event} />}
    </div>
  );
}
