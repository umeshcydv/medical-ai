import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiGet } from '../lib/api';
import type { User } from '@medical-ai/shared';

interface SessionState {
  loading: boolean;
  hasAuthSession: boolean;
  user: User | null;
  needsProfile: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [hasAuthSession, setHasAuthSession] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    const has = !!data.session;
    setHasAuthSession(has);

    if (!has) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await apiGet<{ user: User }>('/users/me');
      setUser(res.user);
    } catch {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setHasAuthSession(false);
    setUser(null);
  };

  const needsProfile = hasAuthSession && !user;

  return (
    <SessionContext.Provider
      value={{ loading, hasAuthSession, user, needsProfile, refresh, signOut }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
