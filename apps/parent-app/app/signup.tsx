import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { Field, PrimaryButton, colors } from "@/components/ui";

export default function SignupScreen() {
  const { signUp, apiUnreachable } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignup() {
    setError(null);
    setSubmitting(true);
    try {
      await signUp(fullName, email, password);
      router.replace("/link-player");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <Text style={{ color: colors.accent, fontSize: 26, fontWeight: "800" }}>Whistle</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>By School of Sports</Text>
        </View>

        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 4 }}>
          Create Your Account
        </Text>
        <Text style={{ color: colors.textSecondary, marginBottom: 24 }}>
          Join us and start your journey to greatness
        </Text>

        {apiUnreachable && (
          <Text style={{ color: colors.warning, fontSize: 12, marginBottom: 16 }}>
            Can&apos;t reach the API. Make sure the backend is running.
          </Text>
        )}

        <Field label="Full Name" placeholder="Enter Full Name" value={fullName} onChangeText={setFullName} />
        <Field label="Email" placeholder="Enter Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Field label="Password" placeholder="Enter Password" secureTextEntry value={password} onChangeText={setPassword} />

        {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

        <PrimaryButton title={submitting ? "Signing up…" : "SIGN UP"} onPress={handleSignup} disabled={submitting} />

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 20 }}>
          <Text style={{ color: colors.textSecondary }}>Already have an account? </Text>
          <Link href="/login" style={{ color: colors.accent }}>
            Login
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
