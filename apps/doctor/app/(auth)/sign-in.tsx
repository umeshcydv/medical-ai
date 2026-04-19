import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Field } from '../../src/components/Field';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { colors, spacing } from '../../src/lib/theme';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return Alert.alert('Sign-in failed', error.message);
  };

  return (
    <Screen keyboardAware>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={styles.title}>Doctor sign in</Text>
        <Text style={styles.subtitle}>Access your patient queue</Text>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Button title="Sign in" onPress={submit} loading={loading} />
        <View style={{ marginTop: spacing.lg }}>
          <Link href="/(auth)/sign-up" style={styles.link}>
            First time? Create a doctor account
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { color: colors.muted, marginBottom: spacing.xl },
  link: { color: colors.primary, textAlign: 'center', fontWeight: '600' },
});
