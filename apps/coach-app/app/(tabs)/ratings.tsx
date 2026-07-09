import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { Card, ChipRow, EmptyState, Pill, colors } from "@/components/ui";

interface Sport {
  key: string;
  name: string;
}

interface LeaderboardRow {
  clientId: string;
  currentRating: number | string;
  matchesPlayed: number;
  isProvisional: boolean;
  reliabilityPct?: number;
  client: { id: string; name: string; academy?: { name: string } };
}

const FORMATS = [
  { key: "individual", label: "Singles" },
  { key: "pair", label: "Doubles" },
  { key: "team", label: "Team" },
] as const;

export default function RatingsScreen() {
  const { user } = useAuth();
  const [sports, setSports] = useState<Sport[]>([]);
  const [sportKey, setSportKey] = useState("");
  const [formatType, setFormatType] = useState<(typeof FORMATS)[number]["key"]>("individual");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.academyId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      apiJson<Sport[]>("/sports")
        .then((all) => {
          if (cancelled) return;
          setSports(all);
          setSportKey((prev) => prev || all[0]?.key || "");
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [user])
  );

  useEffect(() => {
    if (!sportKey) return;
    let cancelled = false;
    apiJson<LeaderboardRow[]>(`/ratings/leaderboard/students?sportKey=${sportKey}&formatType=${formatType}`)
      .then((all) => !cancelled && setRows(all))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [sportKey, formatType]);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>Whistle Standings</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Player standings across the interschool network</Text>
      </View>

      {loading ? (
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      ) : sports.length === 0 ? (
        <EmptyState message="No sports configured yet." />
      ) : (
        <>
          <ChipRow options={sports.map((s) => ({ key: s.key, label: s.name }))} value={sportKey} onChange={setSportKey} />
          <ChipRow
            options={FORMATS.map((f) => ({ key: f.key, label: f.label }))}
            value={formatType}
            onChange={(v) => setFormatType(v as typeof formatType)}
          />

          {rows.length === 0 ? (
            <EmptyState message="No rated players for this sport & format yet." />
          ) : (
            <View style={{ gap: 8 }}>
              {rows.map((r, i) => (
                <Card key={`${r.clientId}-${i}`}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: "700", width: 28 }}>#{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{r.client.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                        {r.client.academy?.name ?? ""} · {r.matchesPlayed} match{r.matchesPlayed === 1 ? "" : "es"}
                        {r.reliabilityPct != null ? ` · ${r.reliabilityPct}% reliable` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: colors.accent, fontSize: 20, fontWeight: "700" }}>
                        {Number(r.currentRating).toFixed(2)}
                      </Text>
                      {r.isProvisional ? <Pill tone="warning">provisional</Pill> : null}
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
