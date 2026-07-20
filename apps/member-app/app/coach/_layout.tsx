import { Stack, router } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/components/ui";
import { colors as tokens } from "@whistle/shared";

// Coach role stack. Every detail screen gets back + home escape hatches; home
// always means the coach home tab.
const BackButton = () => (
  <TouchableOpacity
    onPress={() => (router.canGoBack() ? router.back() : router.replace("/coach/home"))}
    style={{ paddingHorizontal: 6, paddingVertical: 4 }}
    accessibilityLabel="Go back"
  >
    <Ionicons name="chevron-back" size={24} color={colors.accent} />
  </TouchableOpacity>
);
const HomeButton = () => (
  <TouchableOpacity
    onPress={() => router.replace("/coach/home")}
    style={{ paddingHorizontal: 10, paddingVertical: 4 }}
    accessibilityLabel="Go to home"
  >
    <Ionicons name="home-outline" size={20} color={colors.textSecondary} />
  </TouchableOpacity>
);

export default function CoachLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.surfaceSolid },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: "700" },
        headerLeft: () => <BackButton />,
        headerRight: () => <HomeButton />,
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="classes/[id]" options={{ title: "Class" }} />
      <Stack.Screen name="sessions/[id]" options={{ title: "Session" }} />
      <Stack.Screen name="assessments/new" options={{ title: "Record Assessment" }} />
      <Stack.Screen name="assessments/cycle/[id]" options={{ title: "Fitness Test Cycle" }} />
      <Stack.Screen name="lesson-plans/[id]" options={{ title: "Lesson Plan" }} />
      <Stack.Screen name="drills/index" options={{ title: "Drill Bank" }} />
      <Stack.Screen name="events/new" options={{ title: "Host Match" }} />
      <Stack.Screen name="events/[id]" options={{ title: "Match Center" }} />
      <Stack.Screen name="fixtures/[id]" options={{ title: "Fixture" }} />
      <Stack.Screen name="chess/[gameId]" options={{ title: "Chess" }} />
      <Stack.Screen name="scrabble/[gameId]" options={{ title: "Scrabble" }} />
    </Stack>
  );
}
