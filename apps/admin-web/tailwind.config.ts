import type { Config } from "tailwindcss";

// Kept in sync with packages/shared/src/theme/tokens.ts (source of truth).
// Not imported directly: tailwind.config.ts runs under plain Node, not
// through Next's bundler, so it can't resolve the workspace TS package.
const colors = {
  background: "#0E1420",
  surface: "rgba(255, 255, 255, 0.05)",
  surfaceAlt: "rgba(255, 255, 255, 0.09)",
  border: "rgba(255, 255, 255, 0.13)",
  textPrimary: "#FFFFFF",
  textSecondary: "#B9C0CC",
  textMuted: "#7D8595",
  accent: "#F5B93F",
  accentText: "#141001",
  success: "#34D399",
  warning: "#FBA23C",
  danger: "#F87171",
  info: "#60A5FA",
  adminAction: "#A78BFA", // neon purple — administrative controls
};

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: colors.background,
        surface: colors.surface,
        "surface-alt": colors.surfaceAlt,
        border: colors.border,
        "text-primary": colors.textPrimary,
        "text-secondary": colors.textSecondary,
        "text-muted": colors.textMuted,
        accent: colors.accent,
        "accent-text": colors.accentText,
        success: colors.success,
        warning: colors.warning,
        danger: colors.danger,
        info: colors.info,
        "admin-action": colors.adminAction,
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
