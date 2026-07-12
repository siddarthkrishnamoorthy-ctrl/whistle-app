import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { Card, ChipRow, EmptyState, Pill, SearchBar, colors } from "@/components/ui";
import { RANK_MEDALS, sportEmoji } from "@/lib/sport-emoji";

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
  const [query, setQuery] = useState("");
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
          {/* Sport picker — horizontally scrollable tiles with the sport emoji,
              so a big taxonomy stays a single tidy row instead of a wall. */}
          <View>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 }}>
              SPORT
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
              {sports.map((s) => {
                const active = s.key === sportKey;
                return (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setSportKey(s.key)}
                    activeOpacity={0.8}
                    style={{
                      width: 76,
                      paddingVertical: 10,
                      alignItems: "center",
                      gap: 4,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.border,
                      backgroundColor: active ? colors.accent + "22" : colors.surface,
                      ...(active
                        ? { shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 3 }
                        : {}),
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{sportEmoji(s.key)}</Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: active ? colors.accent : colors.textSecondary, fontSize: 11, fontWeight: active ? "800" : "600" }}
                    >
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ChipRow
            options={FORMATS.map((f) => ({ key: f.key, label: f.label }))}
            value={formatType}
            onChange={(v) => setFormatType(v as typeof formatType)}
          />

          {rows.length === 0 ? (
            <EmptyState message="No rated players for this sport & format yet." />
          ) : (
            <View style={{ gap: 8 }}>
              {rows.length > 8 ? (
                <SearchBar value={query} onChangeText={setQuery} placeholder="Search player or academy…" />
              ) : null}
              {(() => {
                const q = query.trim().toLowerCase();
                // Keep each player's true leaderboard rank while filtering.
                const shown = rows
                  .map((r, i) => ({ r, i }))
                  .filter(({ r }) => !q || r.client.name.toLowerCase().includes(q) || (r.client.academy?.name ?? "").toLowerCase().includes(q));
                if (shown.length === 0) return <EmptyState message="No players match your search." />;
                return shown.map(({ r, i }) => {
                const medal = RANK_MEDALS[i];
                const top = i < 3;
                return (
                  <Card key={`${r.clientId}-${i}`} style={top ? { borderColor: colors.accent + "55" } : undefined}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Text style={{ fontSize: medal ? 20 : 15, fontWeight: "700", color: colors.textMuted, width: 30, textAlign: "center" }}>
                        {medal ?? `#${i + 1}`}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: top ? colors.accent : colors.textPrimary, fontWeight: "700" }}>{r.client.name}</Text>
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
                );
                });
              })()}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
