import "./global.css";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider } from "@/lib/auth-context";
import { colors } from "@/components/ui";
import { colors as tokens } from "@whistle/shared";

// Unified Whistle app root. One login differentiates coach vs parent and hands
// off to the matching role stack (app/coach or app/parent), each of which owns
// its own header + tab chrome. Shared screens (login, signup, link-player) live
// here at the root so both roles reach them by the same path.

// link-player is parent-only; its back/home escape hatches point at parent home.
const LinkBack = () => (
  <TouchableOpacity
    onPress={() => (router.canGoBack() ? router.back() : router.replace("/parent/home"))}
    style={{ paddingHorizontal: 6, paddingVertical: 4 }}
    accessibilityLabel="Go back"
  >
    <Ionicons name="chevron-back" size={24} color={colors.accent} />
  </TouchableOpacity>
);
const LinkHome = () => (
  <TouchableOpacity
    onPress={() => router.replace("/parent/home")}
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
  useFonts(Ionicons.font);

  return (
    <AuthProvider>
      <LinearGradient colors={[tokens.backgroundGradientFrom, tokens.backgroundGradientTo]} style={{ flex: 1 }}>
        <StatusBar style="light" />
        <ThemeProvider value={GRADIENT_THEME}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: tokens.surfaceSolid },
              headerTintColor: colors.textPrimary,
              headerTitleStyle: { fontWeight: "700" },
              contentStyle: { backgroundColor: "transparent" },
              headerShown: false,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="coach" />
            <Stack.Screen name="parent" />
            <Stack.Screen
              name="link-player"
              options={{ headerShown: true, title: "Link your player", headerLeft: () => <LinkBack />, headerRight: () => <LinkHome /> }}
            />
          </Stack>
        </ThemeProvider>
      </LinearGradient>
    </AuthProvider>
  );
}
