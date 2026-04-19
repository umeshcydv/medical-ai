import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';

const router = Router();

// Create/complete profile after auth signup.
// - Patient: provide full_name, gender, age, marital_status, linked_doctor_id
// - Doctor:  provide full_name, specialty
const profileSchema = z.object({
  role: z.enum(['patient', 'doctor']),
  full_name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  age: z.number().int().positive().optional(),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed', 'other']).optional(),
  specialty: z.string().optional(),
  linked_doctor_id: z.string().uuid().optional(),
});

router.post('/profile', requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });

  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert({ id: req.authUserId, ...parsed.data })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ user: data });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  if (!req.profile) return res.status(404).json({ error: 'profile_not_found' });
  return res.json({ user: req.profile });
});

// Doctor directory lookup by id — used by patient during signup to link.
router.get('/doctor/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, full_name, specialty, role')
    .eq('id', req.params.id)
    .eq('role', 'doctor')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'doctor_not_found' });
  return res.json({ doctor: data });
});

export default router;
