import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../src/state/session';

export default function Index() {
  const { authed, loading } = useSession();
  if (loading) return null;
  return <Redirect href={authed ? '/(app)/home' : '/(auth)/sign-in'} />;
}
