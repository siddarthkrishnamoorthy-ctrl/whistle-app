"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, EmptyState, Field, PrimaryButton, SelectField, StatusPill, Table } from "@/components/ui";
import {
  clearTournamentSession,
  tJson,
  tournamentLogin,
  tournamentSession,
  tournamentSignup,
  type TournamentUser,
} from "@/lib/tournament-client";

interface MyTournament {
  id: string;
  name: string;
  status: string;
  startDate: string;
  publicSlug: string;
  sports: string[];
  events: { id: string; name: string; _count: { entries: number } }[];
}

interface Mine {
  tournaments: MyTournament[];
  stats: { active: number; registrations: number; collected: number };
}

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  registration_open: "success",
  in_progress: "warning",
  draft: "neutral",
  completed: "neutral",
};

export default function TournamentsPage() {
  const [user, setUser] = useState<TournamentUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "open" = Whistle - Tournaments; "lbl" = LBL - Tournaments (same engine,
  // separate lists — reached via the LBL sidebar section).
  const [series, setSeries] = useState<"open" | "lbl">("open");

  // Login/signup form state
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("organizer");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (u: TournamentUser, s: "open" | "lbl") => {
    try {
      setError(null);
      if (u.role === "organizer") setMine(await tJson<Mine>(`/tournaments/mine?series=${s}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tournaments.");
    }
  }, []);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("series") === "lbl" ? "lbl" : "open";
    setSeries(s);
    const session = tournamentSession();
    setUser(session?.user ?? null);
    setChecked(true);
    if (session?.user) load(session.user, s);
  }, [load]);

  async function submitAuth() {
    setSubmitting(true);
    setError(null);
    try {
      const u =
        mode === "login"
          ? await tournamentLogin(email.trim(), password)
          : await tournamentSignup({
              name: name.trim(),
              email: email.trim(),
              password,
              role,
              organizationName: role === "organizer" && orgName.trim() ? orgName.trim() : undefined,
            });
      setUser(u);
      load(u, series);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const consoleTitle = series === "lbl" ? "LBL - Tournaments" : "Whistle - Tournaments";

  if (!checked) return null;

  // ── Gate: the tournament module has its own open user master ──
  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">{consoleTitle}</h1>
          <p className="text-sm text-text-secondary">
            Standalone open tournaments — separate from your academy. Anyone can organize, officiate or play; log in
            with a tournament account (your academy login doesn&apos;t apply here).
          </p>
        </div>
        <Card className="max-w-md">
          <div className="mb-4 flex gap-2">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                  mode === m ? "bg-accent text-accent-text" : "border border-border text-text-secondary"
                }`}
              >
                {m === "login" ? "Login" : "Create Account"}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {mode === "signup" && (
              <>
                <Field label="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
                <SelectField label="I am a…" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="organizer">Organizer — host tournaments</option>
                  <option value="official">Official — score matches</option>
                  <option value="registrant">Player / Team</option>
                </SelectField>
                {role === "organizer" && (
                  <Field label="Organization (optional)" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                )}
              </>
            )}
            <Field label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Password *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-sm text-danger">{error}</p>}
            <PrimaryButton onClick={submitAuth} disabled={submitting} className="w-full">
              {submitting ? "Please wait…" : mode === "login" ? "Login" : "Create Account"}
            </PrimaryButton>
            <p className="text-xs text-text-secondary">
              Demo organizer: organizer@tourney.test / whistle123
            </p>
            <p className="text-xs text-text-secondary">
              Players and officials don&apos;t sign up here — send them the public portal:{" "}
              <a href="/play" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                /play
              </a>
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{consoleTitle}</h1>
          <p className="text-sm text-text-secondary">
            {user.organizationName ?? user.name} · {user.role} account (standalone — no academy link)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              clearTournamentSession();
              setUser(null);
              setMine(null);
            }}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            Log out of Tournaments
          </button>
          {user.role === "organizer" && (
            <Link
              href={`/tournaments/new?series=${series}`}
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
            >
              + Create {series === "lbl" ? "LBL " : ""}Tournament
            </Link>
          )}
        </div>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {user.role !== "organizer" ? (
        <Card className="space-y-2">
          <EmptyState message="This console is for organizers only." />
          <p className="text-center text-sm text-text-secondary">
            You&apos;re logged in as {user.role === "official" ? "an official" : "a player"} — your{" "}
            {user.role === "official" ? "scoring console" : "registrations"} live on the public portal:{" "}
            <a href="/play" className="font-semibold text-accent hover:underline">
              open /play →
            </a>
          </p>
        </Card>
      ) : (
        <>
          {mine && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Active tournaments", value: mine.stats.active },
                { label: "Total registrations", value: mine.stats.registrations },
                { label: "Fees collected", value: `₹${mine.stats.collected}` },
              ].map((s) => (
                <Card key={s.label} className="text-center">
                  <div className="text-2xl font-bold text-accent">{s.value}</div>
                  <div className="text-xs text-text-secondary">{s.label}</div>
                </Card>
              ))}
            </div>
          )}

          {!mine || mine.tournaments.length === 0 ? (
            <Card>
              <EmptyState message="No tournaments yet — create your first one." />
            </Card>
          ) : (
            <Table columns={["Tournament", "Sports", "Events", "Entries", "Status", "Public page", ""]}>
              {mine.tournaments.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{t.name}</div>
                    <div className="text-xs text-text-secondary">{new Date(t.startDate).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{t.sports.join(", ")}</td>
                  <td className="px-4 py-3 text-text-secondary">{t.events.length}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {t.events.reduce((sum, e) => sum + e._count.entries, 0)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status.replace("_", " ")}</StatusPill>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/t/${t.publicSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-accent hover:underline"
                    >
                      /t/{t.publicSlug}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/tournaments/${t.id}`} className="text-sm font-semibold text-accent hover:underline">
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}
    </div>
  );
}
