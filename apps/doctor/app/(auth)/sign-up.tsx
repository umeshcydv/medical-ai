import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Field } from '../../src/components/Field';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { apiPost } from '../../src/lib/api';
import { colors, spacing } from '../../src/lib/theme';

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password || !fullName) {
      return Alert.alert('Missing info', 'Please fill all required fields.');
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      return Alert.alert('Sign-up failed', error.message);
    }
    try {
      await apiPost('/users/profile', {
        role: 'doctor',
        full_name: fullName,
        email,
        specialty,
      });
      router.replace('/(app)/patients');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  return (
    <Screen keyboardAware>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={styles.title}>Create doctor account</Text>
        <Field label="Full name" value={fullName} onChangeText={setFullName} />
        <Field label="Specialty" value={specialty} onChangeText={setSpecialty} placeholder="e.g. General Physician" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Button title="Create account" onPress={submit} loading={loading} />
        <View style={{ marginTop: spacing.lg }}>
          <Link href="/(auth)/sign-in" style={styles.link}>
            Have an account? Sign in
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  link: { color: colors.primary, textAlign: 'center', fontWeight: '600' },
});
