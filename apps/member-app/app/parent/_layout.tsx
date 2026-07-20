import { Stack, router } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ChildrenProvider } from "@/lib/children-context";
import { colors } from "@/components/ui";
import { colors as tokens } from "@whistle/shared";

// Parent role stack — wrapped in ChildrenProvider so the selected-child context
// is available to every parent screen (and never loaded for coach users). Back
// and home escape hatches point at the parent home tab.
const BackButton = () => (
  <TouchableOpacity
    onPress={() => (router.canGoBack() ? router.back() : router.replace("/parent/home"))}
    style={{ paddingHorizontal: 6, paddingVertical: 4 }}
    accessibilityLabel="Go back"
  >
    <Ionicons name="chevron-back" size={24} color={colors.accent} />
  </TouchableOpacity>
);
const HomeButton = () => (
  <TouchableOpacity
    onPress={() => router.replace("/parent/home")}
    style={{ paddingHorizontal: 10, paddingVertical: 4 }}
    accessibilityLabel="Go to home"
  >
    <Ionicons name="home-outline" size={20} color={colors.textSecondary} />
  </TouchableOpacity>
);

export default function ParentLayout() {
  return (
    <ChildrenProvider>
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
        <Stack.Screen name="events/[id]" options={{ title: "Match Center" }} />
        <Stack.Screen name="fixtures/[id]" options={{ title: "Fixture" }} />
        <Stack.Screen name="rating-detail/index" options={{ title: "My Rating" }} />
        <Stack.Screen name="chess/[gameId]" options={{ title: "Chess" }} />
        <Stack.Screen name="chess/puzzle" options={{ title: "Puzzle" }} />
        <Stack.Screen name="scrabble/[gameId]" options={{ title: "Scrabble" }} />
        <Stack.Screen name="scrabble/puzzle" options={{ title: "Word Puzzle" }} />
        <Stack.Screen name="scrabble/word-power" options={{ title: "Word Power" }} />
        <Stack.Screen name="scrabble/word-rush" options={{ title: "Word Rush" }} />
      </Stack>
    </ChildrenProvider>
  );
}
