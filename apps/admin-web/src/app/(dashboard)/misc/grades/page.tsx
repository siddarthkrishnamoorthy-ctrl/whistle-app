"use client";

import { useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, Field, PrimaryButton, Table } from "@/components/ui";
import type { Grade } from "@/lib/types";

export default function GradesPage() {
  const { data: grades, loading, error, refetch } = useApiList<Grade>("/grades");
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await apiJson("/grades", { method: "POST", body: JSON.stringify({ name: newName.trim() }) });
      setNewName("");
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not add grade.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    const name = renaming[id];
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await apiJson(`/grades/${id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
      setRenaming((prev) => ({ ...prev, [id]: "" }));
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not rename grade.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Grades</h1>
        <p className="text-sm text-text-secondary">
          KG through Grade 12 are seeded automatically — relabel entries (e.g. "Reception"/"Year 1") without breaking
          sequencing, since order is driven by position, not the name.
        </p>
      </div>

      <Card className="flex items-end gap-3">
        <Field label="Add a grade level" placeholder="e.g. Grade 13" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <PrimaryButton className="w-auto px-6" onClick={handleAdd} disabled={busy || !newName.trim()}>
          Add
        </PrimaryButton>
      </Card>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : (
        <Table columns={["Order", "Name", "Relabel", ""]}>
          {grades.map((g) => (
            <tr key={g.id} className="hover:bg-surface-alt">
              <td className="px-4 py-3 text-text-secondary">{g.sortOrder}</td>
              <td className="px-4 py-3 font-medium text-text-primary">{g.name}</td>
              <td className="px-4 py-3">
                <input
                  placeholder="New label…"
                  value={renaming[g.id] ?? ""}
                  onChange={(e) => setRenaming((prev) => ({ ...prev, [g.id]: e.target.value }))}
                  className="w-full rounded-md border border-border bg-surface-alt px-3 py-1.5 text-sm text-text-primary"
                />
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleRename(g.id)}
                  disabled={busy || !renaming[g.id]?.trim()}
                  className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary hover:bg-surface-alt disabled:opacity-50"
                >
                  Save
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
