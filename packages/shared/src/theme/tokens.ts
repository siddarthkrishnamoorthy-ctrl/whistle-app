// Shared design tokens so admin-web (Tailwind) and the two Expo apps render as one product.
// Source: dark theme + single yellow/gold accent observed across all three wireframe decks.

export const colors = {
  // Deep slate → charcoal. `background` stays as the flat fallback; the two
  // gradient stops below are what root layouts feed into their gradients.
  background: "#0E1420",
  backgroundGradientFrom: "#151C2C", // dark slate (top)
  backgroundGradientTo: "#0B0D12", // charcoal (bottom)

  // Glass layers: translucent white over the gradient with thin white borders.
  surface: "rgba(255, 255, 255, 0.05)",
  surfaceAlt: "rgba(255, 255, 255, 0.09)",
  surfaceSolid: "#141A28", // headers/menus that must stay opaque
  border: "rgba(255, 255, 255, 0.13)",

  textPrimary: "#FFFFFF",
  textSecondary: "#B9C0CC", // light grey — scannable secondary copy
  textMuted: "#7D8595",

  accent: "#F5B93F", // amber/gold CTA + active states
  accentText: "#141001", // text on top of accent (near-black)

  success: "#34D399", // bright emerald — completed / paid / present
  warning: "#FBA23C", // amber/orange — upcoming / due / live
  danger: "#F87171", // absent / overdue / hot lead
  info: "#60A5FA", // upcoming / neutral informational / cold lead

  hot: "#F87171",
  warm: "#FBA23C",
  cold: "#60A5FA",
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export type ColorToken = keyof typeof colors;
