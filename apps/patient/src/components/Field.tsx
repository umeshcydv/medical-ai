import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';

interface Props extends TextInputProps {
  label: string;
}

export function Field({ label, style, ...rest }: Props) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.muted} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
});
