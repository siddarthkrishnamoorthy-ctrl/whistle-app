import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Image } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { Field, PrimaryButton, colors } from "@/components/ui";

export default function LoginScreen() {
  const { signIn, apiUnreachable } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
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
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <Image
            source={require("../assets/whistle-logo.png")}
            style={{ width: 84, height: 76, marginBottom: 10 }}
            resizeMode="contain"
          />
          <Text style={{ color: colors.accent, fontSize: 26, fontWeight: "800" }}>Whistle</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>By School of Sports</Text>
        </View>

        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 4 }}>
          Welcome Back
        </Text>
        <Text style={{ color: colors.textSecondary, marginBottom: 24 }}>Login to continue your journey</Text>

        {apiUnreachable && (
          <Text style={{ color: colors.warning, fontSize: 12, marginBottom: 16 }}>
            Can&apos;t reach the API. Make sure the backend is running.
          </Text>
        )}

        <Field label="Email" placeholder="Enter Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Field label="Password" placeholder="Enter Password" secureTextEntry value={password} onChangeText={setPassword} />

        {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

        <PrimaryButton title={submitting ? "Logging in…" : "LOGIN"} onPress={handleLogin} disabled={submitting} />

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 20 }}>
          <Text style={{ color: colors.textSecondary }}>Don&apos;t have an account? </Text>
          <Link href="/signup" style={{ color: colors.accent }}>
            Sign up
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
