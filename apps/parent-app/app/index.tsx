import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/components/ui";

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!user.academyId) {
      router.replace("/link-player");
    } else {
      router.replace("/home");
    }
  }, [loading, user]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.accent} />
      <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading Whistle…</Text>
    </View>
  );
}
