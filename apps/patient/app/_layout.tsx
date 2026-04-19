import React from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../src/state/session';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../src/lib/theme';

function Gate() {
  const { loading, hasAuthSession, user, needsProfile } = useSession();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    const onSignUp = inAuth && segments[1] === 'sign-up';

    if (!hasAuthSession && !inAuth) {
      router.replace('/(auth)/sign-in');
    } else if (needsProfile && !onSignUp) {
      // Authenticated but profile not created yet → go to sign-up profile step.
      router.replace('/(auth)/sign-up');
    } else if (hasAuthSession && user && inAuth) {
      router.replace('/(app)/home');
    }
  }, [loading, hasAuthSession, user, needsProfile, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
