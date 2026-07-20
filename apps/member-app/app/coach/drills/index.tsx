import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import type { Drill } from "@whistle/shared";

const SPORT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  cricket: "baseball-outline",
  football: "football-outline",
  badminton: "tennisball-outline",
  tennis: "tennisball-outline",
  table_tennis: "tennisball-outline",
  basketball: "basketball-outline",
  swimming: "water-outline",
  volleyball: "baseball-outline",
  throwball: "baseball-outline",
  hockey: "flag-outline",
  track_and_field: "walk-outline",
  kabaddi: "people-outline",
  billiards: "ellipse-outline",
};

function sportLabel(key: string) {
  return key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// The drill bank holds every sport's drills — grouped sport-wise as
// collapsible sections so it never renders as one endless flat list.
export default function DrillBankScreen() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openSports, setOpenSports] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiJson<Drill[]>("/drills")
      .then(setDrills)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? drills.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            (d.skillCategory ?? "").toLowerCase().includes(q) ||
            d.sportKey.toLowerCase().includes(q)
        )
      : drills;
    const bySport = new Map<string, Drill[]>();
    for (const d of filtered) {
      if (!bySport.has(d.sportKey)) bySport.set(d.sportKey, []);
      bySport.get(d.sportKey)!.push(d);
    }
    return [...bySport.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [drills, search]);

  const searching = search.trim().length > 0;

  if (loading) return <LoadingView />;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      {drills.length === 0 ? (
        <EmptyState message="No drills in the bank yet. Your head coach can add them in the admin app." />
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: 12,
              paddingHorizontal: 12,
            }}
          >
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search drills…"
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, color: colors.textPrimary, paddingVertical: 10, fontSize: 14 }}
            />
            {searching && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {grouped.length === 0 ? (
            <EmptyState message="No drills match your search." />
          ) : (
            grouped.map(([sport, list]) => {
              // While searching, always show matches; otherwise honour the toggle.
              const open = searching || openSports[sport];
              return (
                <View key={sport}>
                  <TouchableOpacity
                    onPress={() => setOpenSports((p) => ({ ...p, [sport]: !p[sport] }))}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderWidth: 1,
                      borderColor: open ? "rgba(245,185,63,0.35)" : colors.border,
                      backgroundColor: colors.surface,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <Ionicons name={SPORT_ICON[sport] ?? "fitness-outline"} size={18} color={colors.accent} />
                      <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15 }}>
                        {sportLabel(sport)}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {list.length} drill{list.length === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                  </TouchableOpacity>

                  {open && (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {list.map((d) => (
                        <Card key={d.id}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ color: colors.textPrimary, fontWeight: "600", flex: 1 }}>{d.title}</Text>
                            {d.level ? <Pill tone="info">{d.level}</Pill> : null}
                          </View>
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                            {d.skillCategory ?? sportLabel(d.sportKey)}
                            {d.durationMin ? ` · ${d.durationMin} min` : ""}
                          </Text>
                          {d.description ? (
                            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }} numberOfLines={3}>
                              {d.description}
                            </Text>
                          ) : null}
                        </Card>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}
