import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useChildren } from "@/lib/children-context";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, PrimaryButton, colors } from "@/components/ui";
import { formatDate, formatTime, initials, type Assessment, type Rating, type ScheduledSession } from "@whistle/shared";

interface Snapshot {
  nextSession: ScheduledSession | null;
  rating: number | null;
  notes: number;
}

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const { children, selectedChild, selectChild, loading, refresh } = useChildren();
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useFocusEffect(
    useCallback(() => {
      if (!selectedChild) {
        setSnap(null);
        return;
      }
      let cancelled = false;
      const classIds = new Set((selectedChild.enrollments ?? []).map((e) => e.class?.id).filter(Boolean));
      const sportKey =
        selectedChild.enrollments?.find((e) => e.status === "active")?.class?.sportKey ??
        selectedChild.enrollments?.[0]?.class?.sportKey;
      Promise.all([
        apiJson<ScheduledSession[]>("/schedule").catch(() => [] as ScheduledSession[]),
        apiJson<Assessment[]>(`/assessments?clientId=${selectedChild.id}`).catch(() => [] as Assessment[]),
        sportKey
          ? apiJson<Rating>(`/ratings/${selectedChild.id}/${sportKey}/individual`).catch(() => null)
          : Promise.resolve(null),
      ]).then(([sessions, assessments, rating]) => {
        if (cancelled) return;
        const upcoming = sessions
          .filter((s) => classIds.has(s.classId) && s.status !== "completed")
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
        setSnap({
          nextSession: upcoming[0] ?? null,
          rating: rating ? Number(rating.currentRating) : null,
          notes: assessments.filter((a) => a.coachNote).length,
        });
      });
      return () => {
        cancelled = true;
      };
    }, [selectedChild])
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.accentText, fontWeight: "700" }}>{user ? initials(user.name) : "?"}</Text>
          </View>
          <View>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Welcome back 👋</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "700" }}>{user?.name ?? "Parent"}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image
            source={require("../../assets/whistle-logo.png")}
            style={{ width: 34, height: 31 }}
            resizeMode="contain"
          />
          <TouchableOpacity onPress={() => signOut().then(() => router.replace("/login"))}>
            <Text style={{ color: colors.danger, fontSize: 13 }}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>My children</Text>
        {loading ? (
          <Text style={{ color: colors.textSecondary }}>Loading…</Text>
        ) : children.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
              No player linked yet. Ask your academy for your child's link code, then connect it here.
            </Text>
            <PrimaryButton title="Link my child" onPress={() => router.push("/link-player")} />
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {children.map((child) => {
              const active = selectedChild?.id === child.id;
              const activeClass = child.enrollments?.find((e) => e.status === "active") ?? child.enrollments?.[0];
              return (
                <TouchableOpacity
                  key={child.id}
                  onPress={() => selectChild(child.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderWidth: 1,
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: active ? colors.accent : colors.surfaceAlt,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: active ? colors.accentText : colors.textPrimary, fontWeight: "700" }}>
                      {initials(child.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 15 }}>{child.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      {[child.academy?.name, child.center?.name, activeClass?.class?.title].filter(Boolean).join(" · ") ||
                        "Not enrolled yet"}
                    </Text>
                  </View>
                  {active ? <Text style={{ color: colors.accent, fontSize: 16 }}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {selectedChild && snap ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Card style={{ flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 8 }}>
              <Text style={{ color: colors.accent, fontSize: 22, fontWeight: "800" }}>
                {snap.rating != null ? snap.rating.toFixed(2) : "—"}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>Whistle rating</Text>
            </Card>
            <Card style={{ flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 8 }}>
              <Text style={{ color: colors.accent, fontSize: 22, fontWeight: "800" }}>{snap.notes}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>Coach notes</Text>
            </Card>
          </View>
          <TouchableOpacity
            onPress={() => (snap.nextSession ? router.push("/child") : router.push("/progress"))}
            activeOpacity={0.75}
          >
            <Card>
              <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase" }}>Next session</Text>
              {snap.nextSession ? (
                <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15, marginTop: 4 }}>
                  {formatDate(snap.nextSession.sessionDate)} · {formatTime(snap.nextSession.startTime)} —{" "}
                  {snap.nextSession.class?.title ?? "Class"}
                </Text>
              ) : (
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                  Nothing scheduled in the next two weeks.
                </Text>
              )}
            </Card>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}
