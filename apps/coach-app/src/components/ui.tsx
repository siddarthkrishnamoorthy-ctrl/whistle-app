import { useState, type ReactNode } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View, type TextInputProps, type ViewProps } from "react-native";
import { colors } from "@whistle/shared";

// Glass card treatment shared by Card/ListRow: translucent white fill over
// the gradient background, thin white border, soft drop shadow.
const glass = {
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.surface,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 14,
  elevation: 6,
} as const;

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          borderWidth: 1,
          borderColor: focused ? colors.accent : colors.border,
          backgroundColor: "rgba(0, 0, 0, 0.35)",
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: colors.textPrimary,
          fontSize: 15,
          ...(focused
            ? { shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 4 }
            : {}),
        }}
        {...props}
      />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={{
        backgroundColor: colors.accent,
        borderRadius: 999,
        paddingVertical: 14,
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: disabled ? 0 : 0.4,
        shadowRadius: 12,
        elevation: disabled ? 0 : 5,
      }}
    >
      <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 15 }}>{title}</Text>
    </TouchableOpacity>
  );
}

export function OutlineButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: 999,
        paddingVertical: 14,
        alignItems: "center",
      }}
    >
      <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15 }}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Card({ style, ...props }: ViewProps) {
  return <View style={[{ ...glass, borderRadius: 16, padding: 16 }, style]} {...props} />;
}

// Glowing status pills: translucent tone fill, bright tone text, soft glow.
const PILL_TONES = {
  success: { bg: "rgba(52, 211, 153, 0.14)", fg: colors.success },
  warning: { bg: "rgba(251, 162, 60, 0.16)", fg: colors.warning },
  danger: { bg: "rgba(248, 113, 113, 0.15)", fg: colors.danger },
  info: { bg: "rgba(96, 165, 250, 0.15)", fg: colors.info },
  neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary },
} as const;

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof PILL_TONES; children: string }) {
  const t = PILL_TONES[tone];
  const glow =
    tone === "neutral"
      ? {}
      : { shadowColor: t.fg, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 7, elevation: 3 };
  return (
    <View
      style={{
        backgroundColor: t.bg,
        borderWidth: 1,
        borderColor: tone === "neutral" ? colors.border : `${t.fg}55`,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        alignSelf: "flex-start",
        ...glow,
      }}
    >
      <Text style={{ color: t.fg, fontSize: 12, fontWeight: "600" }}>{children}</Text>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>{title}</Text>
        {subtitle && (
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </>
  );
  const rowStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    ...glass,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  };
  return onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={rowStyle}>
      {inner}
    </TouchableOpacity>
  ) : (
    <View style={rowStyle}>{inner}</View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{title}</Text>
      {action}
    </View>
  );
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  // Long option lists (e.g. every student in the academy) become a wall of
  // wrapped chips — render those as a single horizontally scrollable row.
  scroll?: boolean;
}) {
  const chips = (
    <View style={{ flexDirection: "row", flexWrap: scroll ? "nowrap" : "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.7}
            style={{
              borderWidth: 1,
              borderColor: active ? colors.accent : colors.border,
              backgroundColor: active ? colors.accent : colors.surface,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 7,
              ...(active
                ? { shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 3 }
                : {}),
            }}
          >
            <Text style={{ color: active ? colors.accentText : colors.textSecondary, fontSize: 13, fontWeight: "600" }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
  if (!scroll) return chips;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
      {chips}
    </ScrollView>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ paddingVertical: 24, alignItems: "center" }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>{message}</Text>
    </View>
  );
}

export function LoadingView() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
      <Text style={{ color: colors.textSecondary }}>Loading…</Text>
    </View>
  );
}

export function ErrorView({ message }: { message: string }) {
  return (
    <View style={{ paddingVertical: 24, alignItems: "center" }}>
      <Text style={{ color: colors.danger, fontSize: 13, textAlign: "center" }}>{message}</Text>
    </View>
  );
}

// Rounded search box for filtering long lists (leading 🔍, inline clear).
export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search…",
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: focused ? colors.accent : colors.border,
        backgroundColor: "rgba(0, 0, 0, 0.35)",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ fontSize: 14, color: colors.textMuted }}>🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ flex: 1, color: colors.textPrimary, fontSize: 14, padding: 0 }}
      />
      {value.length > 0 ? (
        <TouchableOpacity onPress={() => onChangeText("")} hitSlop={8}>
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Collapsible group header for grouping long lists; opens compact with a count.
export function Collapsible({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{ ...glass, borderRadius: 14, overflow: "hidden" }}>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12 }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 13, width: 14 }}>{open ? "▾" : "▸"}</Text>
        <Text style={{ flex: 1, color: colors.textPrimary, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
          {title}
        </Text>
        {typeof count === "number" ? (
          <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>{count}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 12, gap: 8 }}>{children}</View>
      ) : null}
    </View>
  );
}

export { colors };
