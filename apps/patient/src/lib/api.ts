import Constants from 'expo-constants';
import { supabase } from './supabase';

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string>;
const API_BASE_URL = extra.apiBaseUrl;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

export async function apiPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return res.json();
}
