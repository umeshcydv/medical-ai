import React from 'react';
import { ActivityIndicator, Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}

export function Button({ title, onPress, loading, disabled, variant = 'primary', style }: Props) {
  let bg = colors.primary;
  let textColor = '#fff';
  if (variant === 'secondary') {
    bg = colors.card;
    textColor = colors.primary;
  } else if (variant === 'danger') {
    bg = colors.danger;
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.primary },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 16, fontWeight: '600' },
});
