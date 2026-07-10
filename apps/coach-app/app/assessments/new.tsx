import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiJson } from "@/lib/api-client";
import { Card, ChipRow, Field, PrimaryButton, colors } from "@/components/ui";
import type { Drill } from "@whistle/shared";

interface ClientRef {
  id: string;
  name: string;
}

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

const SPORT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  cricket: "baseball-outline",
  football: "football-outline",
  badminton: "tennisball-outline",
  tennis: "tennisball-outline",
  basketball: "basketball-outline",
  swimming: "water-outline",
  volleyball: "baseball-outline",
  hockey: "flag-outline",
};

function sportLabel(key: string) {
  return key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Record an ad hoc drill assessment. Drills are grouped SPORT-WISE: pick the
// sport first, then choose from that sport's drills as clean cards — never
// one flat cloud of every drill in the academy.
export default function RecordAssessmentScreen() {
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [clientId, setClientId] = useState("");
  const [sportKey, setSportKey] = useState<string>("");
  const [drillId, setDrillId] = useState("");
  const [reps, setReps] = useState("");
  const [timeSec, setTimeSec] = useState("");
  const [accuracy, setAccuracy] = useState("");
  const [overall, setOverall] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiJson<ClientRef[]>("/clients")
      .then((all) => {
        setClients(all);
        setClientId((prev) => prev || all[0]?.id || "");
      })
      .catch(() => undefined);
    apiJson<Drill[]>("/drills")
      .then(setDrills)
      .catch(() => undefined);
  }, []);

  const sports = useMemo(() => {
    const keys = [...new Set(drills.map((d) => d.sportKey))].sort();
    return keys;
  }, [drills]);

  const sportDrills = useMemo(
    () => drills.filter((d) => d.sportKey === sportKey),
    [drills, sportKey]
  );
  const selectedDrill = drills.find((d) => d.id === drillId);

  async function save() {
    if (!clientId) return;
    setSaving(true);
    try {
      await apiJson("/assessments", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          drillId: drillId || undefined,
          repsCompleted: num(reps),
          timeTakenSec: num(timeSec),
          accuracyPct: num(accuracy),
          overallRating: num(overall),
          coachNote: note.trim() || undefined,
        }),
      });
      router.back();
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const Step = ({ n, title }: { n: number; title: string }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: "800" }}>{n}</Text>
      </View>
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{title}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
      {/* 1 — Student */}
      <View>
        <Step n={1} title="Student" />
        <ChipRow
          scroll
          options={clients.map((c) => ({ key: c.id, label: c.name }))}
          value={clientId}
          onChange={setClientId}
        />
      </View>

      {/* 2 — Sport (drives which drills are shown) */}
      <View>
        <Step n={2} title="Sport" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {sports.map((s) => {
            const active = sportKey === s;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => {
                  setSportKey(active ? "" : s);
                  setDrillId("");
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Ionicons
                  name={SPORT_ICON[s] ?? "fitness-outline"}
                  size={15}
                  color={active ? colors.accentText : colors.textSecondary}
                />
                <Text
                  style={{
                    color: active ? colors.accentText : colors.textSecondary,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  {sportLabel(s)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3 — Drill of that sport */}
      <View>
        <Step n={3} title="Drill" />
        {!sportKey ? (
          <Card>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Pick a sport above to see its drills — or skip straight to metrics for a general assessment.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {sportDrills.map((d) => {
              const active = drillId === d.id;
              return (
                <TouchableOpacity key={d.id} onPress={() => setDrillId(active ? "" : d.id)} activeOpacity={0.7}>
                  <Card
                    style={{
                      borderWidth: 1,
                      borderColor: active ? colors.accent : "rgba(255,255,255,0.08)",
                      backgroundColor: active ? "rgba(245,185,63,0.10)" : undefined,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: active ? colors.accent : colors.textPrimary, fontWeight: "700" }}>
                          {d.title}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                          {[d.skillCategory, d.durationMin ? `${d.durationMin} min` : null, d.level]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                      <Ionicons
                        name={active ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={active ? colors.accent : colors.textMuted}
                      />
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
            {sportDrills.length === 0 && (
              <Card>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>No drills for this sport yet.</Text>
              </Card>
            )}
          </View>
        )}
      </View>

      {/* 4 — Metrics */}
      <View>
        <Step n={4} title="Metrics" />
        <Card>
          {selectedDrill ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
              Recording against <Text style={{ color: colors.accent, fontWeight: "700" }}>{selectedDrill.title}</Text>
            </Text>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>
              General assessment — no drill attached
            </Text>
          )}
          <Field label="Reps completed" value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="e.g. 12" />
          <Field label="Time taken (seconds)" value={timeSec} onChangeText={setTimeSec} keyboardType="numeric" placeholder="e.g. 34.5" />
          <Field label="Accuracy (%)" value={accuracy} onChangeText={setAccuracy} keyboardType="numeric" placeholder="0–100" />
          <Field label="Overall rating (1–10)" value={overall} onChangeText={setOverall} keyboardType="numeric" placeholder="e.g. 7" />
          <Field label="Coach note" value={note} onChangeText={setNote} placeholder="Visible to the parent" multiline />
        </Card>
      </View>

      <PrimaryButton title={saving ? "Saving…" : "Save assessment"} onPress={save} disabled={!clientId || saving} />
    </ScrollView>
  );
}
