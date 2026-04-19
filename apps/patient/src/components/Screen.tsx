import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../lib/theme';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  keyboardAware?: boolean;
}

export function Screen({ children, style, keyboardAware }: Props) {
  const content = (
    <View style={[styles.container, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {keyboardAware ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: spacing.lg },
});
