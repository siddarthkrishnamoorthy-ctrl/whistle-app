"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useApiList } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-context";
import { Card, EmptyState, PrimaryButton } from "@/components/ui";
import type { ChatMessage, ChatThread, ChatUser } from "@/lib/types";

type Filter = "all" | "chats" | "groups" | "members";

export function ChatTab() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const { data: threads, loading, refetch: refetchThreads } = useApiList<ChatThread>("/communication/threads");
  const { data: members } = useApiList<ChatUser>("/communication/members");

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    apiJson<ChatMessage[]>(`/communication/threads/${activeThreadId}/messages`).then(setMessages);
  }, [activeThreadId]);

  const visibleThreads = threads.filter((t) => {
    if (filter === "chats") return t.type === "direct";
    if (filter === "groups") return t.type === "group";
    return true;
  });

  function threadLabel(t: ChatThread) {
    if (t.name) return t.name;
    const others = t.members.filter((m) => m.id !== user?.id);
    return others.map((m) => m.name).join(", ") || "You";
  }

  async function startDirectChat(memberId: string) {
    const thread = await apiJson<ChatThread>("/communication/threads", {
      method: "POST",
      body: JSON.stringify({ type: "direct", memberIds: [memberId] }),
    });
    refetchThreads();
    setActiveThreadId(thread.id);
    setFilter("all");
  }

  async function handleSend() {
    if (!activeThreadId || !draft.trim()) return;
    setSending(true);
    try {
      const message = await apiJson<ChatMessage>(`/communication/threads/${activeThreadId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });
      setMessages((prev) => [...prev, message]);
      setDraft("");
      refetchThreads();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="space-y-3 lg:col-span-1">
        <div className="flex gap-1 text-xs">
          {(["all", "chats", "groups", "members"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 font-medium capitalize transition ${
                filter === f ? "bg-accent text-accent-text" : "bg-surface-alt text-text-secondary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {filter === "members" ? (
          <div className="space-y-1">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => startDirectChat(m.id)}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-alt"
              >
                {m.name}
                <span className="ml-2 text-xs text-text-muted">{m.role}</span>
              </button>
            ))}
          </div>
        ) : loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : visibleThreads.length === 0 ? (
          <EmptyState message="No conversations yet. Start one from Members." />
        ) : (
          <div className="space-y-1">
            {visibleThreads.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveThreadId(t.id)}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm transition ${
                  activeThreadId === t.id ? "bg-accent/15 text-accent" : "text-text-primary hover:bg-surface-alt"
                }`}
              >
                <div className="font-medium">{threadLabel(t)}</div>
                <div className="truncate text-xs text-text-muted">{t.lastMessage?.body ?? "No messages yet"}</div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col lg:col-span-2" style={{ minHeight: 420 }}>
        {!activeThread ? (
          <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
            Select a conversation to start chatting.
          </div>
        ) : (
          <>
            <div className="mb-3 border-b border-border pb-3">
              <h3 className="font-semibold text-text-primary">{threadLabel(activeThread)}</h3>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto">
              {messages.length === 0 && <p className="text-sm text-text-secondary">No messages yet.</p>}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.senderId === user?.id ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      m.senderId === user?.id ? "bg-accent text-accent-text" : "bg-surface-alt text-text-primary"
                    }`}
                  >
                    {m.senderId !== user?.id && <div className="text-xs font-medium opacity-70">{m.sender.name}</div>}
                    {m.body}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message…"
                className="flex-1 rounded-md border border-border bg-surface-alt px-3.5 py-2.5 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <PrimaryButton className="w-auto px-5" onClick={handleSend} disabled={sending || !draft.trim()}>
                Send
              </PrimaryButton>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
