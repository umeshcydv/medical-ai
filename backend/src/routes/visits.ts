import { Router, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';
import {
  uploadAudioToS3,
  startTranscriptionJob,
  getTranscriptionJob,
  fetchAndParseTranscript,
} from '../services/transcribe.js';
import {
  generateVisitSummary,
  editSummary,
  draftPrescription,
} from '../services/claude.js';
import { transcribeVoiceNote } from '../services/whisper.js';
import { buildPrescriptionPdf } from '../services/pdf.js';
import type { Prescription, SpeakerLabels, VisitSession } from '@medical-ai/shared';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Doctor starts a visit: create session linked to an appointment.
router.post('/start', requireAuth, requireRole('doctor'), async (req: AuthedRequest, res: Response) => {
  const { appointment_id } = req.body as { appointment_id: string };
  if (!appointment_id) return res.status(400).json({ error: 'appointment_id_required' });

  const { data: appt } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('id', appointment_id)
    .maybeSingle();
  if (!appt || appt.doctor_id !== req.authUserId) return res.status(403).json({ error: 'forbidden' });

  // Reuse existing session if present.
  const { data: existing } = await supabaseAdmin
    .from('visit_sessions')
    .select('*')
    .eq('appointment_id', appointment_id)
    .maybeSingle();
  if (existing) return res.json({ visit: existing });

  const { data, error } = await supabaseAdmin
    .from('visit_sessions')
    .insert({
      appointment_id,
      doctor_id: req.authUserId,
      patient_id: appt.patient_id,
      status: 'recording',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin
    .from('appointments')
    .update({ status: 'in_progress' })
    .eq('id', appointment_id);

  return res.json({ visit: data });
});

// Upload recording (multipart/form-data: 'audio' field).
// Stores in Supabase storage, uploads to S3 for Transcribe, kicks off transcription job.
router.post(
  '/:id/recording',
  requireAuth,
  requireRole('doctor'),
  upload.single('audio'),
  async (req: AuthedRequest, res: Response) => {
    const visitId = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'audio_required' });

    const { data: visit } = await supabaseAdmin
      .from('visit_sessions')
      .select('*')
      .eq('id', visitId)
      .maybeSingle();
    if (!visit || visit.doctor_id !== req.authUserId) return res.status(403).json({ error: 'forbidden' });

    const storagePath = `${req.authUserId}/${visitId}.m4a`;

    // Store in Supabase for long-term doctor access.
    const { error: upErr } = await supabaseAdmin.storage
      .from('recordings')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });
    if (upErr) return res.status(500).json({ error: upErr.message });

    // Upload to S3 for AWS Transcribe job.
    const s3Key = `recordings/${visitId}.m4a`;
    const s3Uri = await uploadAudioToS3(s3Key, req.file.buffer, req.file.mimetype);

    const jobName = `visit-${visitId}-${Date.now()}`;
    await startTranscriptionJob(jobName, s3Uri);

    await supabaseAdmin
      .from('visit_sessions')
      .update({
        recording_path: storagePath,
        status: 'transcribing',
        transcript: { job_name: jobName } as unknown as VisitSession['transcript'],
      })
      .eq('id', visitId);

    return res.json({ ok: true, job_name: jobName });
  }
);

// Poll transcription job; when complete, fetch, parse, generate summary.
router.post('/:id/finalize-transcript', requireAuth, requireRole('doctor'), async (req: AuthedRequest, res: Response) => {
  const visitId = req.params.id;
  const { data: visit } = await supabaseAdmin
    .from('visit_sessions')
    .select('*')
    .eq('id', visitId)
    .maybeSingle();
  if (!visit || visit.doctor_id !== req.authUserId) return res.status(403).json({ error: 'forbidden' });

  const jobName = (visit.transcript as any)?.job_name;
  if (!jobName) return res.status(400).json({ error: 'no_transcription_job' });

  const job = await getTranscriptionJob(jobName);
  if (job?.TranscriptionJobStatus === 'IN_PROGRESS' || job?.TranscriptionJobStatus === 'QUEUED') {
    return res.json({ status: 'pending' });
  }
  if (job?.TranscriptionJobStatus !== 'COMPLETED') {
    return res.status(500).json({ error: 'transcription_failed', detail: job?.FailureReason });
  }

  const segments = await fetchAndParseTranscript(jobName);

  // Heuristic: doctor typically speaks first in a clinical setting.
  const speakerLabels: SpeakerLabels = {};
  if (segments.length > 0) {
    speakerLabels[segments[0].speaker] = 'doctor';
    segments.forEach((s) => {
      if (!(s.speaker in speakerLabels)) speakerLabels[s.speaker] = 'patient';
    });
  }

  // Fetch intake summary for context
  const { data: intake } = await supabaseAdmin
    .from('intake_chats')
    .select('ai_summary')
    .eq('appointment_id', visit.appointment_id)
    .maybeSingle();

  const summary = await generateVisitSummary(segments, speakerLabels, intake?.ai_summary || null);

  await supabaseAdmin
    .from('visit_sessions')
    .update({
      transcript: segments,
      speaker_labels: speakerLabels,
      summary_draft: summary,
      status: 'summary_ready',
    })
    .eq('id', visitId);

  return res.json({ status: 'ready', summary, transcript: segments, speaker_labels: speakerLabels });
});

// Doctor manually overrides speaker labels (when AI got them backwards).
router.patch('/:id/speakers', requireAuth, requireRole('doctor'), async (req: AuthedRequest, res: Response) => {
  const visitId = req.params.id;
  const labels = req.body.speaker_labels as SpeakerLabels;
  const { data, error } = await supabaseAdmin
    .from('visit_sessions')
    .update({ speaker_labels: labels })
    .eq('id', visitId)
    .eq('doctor_id', req.authUserId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ visit: data });
});

// Doctor edits summary via chat assistant.
const editSchema = z.object({ message: z.string().min(1) });
router.post('/:id/summary/edit', requireAuth, requireRole('doctor'), async (req: AuthedRequest, res: Response) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const { data: visit } = await supabaseAdmin
    .from('visit_sessions')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!visit || visit.doctor_id !== req.authUserId) return res.status(403).json({ error: 'forbidden' });

  const currentSummary = visit.summary_final || visit.summary_draft || '';
  const chat = (visit.summary_edit_chat as any[]) || [];

  const { newSummary, assistantReply } = await editSummary(currentSummary, chat, parsed.data.message);

  const updatedChat = [
    ...chat,
    { role: 'user', content: parsed.data.message },
    { role: 'assistant', content: assistantReply },
  ];

  await supabaseAdmin
    .from('visit_sessions')
    .update({
      summary_draft: newSummary,
      summary_edit_chat: updatedChat,
    })
    .eq('id', req.params.id);

  return res.json({ summary: newSummary, assistant_reply: assistantReply });
});

// Doctor submits a voice edit (multipart audio) — transcribed by Whisper, then edit flow.
router.post(
  '/:id/summary/edit-voice',
  requireAuth,
  requireRole('doctor'),
  upload.single('audio'),
  async (req: AuthedRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'audio_required' });
    const text = await transcribeVoiceNote(req.file.buffer, req.file.originalname || 'voice.m4a');

    const { data: visit } = await supabaseAdmin
      .from('visit_sessions')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!visit || visit.doctor_id !== req.authUserId) return res.status(403).json({ error: 'forbidden' });

    const currentSummary = visit.summary_final || visit.summary_draft || '';
    const chat = (visit.summary_edit_chat as any[]) || [];
    const { newSummary, assistantReply } = await editSummary(currentSummary, chat, text);

    const updatedChat = [
      ...chat,
      { role: 'user', content: text },
      { role: 'assistant', content: assistantReply },
    ];

    await supabaseAdmin
      .from('visit_sessions')
      .update({ summary_draft: newSummary, summary_edit_chat: updatedChat })
      .eq('id', req.params.id);

    return res.json({ transcribed_text: text, summary: newSummary, assistant_reply: assistantReply });
  }
);

// Doctor confirms summary → triggers prescription draft.
router.post('/:id/summary/confirm', requireAuth, requireRole('doctor'), async (req: AuthedRequest, res: Response) => {
  const { data: visit } = await supabaseAdmin
    .from('visit_sessions')
    .select('*, patient:patient_id(full_name, age), doctor:doctor_id(full_name, specialty)')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!visit || visit.doctor_id !== req.authUserId) return res.status(403).json({ error: 'forbidden' });

  const summary = visit.summary_draft || '';
  const prescription = await draftPrescription(summary, visit.patient as any, visit.doctor as any);

  await supabaseAdmin
    .from('visit_sessions')
    .update({
      summary_final: summary,
      prescription_draft: prescription,
      status: 'prescription_ready',
    })
    .eq('id', req.params.id);

  return res.json({ summary, prescription });
});

// Doctor edits the prescription before sending.
router.patch('/:id/prescription', requireAuth, requireRole('doctor'), async (req: AuthedRequest, res: Response) => {
  const prescription = req.body.prescription as Prescription;
  const { data, error } = await supabaseAdmin
    .from('visit_sessions')
    .update({ prescription_draft: prescription })
    .eq('id', req.params.id)
    .eq('doctor_id', req.authUserId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ visit: data });
});

// Doctor sends the prescription + summary to the patient.
// Generates PDF, uploads to storage, creates two inbox messages.
router.post('/:id/send', requireAuth, requireRole('doctor'), async (req: AuthedRequest, res: Response) => {
  const { data: visit } = await supabaseAdmin
    .from('visit_sessions')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!visit || visit.doctor_id !== req.authUserId) return res.status(403).json({ error: 'forbidden' });
  if (!visit.prescription_draft) return res.status(400).json({ error: 'no_prescription_draft' });

  const pdfBuffer = await buildPrescriptionPdf(visit.prescription_draft as Prescription);
  const pdfPath = `${req.authUserId}/${visit.id}.pdf`;

  const { error: upErr } = await supabaseAdmin.storage
    .from('prescriptions')
    .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
  if (upErr) return res.status(500).json({ error: upErr.message });

  const now = new Date().toISOString();

  await supabaseAdmin
    .from('visit_sessions')
    .update({
      prescription_final: visit.prescription_draft,
      prescription_pdf_path: pdfPath,
      status: 'sent',
      sent_at: now,
    })
    .eq('id', req.params.id);

  // Create inbox messages (two rows: summary + prescription).
  await supabaseAdmin.from('messages').insert([
    {
      from_user_id: req.authUserId,
      to_user_id: visit.patient_id,
      visit_session_id: visit.id,
      kind: 'summary',
      title: 'Visit summary',
      body: visit.summary_final || visit.summary_draft || '',
    },
    {
      from_user_id: req.authUserId,
      to_user_id: visit.patient_id,
      visit_session_id: visit.id,
      kind: 'prescription',
      title: 'Prescription',
      attachment_path: pdfPath,
    },
  ]);

  await supabaseAdmin
    .from('appointments')
    .update({ status: 'completed' })
    .eq('id', visit.appointment_id);

  return res.json({ ok: true, pdf_path: pdfPath });
});

// Fetch visit detail (for doctor timeline view).
router.get('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { data: visit } = await supabaseAdmin
    .from('visit_sessions')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!visit) return res.status(404).json({ error: 'not_found' });
  if (visit.doctor_id !== req.authUserId && visit.patient_id !== req.authUserId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  return res.json({ visit });
});

// List visits for a given patient (doctor only) — patient thread history.
router.get('/patient/:patientId', requireAuth, requireRole('doctor'), async (req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('visit_sessions')
    .select('*')
    .eq('doctor_id', req.authUserId)
    .eq('patient_id', req.params.patientId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ visits: data });
});

// Signed URL for recording playback (doctor).
router.get('/:id/recording-url', requireAuth, requireRole('doctor'), async (req: AuthedRequest, res: Response) => {
  const { data: visit } = await supabaseAdmin
    .from('visit_sessions')
    .select('recording_path, doctor_id')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!visit || visit.doctor_id !== req.authUserId) return res.status(403).json({ error: 'forbidden' });
  if (!visit.recording_path) return res.status(404).json({ error: 'no_recording' });

  const { data, error } = await supabaseAdmin.storage
    .from('recordings')
    .createSignedUrl(visit.recording_path, 3600);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ url: data.signedUrl });
});

export default router;
