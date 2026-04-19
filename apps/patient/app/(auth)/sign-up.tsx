import React, { useState } from 'react';
import { StyleSheet, Text, View, Alert, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Field } from '../../src/components/Field';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { apiPost } from '../../src/lib/api';
import { colors, spacing } from '../../src/lib/theme';
import type { Gender, MaritalStatus } from '@medical-ai/shared';

type Step = 'otp' | 'profile';

export default function SignUp() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('otp');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // profile fields
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState('');
  const [marital, setMarital] = useState<MaritalStatus>('single');
  const [doctorCode, setDoctorCode] = useState('');

  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
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
    setStep('profile');
  };

  const saveProfile = async () => {
    if (!fullName || !age || !doctorCode) {
      return Alert.alert('Missing info', 'Please fill all fields');
    }
    setLoading(true);
    try {
      await apiPost('/users/profile', {
        role: 'patient',
        full_name: fullName,
        phone,
        gender,
        age: parseInt(age, 10),
        marital_status: marital,
        linked_doctor_id: doctorCode.trim(),
      });
      router.replace('/(app)/home');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  return (
    <Screen keyboardAware>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xl }}>
        <Text style={styles.title}>Create account</Text>

        {step === 'otp' && (
          <>
            <Text style={styles.subtitle}>Verify your phone</Text>
            <Field
              label="Phone number"
              placeholder="+1 555 000 0000"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
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
          </>
        )}

        {step === 'profile' && (
          <>
            <Text style={styles.subtitle}>A few details</Text>
            <Field label="Full name" value={fullName} onChangeText={setFullName} />
            <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
            <ChoiceRow
              label="Gender"
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
              value={gender}
              onChange={(v) => setGender(v as Gender)}
            />
            <ChoiceRow
              label="Marital status"
              options={[
                { value: 'single', label: 'Single' },
                { value: 'married', label: 'Married' },
                { value: 'divorced', label: 'Divorced' },
                { value: 'widowed', label: 'Widowed' },
                { value: 'other', label: 'Other' },
              ]}
              value={marital}
              onChange={(v) => setMarital(v as MaritalStatus)}
            />
            <Field
              label="Doctor code"
              placeholder="UUID from your doctor"
              value={doctorCode}
              onChangeText={setDoctorCode}
              autoCapitalize="none"
            />
            <Button title="Create account" onPress={saveProfile} loading={loading} />
          </>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <Link href="/(auth)/sign-in" style={styles.link}>
            Already have an account? Sign in
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

function ChoiceRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: spacing.xs }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {options.map((o) => (
          <Text
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[
              styles.chip,
              value === o.value && { backgroundColor: colors.primary, color: '#fff' },
            ]}
          >
            {o.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { color: colors.muted, marginBottom: spacing.lg },
  link: { color: colors.primary, textAlign: 'center', fontWeight: '600' },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.card,
  },
});
