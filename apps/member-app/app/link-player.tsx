import { View, Text, ScrollView } from "react-native";
import { router } from "expo-router";
import { OutlineButton, colors } from "@/components/ui";

// Linking a parent to an existing student record needs the backend's Clients
// module (student records + a link code an admin hands out) — that's a later
// Admin Web ops phase, not built yet. This screen is honest about that rather
// than wiring up a call to an endpoint that doesn't exist.
export default function LinkPlayerScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: "center" }}>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 4 }}>
        Link your player
      </Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 24 }}>
        Player linking isn&apos;t available yet — it needs your academy to enroll your child and share a code with
        you first. Check back once that&apos;s set up.
      </Text>

      <OutlineButton title="Continue for now" onPress={() => router.replace("/home")} />
    </ScrollView>
  );
}
