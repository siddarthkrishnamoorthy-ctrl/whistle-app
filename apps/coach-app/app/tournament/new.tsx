import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Field, PrimaryButton, ChipRow, SectionHeader, colors } from "@/components/ui";
import { tFetch } from "@/lib/tournament-api";

interface EventDraft {
  name: string;
  sportKey: string;
  kind: "team" | "individual";
  discipline: "match" | "timed";
  format: "round_robin" | "single_elim";
  unit: "sec" | "m";
  entryFee: string;
  maxEntrants: string;
}

const BLANK_EVENT: EventDraft = {
  name: "",
  sportKey: "badminton",
  kind: "individual",
  discipline: "match",
  format: "single_elim",
  unit: "sec",
  entryFee: "",
  maxEntrants: "",
};

// BRD 6.2 — Create Tournament wizard: basics, events, fees, venues.
export default function NewTournamentScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sports, setSports] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venues, setVenues] = useState("");
  const [events, setEvents] = useState<EventDraft[]>([{ ...BLANK_EVENT }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateEvent(i: number, patch: Partial<EventDraft>) {
    setEvents((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  async function submit(publish: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const sportsList = sports
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        sports: sportsList.length ? sportsList : ["multi-sport"],
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate || startDate).toISOString(),
        venues: venues.split(",").map((v) => v.trim()).filter(Boolean),
        events: events
          .filter((e) => e.name.trim())
          .map((e) => ({
            name: e.name.trim(),
            sportKey: e.sportKey.trim().toLowerCase() || "multi-sport",
            kind: e.kind,
            discipline: e.discipline,
            format: e.format,
            unit: e.discipline === "timed" ? e.unit : undefined,
            entryFee: e.entryFee ? Number(e.entryFee) : undefined,
            maxEntrants: e.maxEntrants ? Number(e.maxEntrants) : undefined,
          })),
      };
      if (!body.events.length) throw new Error("Add at least one event.");
      if (Number.isNaN(new Date(startDate).getTime())) throw new Error("Start date must be YYYY-MM-DD.");
      const created = await tFetch<{ id: string }>("/tournaments", { method: "POST", body: JSON.stringify(body) });
      if (publish) await tFetch(`/tournaments/${created.id}/publish`, { method: "POST" });
      router.replace(`/tournament/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create tournament.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <SectionHeader title="Basics" />
      <Field label="Tournament Name" placeholder="e.g. Bangalore Open 2026" value={name} onChangeText={setName} />
      <Field label="Description (optional)" placeholder="Short blurb for the public page" value={description} onChangeText={setDescription} />
      <Field label="Sports (comma separated)" placeholder="badminton, athletics" value={sports} onChangeText={setSports} />
      <Field label="Start Date" placeholder="YYYY-MM-DD" autoCapitalize="none" value={startDate} onChangeText={setStartDate} />
      <Field label="End Date" placeholder="YYYY-MM-DD" autoCapitalize="none" value={endDate} onChangeText={setEndDate} />
      <Field label="Courts / Venues (comma separated)" placeholder="Court 1, Court 2, Track" value={venues} onChangeText={setVenues} />

      <SectionHeader
        title="Events"
        action={
          <Pressable onPress={() => setEvents((prev) => [...prev, { ...BLANK_EVENT }])}>
            <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>+ Add Event</Text>
          </Pressable>
        }
      />
      {events.map((ev, i) => (
        <Card key={i} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700" }}>EVENT {i + 1}</Text>
            {events.length > 1 && (
              <Pressable onPress={() => setEvents((prev) => prev.filter((_, idx) => idx !== i))}>
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Field label="Event Name" placeholder="e.g. Men's Singles / 100m Sprint" value={ev.name} onChangeText={(v) => updateEvent(i, { name: v })} />
          <Field label="Sport" placeholder="badminton" autoCapitalize="none" value={ev.sportKey} onChangeText={(v) => updateEvent(i, { sportKey: v })} />

          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Entry type</Text>
          <ChipRow
            options={[
              { key: "individual", label: "Individual" },
              { key: "team", label: "Team" },
            ]}
            value={ev.kind}
            onChange={(v) => updateEvent(i, { kind: v as EventDraft["kind"] })}
          />
          <View style={{ height: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Discipline</Text>
          <ChipRow
            options={[
              { key: "match", label: "Matches" },
              { key: "timed", label: "Timed / Measured" },
            ]}
            value={ev.discipline}
            onChange={(v) => updateEvent(i, { discipline: v as EventDraft["discipline"] })}
          />
          <View style={{ height: 10 }} />
          {ev.discipline === "match" ? (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Format</Text>
              <ChipRow
                options={[
                  { key: "single_elim", label: "Knockout" },
                  { key: "round_robin", label: "Round Robin" },
                ]}
                value={ev.format}
                onChange={(v) => updateEvent(i, { format: v as EventDraft["format"] })}
              />
              <View style={{ height: 10 }} />
            </>
          ) : (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Measured in</Text>
              <ChipRow
                options={[
                  { key: "sec", label: "Time (sec)" },
                  { key: "m", label: "Distance (m)" },
                ]}
                value={ev.unit}
                onChange={(v) => updateEvent(i, { unit: v as EventDraft["unit"] })}
              />
              <View style={{ height: 10 }} />
            </>
          )}
          <Field label="Entry Fee ₹ (blank = free)" placeholder="500" keyboardType="numeric" value={ev.entryFee} onChangeText={(v) => updateEvent(i, { entryFee: v })} />
          <Field label="Max Entrants (optional)" placeholder="32" keyboardType="numeric" value={ev.maxEntrants} onChangeText={(v) => updateEvent(i, { maxEntrants: v })} />
        </Card>
      ))}

      {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

      <PrimaryButton title={submitting ? "Creating…" : "Create & Open Registration"} onPress={() => submit(true)} disabled={submitting} />
      <View style={{ height: 10 }} />
      <Pressable onPress={() => submit(false)} disabled={submitting} style={{ alignItems: "center", paddingVertical: 10 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Save as draft instead</Text>
      </Pressable>
    </ScrollView>
  );
}
