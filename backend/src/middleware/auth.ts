import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, supabaseForUser } from '../supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@medical-ai/shared';

export interface AuthedRequest extends Request {
  authUserId: string;
  authJwt: string;
  db: SupabaseClient; // RLS-scoped client
  profile?: User;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  const jwt = header.slice('Bearer '.length);

  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !data.user) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }

  const r = req as AuthedRequest;
  r.authUserId = data.user.id;
  r.authJwt = jwt;
  r.db = supabaseForUser(jwt);

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profile) r.profile = profile as User;

  next();
}

export function requireRole(role: 'patient' | 'doctor') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const r = req as AuthedRequest;
    if (r.profile?.role !== role) {
      res.status(403).json({ error: 'forbidden_role' });
      return;
    }
    next();
  };
}
