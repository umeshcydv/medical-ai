import React, { useState } from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Field } from '../../src/components/Field';
import { Button } from '../../src/components/Button';
import { SetupBanner } from '../../src/components/SetupBanner';
import { DEFAULT_DEV_OTP, DEV_OTP_BYPASS, sendOtp, verifyOtp } from '../../src/lib/auth';
import { colors, spacing } from '../../src/lib/theme';

export default function SignIn() {
  const [phone, setPhone] = useState('+91 ');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSend = async () => {
    setLoading(true);
    const r = await sendOtp(phone);
    setLoading(false);
    if (!r.ok) return Alert.alert('Error', r.error || 'Failed to send OTP');
    setOtpSent(true);
    if (DEV_OTP_BYPASS) setOtp(DEFAULT_DEV_OTP);
  };

  const onVerify = async () => {
    setLoading(true);
    const r = await verifyOtp(phone, otp);
    setLoading(false);
    if (!r.ok) return Alert.alert('Sign-in failed', r.error || 'Unknown error');
    // session provider handles redirect.
  };

  return (
    <Screen keyboardAware>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <SetupBanner />
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Sign in to book and chat with your doctor</Text>

        <Field
          label="Phone number"
          placeholder="+91 98765 43210"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          editable={!otpSent}
        />

        {otpSent && (
          <Field
            label={DEV_OTP_BYPASS ? `OTP code (dev: use ${DEFAULT_DEV_OTP})` : 'OTP code'}
            placeholder="123456"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
          />
        )}

        {otpSent ? (
          <Button title="Verify" onPress={onVerify} loading={loading} />
        ) : (
          <Button title="Send OTP" onPress={onSend} loading={loading} />
        )}

        {DEV_OTP_BYPASS && (
          <Text style={styles.devHint}>
            Dev mode: any phone works, OTP is always {DEFAULT_DEV_OTP}
          </Text>
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
  devHint: { color: colors.muted, fontSize: 12, marginTop: spacing.sm, textAlign: 'center' },
});
