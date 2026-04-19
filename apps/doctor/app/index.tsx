import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../src/state/session';

export default function Index() {
  const { hasAuthSession, user, loading } = useSession();
  if (loading) return null;
  if (!hasAuthSession) return <Redirect href="/(auth)/sign-in" />;
  if (!user) return <Redirect href="/(auth)/sign-up" />;
  return <Redirect href="/(app)/patients" />;
}
