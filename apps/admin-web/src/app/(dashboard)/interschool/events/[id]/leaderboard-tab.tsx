"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Table } from "@/components/ui";
import type { InterschoolEvent, InterschoolSettings, Rating } from "@/lib/types";

export function LeaderboardTab({ event }: { event: InterschoolEvent }) {
  const [board, setBoard] = useState<Record<string, Rating[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<InterschoolSettings | null>(null);

  useEffect(() => {
    apiJson<Record<string, Rating[]>>(`/interschool/events/${event.id}/leaderboard`)
      .then(setBoard)
      .finally(() => setLoading(false));
    apiJson<InterschoolSettings>("/interschool/settings").then(setSettings);
  }, [event.id]);

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>;

  const sports = Object.keys(board ?? {});
  if (sports.length === 0) {
    return (
      <Card>
        <EmptyState message="No eligible rated players yet — nominate rosters first." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sports.map((sportKey) => (
        <div key={sportKey}>
          <h2 className="mb-2 text-sm font-semibold capitalize text-text-primary">{sportKey}</h2>
          <Table columns={["Rank", "Player", "School", "Rating", "Matches", "Confidence"]}>
            {board![sportKey].map((r, i) => (
              <tr key={r.clientId} className="hover:bg-surface-alt">
                <td className="px-4 py-3 text-text-secondary">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-text-primary">{r.client?.name}</td>
                <td className="px-4 py-3 text-text-secondary">{r.client?.academy?.name ?? r.client?.academyId}</td>
                <td className="px-4 py-3 font-semibold text-accent">
                  {Number(r.currentRating).toFixed(2)}
                  {r.isProvisional && <span className="ml-1 text-xs text-text-muted">(Provisional)</span>}
                </td>
                <td className="px-4 py-3 text-text-secondary">{r.matchesPlayed}</td>
                <td className="px-4 py-3 text-text-secondary capitalize">
                  {r.confidence}
                  {settings?.showReliabilityScore && r.reliabilityPct !== undefined && (
                    <span className="ml-1 text-xs text-text-muted">({r.reliabilityPct}%)</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      ))}
    </div>
  );
}
