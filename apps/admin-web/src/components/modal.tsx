"use client";

import { ReactNode } from "react";
import { PrimaryButton, OutlineButton } from "./ui";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      {/* Solid surface — the glassy translucent token let the page bleed through dialogs. */}
      <div
        className={`max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-lg"} overflow-y-auto rounded-lg border border-border bg-[#141A28] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.6)]`}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="space-y-4">{children}</div>

        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ModalFooter({
  onCancel,
  onSubmit,
  submitLabel,
  submitting,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
}) {
  return (
    <>
      <OutlineButton type="button" className="w-auto px-6" onClick={onCancel}>
        Cancel
      </OutlineButton>
      <PrimaryButton type="button" className="w-auto px-6" onClick={onSubmit} disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </PrimaryButton>
    </>
  );
}
