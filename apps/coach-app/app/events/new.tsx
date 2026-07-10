import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, ChipRow, Field, PrimaryButton, colors } from "@/components/ui";

interface Sport {
  key: string;
  name: string;
}

const AGE_BANDS = ["U9", "U11", "U13", "U15", "U17", "Open"];
const FORMATS = [
  { key: "individual", label: "Singles" },
  { key: "pair", label: "Doubles" },
  { key: "team", label: "Team" },
] as const;

// Sports that are only ever played as teams — the format picker is skipped
// and Team is chosen automatically for these.
const TEAM_ONLY_SPORTS = new Set([
  "football",
  "cricket",
  "volleyball",
  "throwball",
  "kabaddi",
  "hockey",
  "basketball",
]);

function MultiChips<T extends string>({
  options,
  values,
  onToggle,
}: {
  options: { key: T; label: string }[];
  values: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = values.includes(opt.key);
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onToggle(opt.key)}
            style={{
              borderWidth: 1,
              borderColor: active ? colors.accent : colors.border,
              backgroundColor: active ? colors.accent : "transparent",
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 7,
            }}
          >
            <Text style={{ color: active ? colors.accentText : colors.textSecondary, fontSize: 13, fontWeight: "600" }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function HostEventScreen() {
  const [sports, setSports] = useState<Sport[]>([]);
  const sportLabelOf = (key: string) => sports.find((s) => s.key === key)?.name ?? key;
  const [name, setName] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [formatType, setFormatType] = useState<(typeof FORMATS)[number]["key"]>("individual");
  const [ageBands, setAgeBands] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiJson<Sport[]>("/sports")
      .then(setSports)
      .catch(() => undefined);
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void) => (v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // Team-only sports (football, cricket…) lock the format to Team; the
  // Singles/Doubles options only appear for racket-style sports.
  const teamOnly = selectedSports.length > 0 && selectedSports.every((s) => TEAM_ONLY_SPORTS.has(s));
  useEffect(() => {
    if (teamOnly) setFormatType("team");
  }, [teamOnly]);

  const valid =
    name.trim().length >= 2 &&
    selectedSports.length > 0 &&
    ageBands.length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(endDate);

  async function host() {
    if (!valid) return;
    setSaving(true);
    try {
      const event = await apiJson<{ id: string }>("/interschool/events", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), sports: selectedSports, formatType, ageBands, startDate, endDate }),
      });
      // Publish right away so network academies can discover it.
      await apiJson(`/interschool/events/${event.id}/publish`, { method: "POST", body: JSON.stringify({}) });
      router.replace(`/events/${event.id}`);
    } catch (e) {
      Alert.alert("Couldn't host event", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Field label="Event name" value={name} onChangeText={setName} placeholder="e.g. Summer Smash 2026" />

      <Card>
        <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 10 }}>Sports</Text>
        <MultiChips
          options={sports.map((s) => ({ key: s.key, label: s.name }))}
          values={selectedSports}
          onToggle={toggle(selectedSports, setSelectedSports)}
        />
      </Card>

      <Card>
        <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 10 }}>Format</Text>
        {teamOnly ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                backgroundColor: colors.accent,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 7,
              }}
            >
              <Text style={{ color: colors.accentText, fontSize: 13, fontWeight: "600" }}>Team</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>
              {selectedSports.map(sportLabelOf).join(", ")} is a team sport — format picked automatically.
            </Text>
          </View>
        ) : (
          <ChipRow
            options={FORMATS.map((f) => ({ key: f.key, label: f.label }))}
            value={formatType}
            onChange={(v) => setFormatType(v as typeof formatType)}
          />
        )}
      </Card>

      <Card>
        <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 10 }}>Age bands</Text>
        <MultiChips
          options={AGE_BANDS.map((b) => ({ key: b, label: b }))}
          values={ageBands}
          onToggle={toggle(ageBands, setAgeBands)}
        />
      </Card>

      <Card>
        <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 12 }}>Dates</Text>
        <Field label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
        <Field label="End date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
      </Card>

      <PrimaryButton title={saving ? "Hosting…" : "Host & publish event"} onPress={host} disabled={!valid || saving} />
      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>
        Published events are visible to other academies in your interschool network.
      </Text>
    </ScrollView>
  );
}
