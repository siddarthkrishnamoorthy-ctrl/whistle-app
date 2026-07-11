"use client";

// Tenant identity badge (2026-07): every tenant surface shows the school /
// academy's own name — in the font the operator picked for them — plus their
// logo, on the RIGHT side of the window (Whistle's own brand stays top-left).

import { useEffect, useState } from "react";
import { apiJson, ASSET_BASE_URL } from "@/lib/api-client";

export interface BrandTheme {
  displayName?: string;
  fontKey?: string;
  logoUrl?: string;
}

export interface Branding {
  id: string;
  name: string;
  brandTheme: BrandTheme | null;
}

// Web-safe stacks keyed by the same fontKey the mobile apps map natively.
export const FONT_STACKS: Record<string, string> = {
  default: "inherit",
  serif: "Georgia, 'Times New Roman', serif",
  rounded: "'Trebuchet MS', Verdana, sans-serif",
  mono: "'Courier New', monospace",
  script: "'Segoe Script', 'Comic Sans MS', cursive",
};

export const FONT_OPTIONS: { key: string; label: string }[] = [
  { key: "default", label: "Whistle default" },
  { key: "serif", label: "Classic serif" },
  { key: "rounded", label: "Rounded" },
  { key: "mono", label: "Typewriter" },
  { key: "script", label: "Script" },
];

export function brandFont(fontKey?: string): string {
  return FONT_STACKS[fontKey ?? "default"] ?? "inherit";
}

export function brandLogoSrc(logoUrl?: string): string | null {
  if (!logoUrl) return null;
  return logoUrl.startsWith("http") ? logoUrl : `${ASSET_BASE_URL}${logoUrl}`;
}

export function TenantBrand({ className = "" }: { className?: string }) {
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    apiJson<Branding>("/settings/branding").then(setBranding).catch(() => {});
  }, []);

  if (!branding) return null;
  const theme = branding.brandTheme ?? {};
  const logo = brandLogoSrc(theme.logoUrl);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span
        className="max-w-[260px] truncate text-sm font-bold text-text-primary"
        style={{ fontFamily: brandFont(theme.fontKey) }}
        title={theme.displayName || branding.name}
      >
        {theme.displayName || branding.name}
      </span>
      {logo && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
      )}
    </div>
  );
}
