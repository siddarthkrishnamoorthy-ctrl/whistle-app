"use client";

import { useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { Card, EmptyState, Field, PrimaryButton, TextareaField } from "@/components/ui";
import type { NoticeBoardPost } from "@/lib/types";

export function NoticeBoardTab() {
  const { data: notices, loading, refetch } = useApiList<NoticeBoardPost>("/communication/notices");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePost() {
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      await apiJson("/communication/notices", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });
      setTitle("");
      setContent("");
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post announcement.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h3 className="font-semibold text-text-primary">Post an announcement</h3>
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextareaField label="Content" rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <PrimaryButton className="w-auto px-6" onClick={handlePost} disabled={posting}>
          {posting ? "Posting…" : "Post Announcement"}
        </PrimaryButton>
      </Card>

      <div>
        <h3 className="mb-3 font-semibold text-text-primary">Recent notices</h3>
        {loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : notices.length === 0 ? (
          <Card>
            <EmptyState message="No notices posted yet." />
          </Card>
        ) : (
          <div className="space-y-3">
            {notices.map((n) => (
              <Card key={n.id}>
                <div className="flex items-start justify-between gap-4">
                  <h4 className="font-medium text-text-primary">{n.title}</h4>
                  <span className="shrink-0 text-xs text-text-muted">
                    {new Date(n.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{n.content}</p>
                <p className="mt-2 text-xs text-text-muted">By {n.author.name}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
