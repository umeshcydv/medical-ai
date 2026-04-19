import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';
import { isSupabaseConfigured } from '../lib/supabase';

export function SetupBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Setup required</Text>
      <Text style={styles.body}>
        Add your Supabase URL + anon key, and backend API URL, to{' '}
        <Text style={styles.code}>apps/patient/app.json</Text> under <Text style={styles.code}>expo.extra</Text>,
        then restart the app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { fontWeight: '700', color: '#92400E', marginBottom: 4 },
  body: { color: '#92400E', fontSize: 13, lineHeight: 18 },
  code: { fontFamily: 'Courier', fontSize: 12, color: '#78350F' },
});
