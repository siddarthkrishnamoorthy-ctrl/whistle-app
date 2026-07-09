import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useChildren } from "@/lib/children-context";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import { formatDate, type Rating, type RatingTransaction } from "@whistle/shared";

export default function RatingDetailScreen() {
  const { selectedChild, loading: childLoading } = useChildren();
  const [rating, setRating] = useState<Rating | null>(null);
  const [history, setHistory] = useState<RatingTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!selectedChild) {
        setLoading(false);
        return;
      }
      const sportKey =
        selectedChild.enrollments?.find((e) => e.status === "active")?.class?.sportKey ??
        selectedChild.enrollments?.[0]?.class?.sportKey;
      if (!sportKey) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      Promise.all([
        apiJson<Rating>(`/ratings/${selectedChild.id}/${sportKey}/individual`).catch(() => null),
        apiJson<RatingTransaction[]>(`/ratings/${selectedChild.id}/${sportKey}/individual/history`).catch(
          () => [] as RatingTransaction[]
        ),
      ])
        .then(([r, h]) => {
          if (cancelled) return;
          setRating(r);
          setHistory(h);
        })
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [selectedChild])
  );

  if (childLoading || loading) return <LoadingView />;
  if (!selectedChild) return <EmptyState message="No child linked yet." />;
  if (!rating) return <EmptyState message="No rating yet — it appears after the first rated match." />;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Card style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, textTransform: "uppercase" }}>
          {rating.sportKey} · {rating.formatType}
        </Text>
        <Text style={{ color: colors.accent, fontSize: 44, fontWeight: "700" }}>
          {Number(rating.currentRating).toFixed(2)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {rating.matchesPlayed} match{rating.matchesPlayed === 1 ? "" : "es"} · {rating.confidence} confidence
          </Text>
          {rating.isProvisional ? <Pill tone="warning">provisional</Pill> : null}
        </View>
        {rating.reliabilityPct != null ? (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{rating.reliabilityPct}% reliability</Text>
        ) : null}
      </Card>

      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
          Rating history
        </Text>
        {history.length === 0 ? (
          <EmptyState message="No rated matches yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {history.map((t) => {
              const delta = Number(t.delta);
              return (
                <Card key={t.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 13 }}>
                        {Number(t.preRating).toFixed(2)} → {Number(t.postRating).toFixed(2)}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                        {t.fixture?.matchType ? `${t.fixture.matchType.replace("_", " ")} · ` : ""}
                        {formatDate(t.fixture?.scheduledAt ?? t.createdAt)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: delta > 0 ? colors.success : delta < 0 ? colors.danger : colors.textMuted,
                        fontSize: 15,
                        fontWeight: "700",
                      }}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(2)}
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
