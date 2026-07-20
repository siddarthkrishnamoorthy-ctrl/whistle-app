import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { Card, OutlineButton, colors } from "@/components/ui";
import { initials } from "@whistle/shared";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>Profile</Text>

      <Card style={{ alignItems: "center", gap: 8, paddingVertical: 24 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 22 }}>
            {user ? initials(user.name) : "?"}
          </Text>
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "700" }}>{user?.name}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{user?.email}</Text>
      </Card>

      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4, textTransform: "uppercase" }}>
          Account Type
        </Text>
        <Text style={{ color: colors.textPrimary, fontSize: 14, textTransform: "capitalize" }}>
          Parent
        </Text>
      </Card>

      <TouchableOpacity
        onPress={() => router.push("/link-player")}
        style={{
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 6,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 16 }}>Link Another Child</Text>
      </TouchableOpacity>

      <OutlineButton title="Log out" onPress={() => signOut().then(() => router.replace("/login"))} />
    </ScrollView>
  );
}
