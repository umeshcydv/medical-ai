import React from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { useSession } from '../../src/state/session';
import { colors, radius, spacing } from '../../src/lib/theme';

export default function Profile() {
  const { user, signOut } = useSession();
  if (!user) return null;

  const copyId = async () => {
    await Clipboard.setStringAsync(user.id);
    Alert.alert('Copied', 'Your doctor code has been copied. Share it with patients so they can link their accounts.');
  };

  return (
    <Screen>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Row label="Name" value={user.full_name} />
        <Row label="Specialty" value={user.specialty || '—'} />
        <Row label="Email" value={user.email || '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your doctor code</Text>
        <Text style={styles.code} selectable>{user.id}</Text>
        <Text style={styles.hint}>Share this with patients when they sign up.</Text>
        <Button title="Copy code" variant="secondary" onPress={copyId} style={{ marginTop: spacing.md }} />
      </View>

      <Button title="Sign out" variant="danger" onPress={signOut} />
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
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  code: { fontFamily: 'Courier', fontSize: 13, color: colors.primary, marginBottom: spacing.xs },
  hint: { color: colors.muted, fontSize: 13 },
});
