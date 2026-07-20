import { useEffect, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import { API_URL, apiJson } from "@/lib/api-client";
import { colors } from "@/components/ui";

// The tenant's own identity — school/academy name in their chosen font plus
// their logo — pinned to the RIGHT side of the home header (2026-07).
// Whistle's brand stays top-left; the tenant's brand answers "whose academy
// am I in?" for coaches and parents.

interface Branding {
  id: string;
  name: string;
  brandTheme: { displayName?: string; fontKey?: string; logoUrl?: string } | null;
}

// fontKey → native family. Android ships generic families; iOS ships the
// named ones. Unknown keys fall back to the default font.
const FONTS: Record<string, string | undefined> = Platform.select({
  ios: { serif: "Georgia", rounded: "Trebuchet MS", mono: "Courier New", script: "Snell Roundhand" },
  default: { serif: "serif", rounded: "sans-serif-medium", mono: "monospace", script: "serif" },
}) as Record<string, string | undefined>;

const ASSET_BASE = API_URL.replace(/\/api\/v1\/?$/, "");

export function TenantBrand() {
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    apiJson<Branding>("/settings/branding").then(setBranding).catch(() => {});
  }, []);

  if (!branding) return null;
  const theme = branding.brandTheme ?? {};
  const name = theme.displayName || branding.name;
  const logo = theme.logoUrl ? (theme.logoUrl.startsWith("http") ? theme.logoUrl : `${ASSET_BASE}${theme.logoUrl}`) : null;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 190 }}>
      <Text
        numberOfLines={1}
        style={{
          color: colors.textPrimary,
          fontSize: 13,
          fontWeight: "800",
          flexShrink: 1,
          ...(theme.fontKey && FONTS[theme.fontKey] ? { fontFamily: FONTS[theme.fontKey] } : {}),
        }}
      >
        {name}
      </Text>
      {logo && <Image source={{ uri: logo }} style={{ width: 30, height: 30, borderRadius: 8 }} resizeMode="contain" />}
    </View>
  );
}
