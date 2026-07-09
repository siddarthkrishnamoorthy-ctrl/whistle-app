import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api-client";
import { EmptyState, ListRow, Pill, colors } from "@/components/ui";
import { formatDate, formatTime, type ScheduledSession } from "@whistle/shared";

const STATUS_TONE = { not_started: "neutral", ongoing: "warning", completed: "success" } as const;

export default function ScheduleScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.academyId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      apiJson<ScheduledSession[]>("/schedule")
        .then((all) => {
          if (cancelled) return;
          setSessions(all.filter((s) => s.class?.coach?.userId === user.id));
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [user])
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>Schedule</Text>

      {loading ? (
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      ) : sessions.length === 0 ? (
        <EmptyState message="No sessions scheduled for your classes yet." />
      ) : (
        <View style={{ gap: 8 }}>
          {sessions.map((s) => (
            <ListRow
              key={s.id}
              title={s.class?.title ?? "Session"}
              subtitle={`${formatDate(s.sessionDate)} · ${formatTime(s.startTime)} – ${formatTime(s.endTime)}`}
              right={<Pill tone={STATUS_TONE[s.status]}>{s.status.replace("_", " ")}</Pill>}
              onPress={() => router.push(`/sessions/${s.id}`)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
