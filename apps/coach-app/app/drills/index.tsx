import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, Pill, colors } from "@/components/ui";
import type { Drill } from "@whistle/shared";

export default function DrillBankScreen() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJson<Drill[]>("/drills")
      .then(setDrills)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingView />;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      {drills.length === 0 ? (
        <EmptyState message="No drills in the bank yet. Your head coach can add them in the admin app." />
      ) : (
        <View style={{ gap: 8 }}>
          {drills.map((d) => (
            <Card key={d.id}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "600", flex: 1 }}>{d.title}</Text>
                {d.level ? <Pill tone="info">{d.level}</Pill> : null}
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                {d.sportKey}
                {d.skillCategory ? ` · ${d.skillCategory}` : ""}
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
    </ScrollView>
  );
}
