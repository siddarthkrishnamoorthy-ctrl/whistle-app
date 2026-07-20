import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Image, TouchableOpacity } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { Field, PrimaryButton, colors } from "@/components/ui";

type Role = "coach" | "parent";

export default function LoginScreen() {
  const { signIn, apiUnreachable } = useAuth();
  const [role, setRole] = useState<Role>("coach");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // Route through the index, which reads the account's real role and sends
      // the user to the right experience — so a mis-picked toggle can't strand
      // anyone on the wrong stack.
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <Image source={require("../assets/whistle-logo.png")} style={{ width: 84, height: 76, marginBottom: 10 }} resizeMode="contain" />
          <Text style={{ color: colors.accent, fontSize: 26, fontWeight: "800" }}>Whistle</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>By School of Sports</Text>
        </View>

        {/* Role picker — differentiates coach vs parent at login */}
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>I&apos;m signing in as</Text>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.surfaceAlt,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 4,
            marginBottom: 24,
          }}
        >
          {(["coach", "parent"] as Role[]).map((r) => {
            const active = role === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setRole(r)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 9,
                  alignItems: "center",
                  backgroundColor: active ? colors.accent : "transparent",
                }}
              >
                <Text style={{ color: active ? colors.accentText : colors.textSecondary, fontWeight: "700", fontSize: 14 }}>
                  {r === "coach" ? "Coach" : "Parent"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {apiUnreachable && (
          <Text style={{ color: colors.warning, fontSize: 12, marginBottom: 16 }}>
            Can&apos;t reach the API. Make sure the backend is running.
          </Text>
        )}

        <Field label="Email" placeholder="Enter Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Field label="Password" placeholder="Enter Password" secureTextEntry value={password} onChangeText={setPassword} />

        {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

        <PrimaryButton title={submitting ? "Logging in…" : "LOGIN"} onPress={handleLogin} disabled={submitting} />

        {/* Sign-up path depends on the picked role: parents self-register,
            coaches are invited by their academy. */}
        {role === "parent" ? (
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 20 }}>
            <Text style={{ color: colors.textSecondary }}>New parent? </Text>
            <Link href="/signup" style={{ color: colors.accent }}>
              Create an account
            </Link>
          </View>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 20 }}>
            Coaches are added by their academy admin — ask them to send an invite, then log in here.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
