// Dev-mode phone auth: no SMS provider, no email provider involved.
// We mint a Supabase anonymous session (which has no email/phone attached)
// and then store the phone as part of the patient profile. No emails are
// sent, so there's no rate limit to hit.
//
// Tradeoff: a fresh anonymous sign-in creates a NEW user each time — so
// "signing out and signing back in with the same phone" cannot resolve to
// the same account in this dev mode. That's fine until we wire real SMS.
//
// Flip DEV_OTP_BYPASS = false and replace verifyOtp() with signInWithOtp /
// verifyOtp once Twilio (or another SMS provider) is configured.

import { supabase } from './supabase';

export const DEV_OTP_BYPASS = true;
export const DEFAULT_DEV_OTP = '123456';

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export interface DevAuthResult {
  ok: boolean;
  error?: string;
}

export async function sendOtp(phone: string): Promise<DevAuthResult> {
  const n = normalizePhone(phone);
  if (n.length < 10) return { ok: false, error: 'Enter a valid phone number.' };
  return { ok: true };
}

export async function verifyOtp(phone: string, otp: string): Promise<DevAuthResult> {
  if (DEV_OTP_BYPASS && otp !== DEFAULT_DEV_OTP) {
    return { ok: false, error: `Use OTP ${DEFAULT_DEV_OTP} in dev mode.` };
  }

  // Reuse existing session if present.
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return { ok: true };

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    if (error.message.toLowerCase().includes('anonymous')) {
      return {
        ok: false,
        error:
          'Anonymous sign-ins are disabled in Supabase. Dashboard → Authentication → Settings → Allow anonymous sign-ins.',
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
