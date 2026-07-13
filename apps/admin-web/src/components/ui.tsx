"use client";

import { InputHTMLAttributes, ButtonHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, useState } from "react";
import clsx from "clsx";

export function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-text-secondary">{label}</span>
      <input
        {...props}
        className={clsx(
          "w-full rounded-md border border-border bg-surface-alt px-3.5 py-2.5 text-text-primary placeholder:text-text-muted",
          "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          props.className
        )}
      />
    </label>
  );
}

export function TextareaField({
  label,
  ...props
}: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-text-secondary">{label}</span>
      <textarea
        {...props}
        className={clsx(
          "w-full rounded-md border border-border bg-surface-alt px-3.5 py-2.5 text-text-primary placeholder:text-text-muted",
          "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          props.className
        )}
      />
    </label>
  );
}

export function SelectField({
  label,
  children,
  compact,
  ...props
}: { label?: string; compact?: boolean } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-sm text-text-secondary">{label}</span> : null}
      <span className="relative block">
        <select
          {...props}
          className={clsx(
            // appearance-none kills the mismatched native arrow; the padding
            // reserves room for our chevron so long labels truncate cleanly
            // instead of running under it. `compact` is the inline-filter /
            // table-cell size — same look, smaller footprint.
            "w-full appearance-none truncate rounded-lg border border-border bg-surface-alt text-text-primary",
            compact ? "py-1.5 pl-3 pr-9 text-sm" : "py-2.5 pl-3.5 pr-10",
            "transition-colors hover:border-white/30 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
            props.className
          )}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="none"
          className={clsx(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-secondary",
            compact ? "right-2.5 h-3.5 w-3.5" : "right-3 h-4 w-4"
          )}
        >
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
  );
}

export function PrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "w-full rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-text transition hover:opacity-90 disabled:opacity-50",
        className
      )}
    />
  );
}

export function OutlineButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "w-full rounded-full border border-border bg-transparent px-4 py-2.5 font-semibold text-text-primary transition hover:bg-surface-alt disabled:opacity-50",
        className
      )}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={clsx(
        "rounded-lg border border-border bg-surface p-5 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md",
        className
      )}
    />
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  children: React.ReactNode;
}) {
  const toneClasses: Record<typeof tone, string> = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
    info: "bg-info/15 text-info",
    neutral: "bg-text-muted/15 text-text-secondary",
  };
  const glowClasses: Record<typeof tone, string> = {
    success: "border-success/40 shadow-[0_0_10px_rgba(52,211,153,0.35)]",
    warning: "border-warning/40 shadow-[0_0_10px_rgba(251,162,60,0.35)]",
    danger: "border-danger/40 shadow-[0_0_10px_rgba(248,113,113,0.35)]",
    info: "border-info/40 shadow-[0_0_10px_rgba(96,165,250,0.35)]",
    neutral: "border-border",
  };
  return (
    <span
      className={clsx("rounded-full border px-2.5 py-0.5 text-xs font-medium", toneClasses[tone], glowClasses[tone])}
    >
      {children}
    </span>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={clsx(
            "px-4 py-2 text-sm font-medium transition",
            active === tab.key
              ? "border-b-2 border-accent text-accent"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Table({
  columns,
  children,
  // `flush` drops the table's own card chrome — use it when the table sits
  // INSIDE another surface (e.g. a CollapsibleSection) so you don't get a
  // washed-out card-in-a-card frame.
  flush,
}: {
  columns: string[];
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div
      className={clsx(
        "overflow-x-auto",
        flush ? "" : "rounded-lg border border-border bg-surface shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md"
      )}
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        {/* Soft dividers instead of boxy grid lines; row hover comes from globals.css */}
        <tbody className="divide-y divide-white/[0.06]">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="p-10 text-center text-sm text-text-secondary">{message}</div>;
}

// Standard search box with a leading magnifier — used to filter long lists so
// users narrow before scrolling. Same border/focus treatment as the inputs.
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <span className={clsx("relative block", className)}>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
      >
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14 14l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface-alt py-2.5 pl-10 pr-9 text-text-primary transition-colors placeholder:text-text-muted hover:border-white/30 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-text-primary"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}

// Collapsible group header for grouping long lists (by class, sport, center…).
// Opens compact; the count + chevron make the size legible before expanding.
export function CollapsibleSection({
  title,
  count,
  subtitle,
  defaultOpen = true,
  right,
  children,
}: {
  title: React.ReactNode;
  count?: number;
  subtitle?: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-alt"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            className={clsx("h-4 w-4 shrink-0 text-text-muted transition-transform", open ? "rotate-90" : "")}
          >
            <path d="M8 6l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-text-primary">{title}</span>
            {subtitle ? <span className="block truncate text-xs text-text-muted">{subtitle}</span> : null}
          </span>
          {typeof count === "number" ? (
            <span className="ml-1 shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-text-secondary">
              {count}
            </span>
          ) : null}
        </span>
        {right ? <span className="shrink-0">{right}</span> : null}
      </button>
      {open ? <div className="border-t border-border">{children}</div> : null}
    </div>
  );
}

// Compact metric tile for summary strips above a list (a light infographic).
export function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "accent" | "success" | "warning" | "danger" | "neutral";
}) {
  const toneText: Record<string, string> = {
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    neutral: "text-text-primary",
  };
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className={clsx("text-2xl font-semibold tabular-nums", toneText[tone])}>{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}

// Color-coded toggle switch: "admin" (neon purple) for administrative /
// permission controls, "ops" (amber) for active operational states.
export function ToggleSwitch({
  label,
  checked,
  onChange,
  tone = "admin",
  disabled,
}: {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone?: "admin" | "ops";
  disabled?: boolean;
}) {
  const onColor = tone === "admin" ? "bg-admin-action/25 border-admin-action" : "bg-warning/25 border-warning";
  const knobOn = tone === "admin" ? "bg-admin-action" : "bg-warning";
  const glowOn =
    tone === "admin" ? "shadow-[0_0_10px_rgba(167,139,250,0.5)]" : "shadow-[0_0_10px_rgba(251,162,60,0.5)]";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx("flex items-center gap-3 text-left text-sm text-text-secondary", disabled && "opacity-50")}
    >
      <span
        className={clsx(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
          checked ? clsx(onColor, glowOn) : "border-border bg-white/[0.06]"
        )}
      >
        <span
          className={clsx(
            "inline-block h-4 w-4 transform rounded-full transition-transform",
            checked ? clsx("translate-x-6", knobOn) : "translate-x-1 bg-text-muted"
          )}
        />
      </span>
      {label}
    </button>
  );
}
