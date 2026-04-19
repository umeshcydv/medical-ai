import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';

const router = Router();

const bookSchema = z.object({
  scheduled_at: z.string().datetime(),
});

// Patient books an appointment with their linked doctor (1-to-1 for v1).
router.post('/', requireAuth, requireRole('patient'), async (req: AuthedRequest, res: Response) => {
  const parsed = bookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const doctorId = req.profile?.linked_doctor_id;
  if (!doctorId) return res.status(400).json({ error: 'no_linked_doctor' });

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .insert({
      patient_id: req.authUserId,
      doctor_id: doctorId,
      scheduled_at: parsed.data.scheduled_at,
      status: 'scheduled',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ appointment: data });
});

// List appointments for the authed user (patient or doctor).
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const column = req.profile?.role === 'doctor' ? 'doctor_id' : 'patient_id';
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('*, patient:patient_id(id, full_name, age, gender), doctor:doctor_id(id, full_name, specialty)')
    .eq(column, req.authUserId)
    .order('scheduled_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ appointments: data });
});

router.get('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('*, patient:patient_id(id, full_name, age, gender, marital_status), doctor:doctor_id(id, full_name, specialty)')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'not_found' });
  if (data.patient_id !== req.authUserId && data.doctor_id !== req.authUserId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  return res.json({ appointment: data });
});

export default router;
