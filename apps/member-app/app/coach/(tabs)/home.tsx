import { useCallback, useState } from "react";
import { Image, ScrollView, Text, View, TouchableOpacity } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { Ionicons } from "@expo/vector-icons";
import { Card, ListRow, Pill, SectionHeader, colors } from "@/components/ui";
import { TenantBrand } from "@/components/tenant-brand";
import { initials, formatTime, type ScheduledSession } from "@whistle/shared";

const STATUS_TONE = { not_started: "neutral", ongoing: "warning", completed: "success" } as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [stats, setStats] = useState<{ students: number; classes: number; liveMatches: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.academyId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      Promise.all([
        apiJson<ScheduledSession[]>(`/schedule?date=${todayIso()}`).catch(() => [] as ScheduledSession[]),
        apiJson<{ coach?: { userId: string }; _count?: { enrollments: number } }[]>("/classes").catch(() => []),
        apiJson<{ status: string }[]>("/fixtures").catch(() => [] as { status: string }[]),
      ])
        .then(([all, classes, fixtures]) => {
          if (cancelled) return;
          setSessions(all.filter((s) => s.class?.coach?.userId === user.id));
          const mine = classes.filter((c) => c.coach?.userId === user.id);
          setStats({
            students: mine.reduce((sum, c) => sum + (c._count?.enrollments ?? 0), 0),
            classes: mine.length,
            liveMatches: fixtures.filter((f) => f.status === "live" || f.status === "scheduled").length,
          });
        })
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [user])
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      {/* Brand bar — logo + app name anchored top-left, like modern sports apps */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Image
            source={require("../../../assets/whistle-logo.png")}
            style={{ width: 36, height: 32 }}
            resizeMode="contain"
          />
          <View>
            <Text style={{ color: colors.accent, fontSize: 19, fontWeight: "800", letterSpacing: 0.3 }}>Whistle</Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: -2 }}>By School of Sports</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {/* The tenant's school/academy identity sits on the RIGHT. */}
          <TenantBrand />
          <TouchableOpacity
            onPress={() => signOut().then(() => router.replace("/login"))}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Greeting */}
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
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Good to see you 👋</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "700" }}>{user?.name ?? "Coach"}</Text>
        </View>
      </View>

      {!user?.academyId && (
        <Card>
          <Text style={{ color: colors.textPrimary, fontWeight: "600", marginBottom: 4 }}>
            Waiting to be added to an academy
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Ask your academy admin to add you as a coach from the Whistle Admin web app (Staff → Add Staff). Once
            they do, your classes, students and assessments will show up here.
          </Text>
        </Card>
      )}

      {stats ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard value={String(sessions.length)} label="Sessions today" />
          <StatCard value={String(stats.students)} label="My students" />
          <StatCard value={String(stats.liveMatches)} label="Open matches" />
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <QuickLink label="Host Match" icon="trophy-outline" onPress={() => router.push("/coach/events/new")} />
        <QuickLink label="Lesson Plans" icon="book-outline" onPress={() => router.push("/coach/lessons")} />
        <QuickLink label="Drill Bank" icon="fitness-outline" onPress={() => router.push("/coach/drills")} />
        <QuickLink label="Standings" icon="podium-outline" onPress={() => router.push("/coach/ratings")} />
      </View>

      <View>
        <SectionHeader title="Today's sessions" />
        {loading ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Loading…</Text>
        ) : sessions.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No sessions scheduled for you today.</Text>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {sessions.map((s) => (
              <ListRow
                key={s.id}
                title={s.class?.title ?? "Session"}
                subtitle={`${formatTime(s.startTime)} · ${s.class?.center.name ?? ""}`}
                right={<Pill tone={STATUS_TONE[s.status]}>{s.status.replace("_", " ")}</Pill>}
                onPress={() => router.push(`/coach/sessions/${s.id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <Card style={{ flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 8 }}>
      <Text style={{ color: colors.accent, fontSize: 24, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2, textAlign: "center" }}>{label}</Text>
    </Card>
  );
}

function QuickLink({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        width: "47%",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        padding: 14,
        backgroundColor: colors.surface,
        alignItems: "center",
        gap: 8,
      }}
    >
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}
