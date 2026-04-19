import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';
import { INTAKE_QUESTIONS } from '@medical-ai/shared';
import { generateIntakeSummary, adaptiveFollowUp, getNextIntakeQuestion } from '../services/claude.js';
import type { IntakeMessage } from '@medical-ai/shared';

const router = Router();

// Start intake: create intake_chat row and return first question.
router.post('/start', requireAuth, requireRole('patient'), async (req: AuthedRequest, res: Response) => {
  const { appointment_id } = req.body as { appointment_id: string };
  if (!appointment_id) return res.status(400).json({ error: 'appointment_id_required' });

  // Verify appointment belongs to this patient.
  const { data: appt } = await supabaseAdmin
    .from('appointments')
    .select('id, patient_id')
    .eq('id', appointment_id)
    .maybeSingle();
  if (!appt || appt.patient_id !== req.authUserId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  // Create or fetch existing intake_chat.
  const { data: existing } = await supabaseAdmin
    .from('intake_chats')
    .select('*')
    .eq('appointment_id', appointment_id)
    .maybeSingle();

  let chatRow = existing;
  if (!chatRow) {
    const { data, error } = await supabaseAdmin
      .from('intake_chats')
      .insert({ appointment_id, patient_id: req.authUserId })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    chatRow = data;
    await supabaseAdmin
      .from('appointments')
      .update({ status: 'intake_pending' })
      .eq('id', appointment_id);

    // Seed first assistant question.
    await supabaseAdmin.from('intake_messages').insert({
      intake_chat_id: chatRow.id,
      role: 'assistant',
      content: INTAKE_QUESTIONS[0],
      question_index: 0,
    });
  }

  const { data: messages } = await supabaseAdmin
    .from('intake_messages')
    .select('*')
    .eq('intake_chat_id', chatRow.id)
    .order('created_at');

  return res.json({ intake_chat: chatRow, messages: messages || [] });
});

const replySchema = z.object({
  intake_chat_id: z.string().uuid(),
  content: z.string().min(1),
});

// Patient replies. We append user message, then ask next fixed question OR (after all 5)
// optionally ask a single adaptive follow-up, then finalize with an AI summary.
router.post('/reply', requireAuth, requireRole('patient'), async (req: AuthedRequest, res: Response) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const { data: chat } = await supabaseAdmin
    .from('intake_chats')
    .select('*')
    .eq('id', parsed.data.intake_chat_id)
    .maybeSingle();
  if (!chat || chat.patient_id !== req.authUserId) return res.status(403).json({ error: 'forbidden' });
  if (chat.completed) return res.status(400).json({ error: 'intake_already_completed' });

  // Append user message
  await supabaseAdmin.from('intake_messages').insert({
    intake_chat_id: chat.id,
    role: 'user',
    content: parsed.data.content,
  });

  const { data: allMessages } = await supabaseAdmin
    .from('intake_messages')
    .select('*')
    .eq('intake_chat_id', chat.id)
    .order('created_at');

  const messages = (allMessages || []) as IntakeMessage[];
  const userAnswers = messages.filter((m) => m.role === 'user').length;

  let nextQuestion: string | null = null;
  let questionIndex: number | null = null;

  if (userAnswers < INTAKE_QUESTIONS.length) {
    nextQuestion = getNextIntakeQuestion(userAnswers);
    questionIndex = userAnswers;
  } else {
    // After 5 fixed answers: ask ONE optional follow-up if useful, else finalize.
    const hasAskedFollowUp = messages.some(
      (m) => m.role === 'assistant' && m.question_index === null && m !== messages[0]
    );
    if (!hasAskedFollowUp) {
      const followUp = await adaptiveFollowUp(parsed.data.content, messages);
      if (followUp) {
        nextQuestion = followUp;
        questionIndex = null;
      }
    }
  }

  if (nextQuestion) {
    await supabaseAdmin.from('intake_messages').insert({
      intake_chat_id: chat.id,
      role: 'assistant',
      content: nextQuestion,
      question_index: questionIndex,
    });
    return res.json({ next_question: nextQuestion, question_index: questionIndex, completed: false });
  }

  // Finalize: generate summary.
  const { data: patient } = await supabaseAdmin
    .from('users')
    .select('full_name, age, gender')
    .eq('id', req.authUserId)
    .single();

  const summary = await generateIntakeSummary(patient!, messages);

  await supabaseAdmin
    .from('intake_chats')
    .update({ completed: true, ai_summary: summary })
    .eq('id', chat.id);

  await supabaseAdmin
    .from('appointments')
    .update({ status: 'intake_done' })
    .eq('id', chat.appointment_id);

  return res.json({ next_question: null, question_index: null, completed: true, summary });
});

// Fetch intake chat by appointment_id (doctor reads before visit; patient can review).
router.get('/:appointmentId', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { data: appt } = await supabaseAdmin
    .from('appointments')
    .select('id, patient_id, doctor_id')
    .eq('id', req.params.appointmentId)
    .maybeSingle();
  if (!appt) return res.status(404).json({ error: 'not_found' });
  if (appt.patient_id !== req.authUserId && appt.doctor_id !== req.authUserId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { data: chat } = await supabaseAdmin
    .from('intake_chats')
    .select('*')
    .eq('appointment_id', appt.id)
    .maybeSingle();
  if (!chat) return res.json({ intake_chat: null, messages: [] });

  const { data: messages } = await supabaseAdmin
    .from('intake_messages')
    .select('*')
    .eq('intake_chat_id', chat.id)
    .order('created_at');

  return res.json({ intake_chat: chat, messages: messages || [] });
});

export default router;
