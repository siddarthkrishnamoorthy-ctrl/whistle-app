import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, ChipRow, Field, PrimaryButton, colors } from "@/components/ui";
import type { Drill } from "@whistle/shared";

interface ClientRef {
  id: string;
  name: string;
}

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

export default function RecordAssessmentScreen() {
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [clientId, setClientId] = useState("");
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

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Student</Text>
        <ChipRow
          options={clients.map((c) => ({ key: c.id, label: c.name }))}
          value={clientId}
          onChange={setClientId}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Drill (optional)</Text>
        <ChipRow
          options={[{ key: "", label: "None" }, ...drills.map((d) => ({ key: d.id, label: d.title }))]}
          value={drillId}
          onChange={setDrillId}
        />
      </View>

      <Card>
        <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 12 }}>Metrics</Text>
        <Field label="Reps completed" value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="e.g. 12" />
        <Field label="Time taken (seconds)" value={timeSec} onChangeText={setTimeSec} keyboardType="numeric" placeholder="e.g. 34.5" />
        <Field label="Accuracy (%)" value={accuracy} onChangeText={setAccuracy} keyboardType="numeric" placeholder="0–100" />
        <Field label="Overall rating (1–10)" value={overall} onChangeText={setOverall} keyboardType="numeric" placeholder="e.g. 7" />
        <Field label="Coach note" value={note} onChangeText={setNote} placeholder="Visible to the parent" multiline />
      </Card>

      <PrimaryButton title={saving ? "Saving…" : "Save assessment"} onPress={save} disabled={!clientId || saving} />
    </ScrollView>
  );
}
