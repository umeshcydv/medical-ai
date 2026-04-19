import React from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../src/state/session';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../src/lib/theme';

function Gate() {
  const { loading, authed } = useSession();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!authed && !inAuth) router.replace('/(auth)/sign-in');
    if (authed && inAuth) router.replace('/(app)/home');
  }, [loading, authed, segments]);

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
