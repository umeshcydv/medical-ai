import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiGet } from '../lib/api';
import type { User } from '@medical-ai/shared';

interface SessionState {
  loading: boolean;
  authed: boolean;
  user: User | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
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
    setUser(null);
  };

  return (
    <SessionContext.Provider value={{ loading, authed: !!user, user, refresh, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
