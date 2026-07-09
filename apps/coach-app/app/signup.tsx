import { View, Text, ScrollView } from "react-native";
import { Link } from "expo-router";
import { colors, OutlineButton } from "@/components/ui";
import { router } from "expo-router";

// Coaches don't self-register: per the BRD, an admin adds a coach from
// Admin Web (Staff → Add Staff), which sends an invite. The invite-accept
// endpoint is a later backend phase (Staff module) — until then this screen
// just explains the flow instead of pretending to create an account (the
// shared /auth/signup endpoint always provisions a brand-new academy owner,
// which would be the wrong role entirely for a coach).
export default function SignupScreen() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
      <View style={{ alignItems: "center", marginBottom: 32 }}>
        <Text style={{ color: colors.accent, fontSize: 26, fontWeight: "800" }}>Whistle</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>By School of Sports</Text>
      </View>

      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 12 }}>
        Ask your academy to invite you
      </Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 24 }}>
        Coach accounts are created by your academy&apos;s admin from Whistle Admin (Staff → Add Staff). Ask them to
        send you an invite, then come back here to log in.
      </Text>

      <OutlineButton title="Back to login" onPress={() => router.replace("/login")} />

      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 20 }}>
        <Text style={{ color: colors.textSecondary }}>Already have an account? </Text>
        <Link href="/login" style={{ color: colors.accent }}>
          Login
        </Link>
      </View>
    </ScrollView>
  );
}
