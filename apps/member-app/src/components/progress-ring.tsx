import { Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { colors } from "@whistle/shared";

// Circular skill/progress ring with a gradient arc — replaces linear bars in
// the parent app per the premium dark theme spec.
export function ProgressRing({
  fraction,
  size = 112,
  label,
  value,
  sublabel,
  from = colors.accent,
  to = "#F87171",
}: {
  fraction: number; // 0..1
  size?: number;
  label: string;
  value: string;
  sublabel?: string;
  from?: string;
  to?: string;
}) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gradId = `ring-${label.replace(/\W/g, "")}`;

  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={from} />
              <Stop offset="100%" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.09)"
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c * clamped} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={{ position: "absolute", alignItems: "center" }}>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800" }}>{value}</Text>
          {sublabel ? <Text style={{ color: colors.textMuted, fontSize: 10 }}>{sublabel}</Text> : null}
        </View>
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}
