import { Slot, usePathname, router } from "expo-router";
import { Platform, View, Text, TouchableOpacity, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/components/ui";

const TAB_BAR_HEIGHT = 78;

// On phone browsers the URL bar overlaps a flex-positioned footer — pin the
// tab bar to the visual viewport instead so it's always on screen.
const webFixedBar: ViewStyle =
  Platform.OS === "web" ? ({ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100 } as unknown as ViewStyle) : {};

type IconName = keyof typeof Ionicons.glyphMap;

// Sleek line icons (filled variant when active) in the style of modern
// dark-theme sports apps — replaces the old emoji tabs.
const TABS: { key: string; label: string; path: string; icon: IconName; iconActive: IconName }[] = [
  { key: "home", label: "Home", path: "/coach/home", icon: "home-outline", iconActive: "home" },
  { key: "classes", label: "Classes", path: "/coach/classes", icon: "school-outline", iconActive: "school" },
  { key: "schedule", label: "Schedule", path: "/coach/schedule", icon: "calendar-outline", iconActive: "calendar" },
  { key: "assessments", label: "Assess", path: "/coach/assessments", icon: "clipboard-outline", iconActive: "clipboard" },
  { key: "lessons", label: "Lessons", path: "/coach/lessons", icon: "book-outline", iconActive: "book" },
  { key: "events", label: "Matches", path: "/coach/events", icon: "trophy-outline", iconActive: "trophy" },
  { key: "ratings", label: "Standings", path: "/coach/ratings", icon: "podium-outline", iconActive: "podium" },
  { key: "profile", label: "Profile", path: "/coach/profile", icon: "person-outline", iconActive: "person" },
];

export default function TabsLayout() {
  const pathname = usePathname();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingBottom: Platform.OS === "web" ? TAB_BAR_HEIGHT : 0 }}>
        <Slot />
      </View>
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: "rgba(11, 13, 18, 0.96)",
          paddingBottom: 20,
          paddingTop: 6,
          ...webFixedBar,
        }}
      >
        {TABS.map((tab) => {
          const active = pathname === tab.path || pathname.startsWith(`${tab.path}/`);
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => router.replace(tab.path as never)}
              activeOpacity={0.6}
              style={{ flex: 1, alignItems: "center", gap: 3 }}
            >
              <View
                style={{
                  width: 22,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: active ? colors.accent : "transparent",
                  ...(active
                    ? { shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 6, elevation: 4 }
                    : {}),
                }}
              />
              <Ionicons
                name={active ? tab.iconActive : tab.icon}
                size={21}
                color={active ? colors.accent : colors.textSecondary}
              />
              <Text
                style={{
                  fontSize: 10,
                  color: active ? colors.accent : colors.textSecondary,
                  fontWeight: active ? "700" : "400",
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
