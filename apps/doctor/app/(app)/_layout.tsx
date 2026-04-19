import React from 'react';
import { Tabs } from 'expo-router';
import { colors } from '../../src/lib/theme';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
      }}
    >
      <Tabs.Screen name="patients" options={{ title: 'Patients' }} />
      <Tabs.Screen name="queue" options={{ title: 'Queue' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="patient/[id]" options={{ href: null }} />
      <Tabs.Screen name="visit/[id]" options={{ href: null }} />
    </Tabs>
  );
}
