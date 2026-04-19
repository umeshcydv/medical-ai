import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { apiGet } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/lib/theme';

interface PatientRow {
  id: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  marital_status: string | null;
}

export default function Patients() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiGet<{ patients: PatientRow[] }>('/patients');
      setPatients(res.patients);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen style={{ padding: 0 }}>
      <View style={{ padding: spacing.lg }}>
        <Text style={styles.title}>Patients</Text>
        <Text style={styles.subtitle}>All patients linked to you</Text>
      </View>
      <FlatList
        data={patients}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={!refreshing ? <Text style={styles.empty}>No patients yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(app)/patient/${item.id}`)} style={styles.card}>
            <Text style={styles.name}>{item.full_name}</Text>
            <Text style={styles.meta}>
              {[item.age && `${item.age}y`, item.gender, item.marital_status].filter(Boolean).join(' · ') || '—'}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
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
});
