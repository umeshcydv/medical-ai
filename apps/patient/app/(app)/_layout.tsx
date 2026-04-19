import React from 'react';
import { Tabs } from 'expo-router';
import { colors } from '../../src/lib/theme';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="prescriptions" options={{ title: 'Prescriptions' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="book" options={{ href: null }} />
      <Tabs.Screen name="intake/[appointmentId]" options={{ href: null }} />
    </Tabs>
  );
}
