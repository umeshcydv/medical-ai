import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Field } from '../../src/components/Field';
import { Button } from '../../src/components/Button';
import { apiPost } from '../../src/lib/api';
import { DEFAULT_DEV_OTP, DEV_OTP_BYPASS, normalizePhone, sendOtp, verifyOtp } from '../../src/lib/auth';
import { useSession } from '../../src/state/session';
import { colors, spacing } from '../../src/lib/theme';

type Step = 'otp' | 'profile';

export default function SignUp() {
  const router = useRouter();
  const { hasAuthSession } = useSession();
  const [step, setStep] = useState<Step>('otp');
  const [phone, setPhone] = useState('+91 ');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (hasAuthSession) setStep('profile');
  }, [hasAuthSession]);

  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
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
    if (!r.ok) return Alert.alert('Verification failed', r.error || 'Unknown error');
    setStep('profile');
  };

  const saveProfile = async () => {
    if (!fullName) return Alert.alert('Missing info', 'Please enter your full name.');
    setLoading(true);
    try {
      await apiPost('/users/profile', {
        role: 'doctor',
        full_name: fullName,
        phone: normalizePhone(phone),
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
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xl }}>
        <Text style={styles.title}>Create doctor account</Text>

        {step === 'otp' && (
          <>
            <Text style={styles.subtitle}>Verify your phone</Text>
            <Field
              label="Phone number"
              placeholder="+91 98765 43210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!otpSent}
            />
            {otpSent && (
              <Field
                label={DEV_OTP_BYPASS ? `OTP code (dev: ${DEFAULT_DEV_OTP})` : 'OTP code'}
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
          </>
        )}

        {step === 'profile' && (
          <>
            <Text style={styles.subtitle}>A few details</Text>
            <Field label="Full name" value={fullName} onChangeText={setFullName} />
            <Field label="Specialty" value={specialty} onChangeText={setSpecialty} placeholder="e.g. General Physician" />
            <Button title="Create account" onPress={saveProfile} loading={loading} />
          </>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <Link href="/(auth)/sign-in" style={styles.link}>
            Have an account? Sign in
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  subtitle: { color: colors.muted, marginBottom: spacing.lg },
  link: { color: colors.primary, textAlign: 'center', fontWeight: '600' },
  devHint: { color: colors.muted, fontSize: 12, marginTop: spacing.sm, textAlign: 'center' },
});
