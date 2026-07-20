import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import { formatDate, type Fixture } from "@whistle/shared";

const FIXTURE_TONE = {
  draft: "neutral",
  scheduled: "info",
  live: "warning",
  pending_confirmation: "warning",
  completed: "success",
  abandoned: "danger",
} as const;

export default function FixtureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiJson<Fixture>(`/fixtures/${id}`)
      .then(setFixture)
      .catch(() => setFixture(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingView />;
  if (!fixture) return <EmptyState message="Fixture not found." />;

  const sideNames = (clients?: { name: string }[], ids?: string[]) =>
    clients?.length ? clients.map((c) => c.name).join(", ") : `${ids?.length ?? 0} player(s)`;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>
          {fixture.sport?.name ?? fixture.sportKey}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <Pill tone={FIXTURE_TONE[fixture.status as keyof typeof FIXTURE_TONE] ?? "neutral"}>
            {fixture.status.replace("_", " ")}
          </Pill>
          {fixture.event ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{fixture.event.name}</Text> : null}
        </View>
      </View>

      <Card>
        <View style={{ gap: 10 }}>
          <View>
            <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase" }}>Side A</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
              {sideNames(fixture.entrantAClients, fixture.entrantA)}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View>
            <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase" }}>Side B</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
              {sideNames(fixture.entrantBClients, fixture.entrantB)}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          {fixture.scheduledAt ? formatDate(fixture.scheduledAt) : "Unscheduled"}
          {fixture.venue ? ` · ${fixture.venue}` : ""} · {fixture.matchType.replace("_", " ")}
        </Text>
        {fixture.resultSummary?.scoreDisplay ? (
          <Text style={{ color: colors.accent, fontSize: 20, fontWeight: "700", marginTop: 8 }}>
            {fixture.resultSummary.scoreDisplay}
            {fixture.resultSummary.winnerSide
              ? fixture.resultSummary.winnerSide === "draw"
                ? " (draw)"
                : ` (Side ${fixture.resultSummary.winnerSide} won)`
              : ""}
          </Text>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>No result yet.</Text>
        )}
      </Card>
    </ScrollView>
  );
}
