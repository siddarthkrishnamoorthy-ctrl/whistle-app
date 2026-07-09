import { useCallback, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as LocalAuthentication from "expo-local-authentication";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, LoadingView, OutlineButton, Pill, PrimaryButton, colors } from "@/components/ui";
import { formatDate, formatTime, type ScheduledSession } from "@whistle/shared";

const STATUS_TONE = { not_started: "neutral", ongoing: "warning", completed: "success" } as const;

// Venue check-in: capture device coordinates for the geofence and run a
// device biometric (Face/fingerprint) confirmation where hardware exists —
// the practical equivalent of a "retina-level" identity check on phones.
async function collectCheckin(): Promise<{ lat?: number; lng?: number; biometricConfirmed: boolean }> {
  let lat: number | undefined;
  let lng: number | undefined;
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.granted) {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    }
  } catch {
    // Location unavailable — the backend decides whether the venue requires it.
  }

  let biometricConfirmed = false;
  try {
    if (Platform.OS !== "web" && (await LocalAuthentication.hasHardwareAsync())) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirm it's you to start the session",
      });
      biometricConfirmed = result.success;
    }
  } catch {
    // No biometric hardware / enrolment — recorded as unconfirmed.
  }
  return { lat, lng, biometricConfirmed };
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<ScheduledSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    apiJson<ScheduledSession>(`/schedule/${id}`)
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(load);

  async function transition(action: "start" | "complete") {
    if (!session) return;
    setBusy(true);
    try {
      const body = action === "start" ? await collectCheckin() : {};
      await apiJson(`/schedule/${session.id}/${action}`, { method: "POST", body: JSON.stringify(body) });
      load();
    } catch (e) {
      Alert.alert(
        action === "start" ? "Couldn't start session" : "Couldn't update session",
        e instanceof Error ? e.message : "Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingView />;
  if (!session) return <EmptyState message="Session not found." />;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>
          {session.class?.title ?? "Session"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <Pill tone={STATUS_TONE[session.status]}>{session.status.replace("_", " ")}</Pill>
          {session.class?.center ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{session.class.center.name}</Text>
          ) : null}
        </View>
      </View>

      <Card>
        <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{formatDate(session.sessionDate)}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
          {formatTime(session.startTime)} – {formatTime(session.endTime)}
        </Text>
        {session._count?.attendanceRecords != null ? (
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            {session._count.attendanceRecords} attendance record(s)
          </Text>
        ) : null}
        {(session as ScheduledSession & { checkinDistanceM?: number | null; checkinBiometric?: boolean | null })
          .checkinDistanceM != null ? (
          <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
            <Pill tone="success">
              {`venue verified · ${(session as ScheduledSession & { checkinDistanceM?: number }).checkinDistanceM}m`}
            </Pill>
            {(session as ScheduledSession & { checkinBiometric?: boolean | null }).checkinBiometric ? (
              <Pill tone="success">biometric ✓</Pill>
            ) : null}
          </View>
        ) : null}
      </Card>

      {session.status === "not_started" ? (
        <PrimaryButton title={busy ? "Starting…" : "Start session"} onPress={() => transition("start")} disabled={busy} />
      ) : null}
      {session.status === "ongoing" ? (
        <PrimaryButton
          title={busy ? "Completing…" : "Complete session"}
          onPress={() => transition("complete")}
          disabled={busy}
        />
      ) : null}
      <OutlineButton title="Record assessment" onPress={() => router.push("/assessments/new")} />
    </ScrollView>
  );
}
