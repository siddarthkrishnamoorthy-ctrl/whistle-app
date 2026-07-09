import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/components/ui";

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/home" : "/login");
  }, [loading, user]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.accent} />
      <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading Whistle Coach…</Text>
    </View>
  );
}
