import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';

const router = Router();

// Inbox for the authed user.
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('*, from_user:from_user_id(full_name, role)')
    .eq('to_user_id', req.authUserId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ messages: data });
});

router.post('/:id/read', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('to_user_id', req.authUserId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ message: data });
});

// Signed URL for attachment (e.g. prescription PDF).
router.get('/:id/attachment-url', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { data: msg } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!msg) return res.status(404).json({ error: 'not_found' });
  if (msg.to_user_id !== req.authUserId && msg.from_user_id !== req.authUserId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!msg.attachment_path) return res.status(404).json({ error: 'no_attachment' });

  const bucket = msg.kind === 'prescription' ? 'prescriptions' : 'recordings';
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(msg.attachment_path, 3600);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ url: data.signedUrl });
});

export default router;
