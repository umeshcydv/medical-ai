import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string>;
const SUPABASE_URL = extra.supabaseUrl;
const SUPABASE_ANON_KEY = extra.supabaseAnonKey;

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
