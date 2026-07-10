"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Field, PrimaryButton, OutlineButton, SelectField, TextareaField } from "@/components/ui";
import { tJson, tournamentSession } from "@/lib/tournament-client";

// Sport catalogue for the open tournament module (broader than the academy
// taxonomy — pickleball, squash, chess etc. are common open-tournament sports).
const SPORT_OPTIONS = [
  "Badminton",
  "Pickleball",
  "Tennis",
  "Table Tennis",
  "Squash",
  "Cricket",
  "Football",
  "Basketball",
  "Volleyball",
  "Throwball",
  "Hockey",
  "Kabaddi",
  "Athletics (Track & Field)",
  "Swimming",
  "Chess",
  "Carrom",
] as const;

const sportKeyOf = (label: string) => label.toLowerCase().replace(/\s*\(.*\)/, "").replace(/\s+/g, "-");

interface EventDraft {
  name: string;
  sport: string;
  kind: "individual" | "team";
  discipline: "match" | "timed";
  format: "single_elim" | "round_robin" | "league";
  unit: "sec" | "m";
  feeMode: "free" | "paid";
  entryFee: string;
  maxEntrants: string;
  duprRated: "no" | "yes";
}

const BLANK: EventDraft = {
  name: "",
  sport: "Badminton",
  kind: "individual",
  discipline: "match",
  format: "single_elim",
  unit: "sec",
  feeMode: "free",
  entryFee: "",
  maxEntrants: "",
  duprRated: "no",
};

// BRD 6.2 — Create Tournament wizard: basics, events, fees, courts/venues.
export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venues, setVenues] = useState("");
  const [events, setEvents] = useState<EventDraft[]>([{ ...BLANK }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Created under the console it was opened from (Whistle or LBL).
  const [series, setSeries] = useState<"open" | "lbl">("open");

  useEffect(() => {
    setSeries(new URLSearchParams(window.location.search).get("series") === "lbl" ? "lbl" : "open");
  }, []);

  if (typeof window !== "undefined" && !tournamentSession()) {
    router.replace("/organizer");
  }

  function update(i: number, patch: Partial<EventDraft>) {
    setEvents((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  async function submit(publish: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      if (!name.trim()) throw new Error("Give the tournament a name.");
      if (!startDate) throw new Error("Pick a start date.");
      const eventBodies = events
        .filter((e) => e.name.trim())
        .map((e) => ({
          name: e.name.trim(),
          sportKey: sportKeyOf(e.sport),
          kind: e.kind,
          discipline: e.discipline,
          format: e.format,
          unit: e.discipline === "timed" ? e.unit : undefined,
          entryFee: e.feeMode === "paid" && e.entryFee ? Number(e.entryFee) : undefined,
          maxEntrants: e.maxEntrants ? Number(e.maxEntrants) : undefined,
          duprRated: e.sport === "Pickleball" && e.duprRated === "yes",
        }));
      if (!eventBodies.length) throw new Error("Add at least one event.");
      if (events.some((e) => e.name.trim() && e.feeMode === "paid" && (!e.entryFee || Number(e.entryFee) <= 0))) {
        throw new Error("Paid events need an entry fee amount — or switch them to free entry.");
      }
      // The tournament's sports list is derived from its events.
      const sportsList = [...new Set(eventBodies.map((e) => e.sportKey))];
      const created = await tJson<{ id: string }>("/tournaments", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          rules: rules.trim() || undefined,
          series,
          sports: sportsList,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate || startDate).toISOString(),
          venues: venues.split(",").map((v) => v.trim()).filter(Boolean),
          events: eventBodies,
        }),
      });
      if (publish) await tJson(`/tournaments/${created.id}/publish`, { method: "POST" });
      router.replace(`/organizer/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create tournament.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Create {series === "lbl" ? "LBL " : ""}Tournament</h1>
        <p className="text-sm text-text-secondary">
          Basics, events and entry fees — publish to open registration
          {series === "lbl" ? " · listed under LBL - Tournaments" : ""}
        </p>
      </div>

      <Card className="space-y-3">
        <Field label="Tournament name *" placeholder="e.g. Whistle Pickleball Open 2026" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Description" placeholder="Short blurb shown on the public page" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date *" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Field label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Field label="Courts / venues (comma separated)" placeholder="Court 1, Court 2" value={venues} onChange={(e) => setVenues(e.target.value)} />
        <TextareaField
          label="Rules & regulations (shown on the public page)"
          placeholder={"e.g.\n• Matches are best of 3 games to 11, win by 2\n• 5-minute walkover if a player is absent\n• Rally scoring; referee's decision is final\n• No refunds after fixtures are published"}
          rows={5}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
        />
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Events</h2>
        <OutlineButton onClick={() => setEvents((prev) => [...prev, { ...BLANK }])}>+ Add Event</OutlineButton>
      </div>

      {events.map((ev, i) => (
        <Card key={i} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">Event {i + 1}</span>
            {events.length > 1 && (
              <button onClick={() => setEvents((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-danger hover:underline">
                Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Event name *" placeholder="Pickleball Men's Doubles" value={ev.name} onChange={(e) => update(i, { name: e.target.value })} />
            <SelectField label="Sport" value={ev.sport} onChange={(e) => update(i, { sport: e.target.value })}>
              {SPORT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Entry type" value={ev.kind} onChange={(e) => update(i, { kind: e.target.value as EventDraft["kind"] })}>
              <option value="individual">Individual</option>
              <option value="team">Team / Pair</option>
            </SelectField>
            <SelectField label="Discipline" value={ev.discipline} onChange={(e) => update(i, { discipline: e.target.value as EventDraft["discipline"] })}>
              <option value="match">Matches</option>
              <option value="timed">Timed / measured</option>
            </SelectField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {ev.discipline === "match" ? (
              <SelectField label="Format" value={ev.format} onChange={(e) => update(i, { format: e.target.value as EventDraft["format"] })}>
                <option value="single_elim">Knockout</option>
                <option value="round_robin">Round robin — all play once</option>
                <option value="league">League (home & away, points table)</option>
              </SelectField>
            ) : (
              <SelectField label="Measured in" value={ev.unit} onChange={(e) => update(i, { unit: e.target.value as EventDraft["unit"] })}>
                <option value="sec">Time — lowest wins</option>
                <option value="m">Distance — highest wins</option>
              </SelectField>
            )}
            <SelectField label="Entry" value={ev.feeMode} onChange={(e) => update(i, { feeMode: e.target.value as EventDraft["feeMode"] })}>
              <option value="free">Free entry</option>
              <option value="paid">Paid entry</option>
            </SelectField>
            {ev.feeMode === "paid" ? (
              <Field label="Entry fee ₹ *" type="number" placeholder="500" value={ev.entryFee} onChange={(e) => update(i, { entryFee: e.target.value })} />
            ) : (
              <Field label="Max entrants (optional)" type="number" placeholder="32" value={ev.maxEntrants} onChange={(e) => update(i, { maxEntrants: e.target.value })} />
            )}
          </div>
          {ev.feeMode === "paid" && (
            <Field label="Max entrants (optional)" type="number" placeholder="32" value={ev.maxEntrants} onChange={(e) => update(i, { maxEntrants: e.target.value })} />
          )}
          {ev.sport === "Pickleball" && ev.discipline === "match" && (
            <div className="rounded-lg border border-border bg-surface-alt/50 p-3">
              <SelectField
                label="DUPR rating (pickleball)"
                value={ev.duprRated}
                onChange={(e) => update(i, { duprRated: e.target.value as EventDraft["duprRated"] })}
              >
                <option value="no">Not DUPR rated</option>
                <option value="yes">DUPR rated</option>
              </SelectField>
              {ev.duprRated === "yes" && (
                <p className="mt-2 text-xs text-text-secondary">
                  Completed match results are queued for DUPR submission and shown as &quot;DUPR rated&quot; on the
                  public page. Live sync activates once your DUPR API key is configured on the server.
                </p>
              )}
            </div>
          )}
        </Card>
      ))}

      {error && <Card className="text-sm text-danger">{error}</Card>}

      <div className="flex gap-3">
        <PrimaryButton onClick={() => submit(true)} disabled={submitting}>
          {submitting ? "Creating…" : "Create & Open Registration"}
        </PrimaryButton>
        <OutlineButton onClick={() => submit(false)} disabled={submitting}>
          Save as draft
        </OutlineButton>
      </div>
    </div>
  );
}
