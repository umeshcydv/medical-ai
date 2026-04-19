import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';

const router = Router();

// Doctor lists all patients linked to them.
router.get('/', requireAuth, requireRole('doctor'), async (req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, full_name, age, gender, marital_status, created_at')
    .eq('role', 'patient')
    .eq('linked_doctor_id', req.authUserId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ patients: data });
});

// Doctor fetches a single patient's full thread: profile + past visits + pending intake.
router.get('/:id', requireAuth, requireRole('doctor'), async (req: AuthedRequest, res: Response) => {
  const { data: patient } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', req.params.id)
    .eq('role', 'patient')
    .maybeSingle();
  if (!patient || patient.linked_doctor_id !== req.authUserId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { data: visits } = await supabaseAdmin
    .from('visit_sessions')
    .select('*')
    .eq('doctor_id', req.authUserId)
    .eq('patient_id', req.params.id)
    .order('created_at', { ascending: false });

  const { data: appointments } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('doctor_id', req.authUserId)
    .eq('patient_id', req.params.id)
    .order('scheduled_at', { ascending: false });

  return res.json({ patient, visits: visits || [], appointments: appointments || [] });
});

export default router;
