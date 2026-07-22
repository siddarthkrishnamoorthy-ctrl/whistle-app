"use client";

// Lightweight global toast. Call `toast("Saved", "success")` from anywhere;
// mount <Toaster /> once per layout. No external deps.

import { useEffect, useState } from "react";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

let listeners: ((t: ToastItem) => void)[] = [];
let counter = 0;

export function toast(message: string, tone: Tone = "success") {
  const item: ToastItem = { id: ++counter, message, tone };
  listeners.forEach((l) => l(item));
}

const TONE: Record<Tone, { ring: string; icon: string; text: string }> = {
  success: { ring: "border-emerald-400/50 bg-emerald-400/10", icon: "✓", text: "text-emerald-300" },
  error: { ring: "border-rose-400/50 bg-rose-400/10", icon: "✕", text: "text-rose-300" },
  info: { ring: "border-sky-400/50 bg-sky-400/10", icon: "ℹ", text: "text-sky-300" },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3200);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[200] flex max-w-sm flex-col gap-2">
      {items.map((t) => {
        const tn = TONE[t.tone];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-lg border ${tn.ring} bg-[#141A28] px-4 py-3 text-sm text-text-primary shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md`}
            role="status"
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tn.text}`}>{tn.icon}</span>
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
