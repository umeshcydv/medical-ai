import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { apiGet } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/lib/theme';
import { useSession } from '../../src/state/session';
import type { Appointment } from '@medical-ai/shared';

export default function Home() {
  const router = useRouter();
  const { user } = useSession();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiGet<{ appointments: Appointment[] }>('/appointments');
      setAppts(res.appointments);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen style={{ padding: 0 }}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi, {user?.full_name?.split(' ')[0]}</Text>
        <Text style={styles.subtitle}>Book or continue your visit prep</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <Button title="Book appointment" onPress={() => router.push('/(app)/book')} />
      </View>

      <FlatList
        data={appts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListHeaderComponent={<Text style={styles.section}>Your appointments</Text>}
        ListEmptyComponent={!refreshing ? <Text style={styles.empty}>No appointments yet.</Text> : null}
        renderItem={({ item }) => <AppointmentRow item={item} onPress={() => {
          if (item.status === 'scheduled' || item.status === 'intake_pending') {
            router.push(`/(app)/intake/${item.id}`);
          }
        }} />}
      />
    </Screen>
  );
}

function AppointmentRow({ item, onPress }: { item: Appointment; onPress: () => void }) {
  const when = new Date(item.scheduled_at);
  const label = statusLabel(item.status);
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Text style={styles.cardTitle}>{when.toLocaleDateString()} · {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      <Text style={styles.cardSub}>{label}</Text>
      {(item.status === 'scheduled' || item.status === 'intake_pending') && (
        <Text style={styles.cardAction}>Tap to start intake →</Text>
      )}
    </Pressable>
  );
}

function statusLabel(s: Appointment['status']): string {
  switch (s) {
    case 'scheduled': return 'Upcoming — intake not started';
    case 'intake_pending': return 'Intake in progress';
    case 'intake_done': return 'Intake complete — see you at visit';
    case 'in_progress': return 'Visit in progress';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
  }
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  greeting: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.muted, marginTop: 2 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md, marginTop: spacing.lg },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardSub: { color: colors.muted, marginTop: 4 },
  cardAction: { color: colors.primary, marginTop: spacing.sm, fontWeight: '600' },
});
