import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Image, Pressable } from "react-native";
import { router } from "expo-router";
import { Field, PrimaryButton, ChipRow, colors } from "@/components/ui";
import { tournamentLogin, tournamentSignup } from "@/lib/tournament-api";

const ROLES = [
  { key: "organizer", label: "Organizer" },
  { key: "official", label: "Official" },
  { key: "registrant", label: "Player / Team" },
] as const;

// Open-access login for the standalone Tournament module — anyone can sign
// up here with no academy, school, or club affiliation.
export default function TournamentLoginScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("registrant");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await tournamentLogin(email.trim(), password);
      } else {
        await tournamentSignup({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          organizationName: role === "organizer" && orgName.trim() ? orgName.trim() : undefined,
        });
      }
      router.replace("/tournament/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <Image
            source={require("../../assets/whistle-logo.png")}
            style={{ width: 72, height: 65, marginBottom: 8 }}
            resizeMode="contain"
          />
          <Text style={{ color: colors.accent, fontSize: 24, fontWeight: "800" }}>Whistle Tournaments</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
            Open to everyone — no academy needed
          </Text>
        </View>

        <View style={{ flexDirection: "row", marginBottom: 20 }}>
          {(["login", "signup"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderBottomWidth: 2,
                borderBottomColor: mode === m ? colors.accent : "rgba(255,255,255,0.1)",
                alignItems: "center",
              }}
            >
              <Text style={{ color: mode === m ? colors.accent : colors.textSecondary, fontWeight: "700" }}>
                {m === "login" ? "Login" : "Create Account"}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === "signup" && (
          <>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>I am a…</Text>
            <ChipRow
              options={ROLES.map((r) => ({ key: r.key as string, label: r.label }))}
              value={role}
              onChange={setRole}
            />
            <View style={{ height: 12 }} />
            <Field label="Full Name" placeholder="Your name" value={name} onChangeText={setName} />
            {role === "organizer" && (
              <Field
                label="Organization (optional)"
                placeholder="Club / league / company name"
                value={orgName}
                onChangeText={setOrgName}
              />
            )}
          </>
        )}

        <Field
          label="Email"
          placeholder="Enter Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Field label="Password" placeholder="Enter Password" secureTextEntry value={password} onChangeText={setPassword} />

        {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

        <PrimaryButton
          title={submitting ? "Please wait…" : mode === "login" ? "LOGIN" : "CREATE ACCOUNT"}
          onPress={submit}
          disabled={submitting}
        />

        <Pressable onPress={() => router.replace("/login")} style={{ marginTop: 22, alignItems: "center" }}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>← Back to Whistle Academy login</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
