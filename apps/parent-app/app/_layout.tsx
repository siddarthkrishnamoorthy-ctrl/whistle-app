import "./global.css";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider } from "@/lib/auth-context";
import { ChildrenProvider } from "@/lib/children-context";
import { colors } from "@/components/ui";
import { colors as tokens } from "@whistle/shared";

// Every detail screen gets the same two escape hatches: back to the
// previous screen (or home when opened directly via a link) and a home
// shortcut — nobody is ever stranded on an inner page.
const BackButton = () => (
  <TouchableOpacity
    onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
    style={{ paddingHorizontal: 6, paddingVertical: 4 }}
    accessibilityLabel="Go back"
  >
    <Ionicons name="chevron-back" size={24} color={colors.accent} />
  </TouchableOpacity>
);
const HomeButton = () => (
  <TouchableOpacity
    onPress={() => router.replace("/home")}
    style={{ paddingHorizontal: 10, paddingVertical: 4 }}
    accessibilityLabel="Go to home"
  >
    <Ionicons name="home-outline" size={20} color={colors.textSecondary} />
  </TouchableOpacity>
);

// react-navigation paints each screen with its theme background; make it
// transparent so the root gradient shows through everywhere.
const GRADIENT_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "transparent", card: tokens.surfaceSolid },
};

export default function RootLayout() {
  // Preload the icon font so tab icons can never render as blanks — if the
  // font is momentarily unavailable we still mount (labels remain readable).
  useFonts(Ionicons.font);

  return (
    <AuthProvider>
      <ChildrenProvider>
        <LinearGradient
          colors={[tokens.backgroundGradientFrom, tokens.backgroundGradientTo]}
          style={{ flex: 1 }}
        >
          <StatusBar style="light" />
          <ThemeProvider value={GRADIENT_THEME}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: tokens.surfaceSolid },
              headerTintColor: colors.textPrimary,
              headerTitleStyle: { fontWeight: "700" },
              headerLeft: () => <BackButton />,
              headerRight: () => <HomeButton />,
              // Transparent so the gradient shows through every screen.
              contentStyle: { backgroundColor: "transparent" },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />
            <Stack.Screen name="link-player" options={{ title: "Link your player" }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="events/[id]" options={{ title: "Match Center" }} />
            <Stack.Screen name="fixtures/[id]" options={{ title: "Fixture" }} />
            <Stack.Screen name="rating-detail/index" options={{ title: "My Rating" }} />
            <Stack.Screen name="chess/[gameId]" options={{ title: "Chess" }} />
            <Stack.Screen name="chess/puzzle" options={{ title: "Puzzle" }} />
          </Stack>
          </ThemeProvider>
        </LinearGradient>
      </ChildrenProvider>
    </AuthProvider>
  );
}
