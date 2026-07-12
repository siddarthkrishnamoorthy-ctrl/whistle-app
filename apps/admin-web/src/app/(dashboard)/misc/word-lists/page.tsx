"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, CollapsibleSection, EmptyState, Field, PrimaryButton, StatusPill, TextareaField } from "@/components/ui";

interface ListRow {
  id: string;
  title: string;
  description: string | null;
  wordCount: number;
}
interface Entry {
  id: string;
  word: string;
  definition: string;
  example: string | null;
}
interface ListDetail {
  id: string;
  title: string;
  description: string | null;
  academyId: string | null;
  entries: Entry[];
}

// Scrabble Word Power lists (Scrabble §5.3) — Admin/Head-Coach authoring. The
// platform starter library (academyId=null) shows read-only; academy lists are
// fully editable and feed the students' spaced-repetition Word Power tests.
export default function WordListsPage() {
  const [lists, setLists] = useState<ListRow[]>([]);
  const [details, setDetails] = useState<Record<string, ListDetail>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const load = useCallback(() => {
    apiJson<ListRow[]>("/scrabble/word-lists")
      .then(setLists)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load word lists."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadDetail(id: string) {
    if (details[id]) return;
    const d = await apiJson<ListDetail>(`/scrabble/word-lists/${id}`).catch(() => null);
    if (d) setDetails((prev) => ({ ...prev, [id]: d }));
  }

  async function createList() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await apiJson("/scrabble/word-lists", { method: "POST", body: JSON.stringify({ title: newTitle, description: newDesc }) });
      setNewTitle("");
      setNewDesc("");
      setLoading(true);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not create the list.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Scrabble Word Lists</h1>
        <p className="text-sm text-text-secondary">
          Build vocabulary sets your students drill through spaced-repetition Word Power tests.
        </p>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {/* Create a new list */}
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">New word list</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Title" placeholder="e.g. Grade 6 Spelling Words" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Field label="Description (optional)" placeholder="What this list is for" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
        </div>
        <PrimaryButton className="w-auto px-6" onClick={createList} disabled={creating || !newTitle.trim()}>
          {creating ? "Creating…" : "Create list"}
        </PrimaryButton>
      </Card>

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : lists.length === 0 ? (
        <Card>
          <EmptyState message="No word lists yet — create one above." />
        </Card>
      ) : (
        <div className="space-y-3">
          {lists.map((l) => (
            <div key={l.id} onClick={() => loadDetail(l.id)}>
              <CollapsibleSection
                title={l.title}
                count={l.wordCount}
                subtitle={l.description ?? undefined}
                defaultOpen={false}
                right={details[l.id]?.academyId == null ? <StatusPill tone="info">starter</StatusPill> : undefined}
              >
                <WordListEditor
                  id={l.id}
                  detail={details[l.id]}
                  onReload={async () => {
                    const d = await apiJson<ListDetail>(`/scrabble/word-lists/${l.id}`).catch(() => null);
                    if (d) setDetails((prev) => ({ ...prev, [l.id]: d }));
                    setLists((prev) => prev.map((x) => (x.id === l.id ? { ...x, wordCount: d?.entries.length ?? x.wordCount } : x)));
                  }}
                />
              </CollapsibleSection>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WordListEditor({ id, detail, onReload }: { id: string; detail?: ListDetail; onReload: () => Promise<void> }) {
  const [word, setWord] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [busy, setBusy] = useState(false);
  const readOnly = detail?.academyId == null;

  if (!detail) return <div className="p-4 text-sm text-text-secondary">Loading words…</div>;

  async function addEntry() {
    if (!word.trim() || !definition.trim()) return;
    setBusy(true);
    try {
      await apiJson(`/scrabble/word-lists/${id}/entries`, { method: "POST", body: JSON.stringify({ word, definition, example }) });
      setWord("");
      setDefinition("");
      setExample("");
      await onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not add the word.");
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(entryId: string) {
    await apiJson(`/scrabble/word-lists/${id}/entries/${entryId}/delete`, { method: "POST" }).catch(() => undefined);
    await onReload();
  }

  return (
    <div className="space-y-3 p-4">
      {detail.entries.length === 0 ? (
        <p className="text-sm text-text-secondary">No words yet.</p>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {detail.entries.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <span className="font-semibold uppercase text-text-primary">{e.word}</span>
                <span className="text-text-secondary"> — {e.definition}</span>
                {e.example ? <div className="text-xs italic text-text-muted">“{e.example}”</div> : null}
              </div>
              {!readOnly && (
                <button onClick={() => removeEntry(e.id)} className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:border-danger hover:text-danger">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {readOnly ? (
        <p className="text-xs text-text-muted">This is a Whistle starter list — copy it into your own list to edit.</p>
      ) : (
        <div className="space-y-2 rounded-lg border border-border bg-surface-alt p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="Word" placeholder="e.g. quiet" value={word} onChange={(ev) => setWord(ev.target.value)} />
            <Field label="Definition" placeholder="meaning" value={definition} onChange={(ev) => setDefinition(ev.target.value)} />
            <Field label="Example (optional)" placeholder="used in a sentence" value={example} onChange={(ev) => setExample(ev.target.value)} />
          </div>
          <PrimaryButton className="w-auto px-6" onClick={addEntry} disabled={busy || !word.trim() || !definition.trim()}>
            {busy ? "Adding…" : "+ Add word"}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
