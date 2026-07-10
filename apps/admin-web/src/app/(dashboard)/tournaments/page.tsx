"use client";

// Admin-panel tournament console: the academy admin CREATES tournaments here,
// then hands them over to the organizer who runs them (or continues in the
// organizer portal). Day-to-day management lives at /organizer.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, EmptyState, Field, OutlineButton, PrimaryButton, StatusPill, Table } from "@/components/ui";
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

export default function AdminTournamentsPage() {
  const [user, setUser] = useState<TournamentUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Hand-over state: which tournament row has the transfer box open + email.
  const [handoverFor, setHandoverFor] = useState<string | null>(null);
  const [handoverEmail, setHandoverEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (u: TournamentUser) => {
    try {
      setError(null);
      if (u.role === "organizer") setMine(await tJson<Mine>("/tournaments/mine"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tournaments.");
    }
  }, []);

  useEffect(() => {
    const session = tournamentSession();
    setUser(session?.user ?? null);
    setChecked(true);
    if (session?.user) load(session.user);
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
              role: "organizer",
              organizationName: orgName.trim() || undefined,
            });
      setUser(u);
      load(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handover(tournament: MyTournament) {
    if (!handoverEmail.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await tJson<{ organizer: { name: string; email: string } }>(
        `/tournaments/${tournament.id}/transfer`,
        { method: "POST", body: JSON.stringify({ email: handoverEmail.trim() }) }
      );
      setNotice(
        `"${tournament.name}" handed over to ${res.organizer.name} (${res.organizer.email}) — it now appears in their /organizer portal.`
      );
      setHandoverFor(null);
      setHandoverEmail("");
      if (user) load(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hand-over failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return null;

  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Whistle - Tournaments</h1>
          <p className="text-sm text-text-secondary">
            Create tournaments here, then hand them over to the organizer who runs them. Log in with a tournament
            organizer account (separate from your academy login).
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
                {m === "login" ? "Login" : "Create Organizer Account"}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {mode === "signup" && (
              <>
                <Field label="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
                <Field label="Organization (optional)" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </>
            )}
            <Field label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Password *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-sm text-danger">{error}</p>}
            <PrimaryButton onClick={submitAuth} disabled={submitting} className="w-full">
              {submitting ? "Please wait…" : mode === "login" ? "Login" : "Create Account"}
            </PrimaryButton>
            <p className="text-xs text-text-secondary">Demo organizer: organizer@tourney.test / whistle123</p>
            <p className="text-xs text-text-secondary">
              External organizers manage tournaments at{" "}
              <a href="/organizer" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                /organizer
              </a>{" "}
              · players &amp; officials at{" "}
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
          <h1 className="text-xl font-semibold">Whistle - Tournaments</h1>
          <p className="text-sm text-text-secondary">
            {user.organizationName ?? user.name} · create here, hand over to the organizer who runs it
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
          <Link
            href="/tournaments/new"
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
          >
            + Create Tournament
          </Link>
        </div>
      </div>

      {notice && <Card className="border-success/40 text-sm text-success">{notice}</Card>}
      {error && <Card className="text-sm text-danger">{error}</Card>}

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
          <EmptyState message="No tournaments under this account. Create one, or it may already be handed over to an organizer." />
        </Card>
      ) : (
        <Table columns={["Tournament", "Sports", "Entries", "Status", "Public page", ""]}>
          {mine.tournaments.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-text-primary">{t.name}</div>
                <div className="text-xs text-text-secondary">{new Date(t.startDate).toLocaleDateString()}</div>
              </td>
              <td className="px-4 py-3 text-text-secondary">{t.sports.join(", ")}</td>
              <td className="px-4 py-3 text-text-secondary">
                {t.events.reduce((sum, e) => sum + e._count.entries, 0)}
              </td>
              <td className="px-4 py-3">
                <StatusPill tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status.replace("_", " ")}</StatusPill>
              </td>
              <td className="px-4 py-3">
                <a href={`/t/${t.publicSlug}`} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
                  /t/{t.publicSlug.slice(0, 22)}…
                </a>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-3">
                  <a href={`/organizer/${t.id}`} className="text-sm font-semibold text-accent hover:underline">
                    Manage ↗
                  </a>
                  {handoverFor === t.id ? (
                    <span className="flex items-center gap-2">
                      <input
                        value={handoverEmail}
                        onChange={(e) => setHandoverEmail(e.target.value)}
                        placeholder="organizer's email"
                        className="w-48 rounded-md border border-border bg-surface-alt px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                      />
                      <OutlineButton disabled={busy || !handoverEmail.trim()} onClick={() => handover(t)}>
                        {busy ? "…" : "Confirm"}
                      </OutlineButton>
                      <button
                        onClick={() => {
                          setHandoverFor(null);
                          setHandoverEmail("");
                        }}
                        className="text-xs text-text-secondary hover:text-text-primary"
                      >
                        ✕
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setHandoverFor(t.id);
                        setHandoverEmail("");
                        setNotice(null);
                      }}
                      className="text-sm text-text-secondary hover:text-accent"
                    >
                      Hand over →
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <p className="text-xs text-text-secondary">
        Hand over moves a tournament to another organizer account — it leaves this list and appears in their{" "}
        <a href="/organizer" className="text-accent hover:underline">
          /organizer
        </a>{" "}
        portal, where they run registration, fixtures, scoring and payouts.
      </p>
    </div>
  );
}
