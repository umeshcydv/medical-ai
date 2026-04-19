import React, { useState } from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Field } from '../../src/components/Field';
import { Button } from '../../src/components/Button';
import { SetupBanner } from '../../src/components/SetupBanner';
import { supabase } from '../../src/lib/supabase';
import { colors, spacing } from '../../src/lib/theme';

export default function SignIn() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!phone) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);
    if (error) return Alert.alert('Error', error.message);
    setOtpSent(true);
  };

  const verifyOtp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    setLoading(false);
    if (error) return Alert.alert('Error', error.message);
    // onAuthStateChange in session provider handles redirect.
  };

  return (
    <Screen keyboardAware>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <SetupBanner />
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Sign in to book and chat with your doctor</Text>

        <Field
          label="Phone number"
          placeholder="+1 555 000 0000"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          editable={!otpSent}
        />

        {otpSent && (
          <Field
            label="OTP code"
            placeholder="123456"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
          />
        )}

        {otpSent ? (
          <Button title="Verify" onPress={verifyOtp} loading={loading} />
        ) : (
          <Button title="Send OTP" onPress={sendOtp} loading={loading} />
        )}

        <View style={{ marginTop: spacing.lg }}>
          <Link href="/(auth)/sign-up" style={styles.link}>
            New here? Create an account
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
