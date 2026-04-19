import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '../../../src/lib/api';
import { colors, radius, spacing } from '../../../src/lib/theme';
import type { User, VisitSession, Appointment } from '@medical-ai/shared';

interface ThreadResponse {
  patient: User;
  visits: VisitSession[];
  appointments: Appointment[];
}

export default function PatientThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ThreadResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiGet<ThreadResponse>(`/patients/${id}`);
      setData(res);
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}><Text style={{ color: colors.primary }}>← Back</Text></Pressable>
          <Text style={styles.title}>Loading…</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
    );
  }

  const { patient, visits, appointments } = data;
  const nextAppt = appointments.find((a) => a.status === 'scheduled' || a.status === 'intake_done' || a.status === 'intake_pending' || a.status === 'in_progress');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>← Patients</Text>
        </Pressable>
        <Text style={styles.title}>{patient.full_name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListHeaderComponent={
          <View>
            <View style={styles.profileCard}>
              <Text style={styles.meta}>
                {[patient.age && `${patient.age}y`, patient.gender, patient.marital_status].filter(Boolean).join(' · ')}
              </Text>
            </View>

            {nextAppt && (
              <Pressable
                style={styles.nextCard}
                onPress={async () => {
                  const res = await apiPost<{ visit: { id: string } }>('/visits/start', { appointment_id: nextAppt.id });
                  router.push(`/(app)/visit/${res.visit.id}`);
                }}
              >
                <Text style={styles.nextTitle}>Next: {new Date(nextAppt.scheduled_at).toLocaleString()}</Text>
                <Text style={styles.nextHint}>Tap to start/resume visit →</Text>
              </Pressable>
            )}

            <Text style={styles.section}>Past visits</Text>
          </View>
        }
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={<Text style={styles.empty}>No past visits.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(app)/visit/${item.id}`)} style={styles.visitCard}>
            <Text style={styles.visitDate}>{new Date(item.created_at).toLocaleString()}</Text>
            <Text style={styles.visitStatus}>Status: {item.status}</Text>
            {item.summary_final && (
              <Text style={styles.visitSummary} numberOfLines={3}>{item.summary_final}</Text>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  profileCard: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  meta: { color: colors.muted },
  nextCard: {
    backgroundColor: '#ECFDF5',
    borderColor: colors.primary,
    borderWidth: 1,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  nextTitle: { color: colors.text, fontWeight: '600' },
  nextHint: { color: colors.primary, marginTop: 4, fontWeight: '600' },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md, marginTop: spacing.md },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  visitCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  visitDate: { color: colors.text, fontWeight: '600' },
  visitStatus: { color: colors.muted, marginTop: 4, fontSize: 13 },
  visitSummary: { color: colors.text, marginTop: spacing.sm, fontSize: 14, lineHeight: 20 },
});
