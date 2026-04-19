import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { useSession } from '../../src/state/session';
import { colors, radius, spacing } from '../../src/lib/theme';

export default function Profile() {
  const { user, signOut } = useSession();
  if (!user) return null;
  return (
    <Screen>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Row label="Name" value={user.full_name} />
        <Row label="Phone" value={user.phone || '—'} />
        <Row label="Age" value={String(user.age || '—')} />
        <Row label="Gender" value={user.gender || '—'} />
        <Row label="Marital status" value={user.marital_status || '—'} />
      </View>
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { color: colors.muted },
  value: { color: colors.text, fontWeight: '500' },
});
