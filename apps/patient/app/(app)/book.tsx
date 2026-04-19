import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Field } from '../../src/components/Field';
import { Button } from '../../src/components/Button';
import { apiPost } from '../../src/lib/api';
import { colors, spacing } from '../../src/lib/theme';
import type { Appointment } from '@medical-ai/shared';

export default function Book() {
  const router = useRouter();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);

  const book = async () => {
    if (!date || !time) return Alert.alert('Missing info', 'Please set date and time.');
    const iso = new Date(`${date}T${time}:00`).toISOString();
    setLoading(true);
    try {
      const res = await apiPost<{ appointment: Appointment }>('/appointments', { scheduled_at: iso });
      router.replace(`/(app)/intake/${res.appointment.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  return (
    <Screen keyboardAware>
      <Text style={styles.title}>Book a visit</Text>
      <Text style={styles.subtitle}>Pick a date and time with your doctor</Text>

      <Field label="Date (YYYY-MM-DD)" placeholder="2026-05-01" value={date} onChangeText={setDate} />
      <Field label="Time (HH:MM)" placeholder="14:30" value={time} onChangeText={setTime} />

      <Button title="Book" onPress={book} loading={loading} />
      <View style={{ height: spacing.md }} />
      <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.muted, marginBottom: spacing.xl, marginTop: spacing.xs },
});
