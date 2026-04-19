import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { apiGet, apiPost } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/lib/theme';
import type { Appointment } from '@medical-ai/shared';

type AppointmentWithPatient = Appointment & {
  patient?: { id: string; full_name: string; age: number | null; gender: string | null };
};

export default function Queue() {
  const router = useRouter();
  const [appts, setAppts] = useState<AppointmentWithPatient[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiGet<{ appointments: AppointmentWithPatient[] }>('/appointments');
      setAppts(res.appointments);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startVisit = async (appointmentId: string) => {
    try {
      const res = await apiPost<{ visit: { id: string } }>('/visits/start', { appointment_id: appointmentId });
      router.push(`/(app)/visit/${res.visit.id}`);
    } catch (e) {
      // swallow
    }
  };

  return (
    <Screen style={{ padding: 0 }}>
      <View style={{ padding: spacing.lg }}>
        <Text style={styles.title}>Today's queue</Text>
        <Text style={styles.subtitle}>Start a visit when the patient arrives</Text>
      </View>
      <FlatList
        data={appts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={!refreshing ? <Text style={styles.empty}>No appointments.</Text> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => startVisit(item.id)} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.name}>{item.patient?.full_name || 'Patient'}</Text>
              <StatusPill status={item.status} />
            </View>
            <Text style={styles.meta}>
              {new Date(item.scheduled_at).toLocaleString()}
            </Text>
            {item.status === 'intake_done' && (
              <Text style={styles.action}>Patient is ready — tap to start visit →</Text>
            )}
            {item.status === 'in_progress' && (
              <Text style={styles.action}>Resume visit →</Text>
            )}
          </Pressable>
        )}
      />
    </Screen>
  );
}

function StatusPill({ status }: { status: Appointment['status'] }) {
  const palette: Record<Appointment['status'], { bg: string; color: string }> = {
    scheduled: { bg: '#E5E7EB', color: '#4B5563' },
    intake_pending: { bg: '#FEF3C7', color: '#92400E' },
    intake_done: { bg: '#DCFCE7', color: '#166534' },
    in_progress: { bg: '#DBEAFE', color: '#1E40AF' },
    completed: { bg: '#F3F4F6', color: '#4B5563' },
    cancelled: { bg: '#FEE2E2', color: '#991B1B' },
  };
  const p = palette[status];
  return (
    <View style={{ backgroundColor: p.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
      <Text style={{ color: p.color, fontSize: 11, fontWeight: '700' }}>{status.replace('_', ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.muted, marginTop: 2 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  meta: { color: colors.muted, marginTop: 4 },
  action: { color: colors.primary, marginTop: spacing.sm, fontWeight: '600' },
});
