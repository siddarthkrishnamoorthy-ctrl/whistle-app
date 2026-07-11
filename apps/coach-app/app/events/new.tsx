import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { apiJson } from "@/lib/api-client";
import { Card, ChipRow, Field, PrimaryButton, colors } from "@/components/ui";

interface Sport {
  key: string;
  name: string;
}

interface Center {
  id: string;
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
  const [maxTeams, setMaxTeams] = useState("");
  // League progression, confirmed while setting the tournament up: groups
  // then how the league resolves (table / final / cross-group semis / quarters).
  const [groupCount, setGroupCount] = useState<"1" | "2" | "4">("1");
  const [playoffMode, setPlayoffMode] = useState<"none" | "final" | "semis" | "quarters">("none");
  const [centers, setCenters] = useState<Center[]>([]);
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiJson<Sport[]>("/sports")
      .then(setSports)
      .catch(() => undefined);
    // Venue = one of the academy's centers, so visiting teams know where
    // to go and every generated fixture carries the ground.
    apiJson<Center[]>("/centers")
      .then((all) => {
        setCenters(all);
        setVenue((prev) => prev || all[0]?.name || "");
      })
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
        body: JSON.stringify({
          name: name.trim(),
          sports: selectedSports,
          formatType,
          ageBands,
          startDate,
          endDate,
          maxTeams: maxTeams.trim() ? Number(maxTeams) : undefined,
          venue: venue || undefined,
          groupCount: Number(groupCount),
          playoffMode,
        }),
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

      {centers.length > 0 && (
        <Card>
          <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 10 }}>Venue</Text>
          <ChipRow
            scroll
            options={centers.map((c) => ({ key: c.name, label: c.name }))}
            value={venue}
            onChange={setVenue}
          />
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
            Visiting teams see this ground; every fixture inherits it.
          </Text>
        </Card>
      )}

      <Card>
        <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 12 }}>Team slots</Text>
        <Field
          label="Number of teams (optional)"
          value={maxTeams}
          onChangeText={setMaxTeams}
          keyboardType="number-pad"
          placeholder="e.g. 4 — joining closes when full"
        />
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          You count as one team. When the last slot fills and rosters are in, fixtures generate automatically.
        </Text>
      </Card>

      <Card>
        <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 10 }}>League & playoffs</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>Group stage</Text>
        <ChipRow
          options={[
            { key: "1", label: "One table" },
            { key: "2", label: "2 groups" },
            { key: "4", label: "4 groups" },
          ]}
          value={groupCount}
          onChange={(v) => setGroupCount(v as typeof groupCount)}
        />
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 12, marginBottom: 8 }}>
          After the league stage
        </Text>
        <ChipRow
          scroll
          options={[
            { key: "none", label: "Table decides" },
            { key: "final", label: "Final (top 2)" },
            { key: "semis", label: "Semi-finals (top 4)" },
            { key: "quarters", label: "Quarter-finals (top 8)" },
          ]}
          value={playoffMode}
          onChange={(v) => setPlayoffMode(v as typeof playoffMode)}
        />
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
          {playoffMode === "none"
            ? "The points table decides the champion."
            : groupCount === "1"
              ? playoffMode === "final"
                ? "Top 2 on the table meet in the Final."
                : playoffMode === "semis"
                  ? "Seeded semis: 1st vs 4th, 2nd vs 3rd — winners meet in the Final."
                  : "Seeded quarters (1v8, 4v5, 3v6, 2v7) down to the Final."
              : groupCount === "2"
                ? playoffMode === "final"
                  ? "Group A winner vs Group B winner in the Final."
                  : "Cross-group knockout (A1 vs B2, B1 vs A2…) down to the Final."
                : "World Cup style cross-over (A1 vs B2, C1 vs D2…) down to the Final."}
        </Text>
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
