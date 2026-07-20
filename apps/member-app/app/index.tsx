import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/components/ui";

// Landing: send signed-in users straight to their role experience; everyone
// else to the shared login. The account's own role is authoritative.
export function roleHome(role?: string) {
  return role === "parent" ? "/parent/home" : "/coach/home";
}

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? roleHome(user.role) : "/login");
  }, [loading, user]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.accent} />
      <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading Whistle…</Text>
    </View>
  );
}
