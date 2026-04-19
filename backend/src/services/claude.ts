import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type {
  IntakeMessage,
  Prescription,
  TranscriptSegment,
  SpeakerLabels,
  User,
} from '@medical-ai/shared';
import { INTAKE_QUESTIONS } from '@medical-ai/shared';

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const MODEL = config.anthropic.model;

// ---------- Intake: generate summary from Q&A transcript ----------

export async function generateIntakeSummary(
  patient: Pick<User, 'full_name' | 'age' | 'gender'>,
  messages: IntakeMessage[]
): Promise<string> {
  const qa = messages
    .map((m) => `${m.role === 'assistant' ? 'Q' : 'A'}: ${m.content}`)
    .join('\n');

  const system = `You are a medical intake assistant. Given a patient's pre-visit Q&A transcript,
produce a concise clinical summary for the doctor. Use clear sections: Chief Complaint, History,
Medications & Allergies, Relevant Conditions. Do NOT diagnose or prescribe. Keep under 200 words.`;

  const userMsg = `Patient: ${patient.full_name}${patient.age ? `, age ${patient.age}` : ''}${patient.gender ? `, ${patient.gender}` : ''}

Intake transcript:
${qa}`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system,
    messages: [{ role: 'user', content: userMsg }],
  });

  const text = resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
  return text;
}

// ---------- Intake: ask optional adaptive follow-up when patient adds info ----------

export async function adaptiveFollowUp(
  previousAnswer: string,
  fullHistory: IntakeMessage[]
): Promise<string | null> {
  // After the 5 fixed questions, patient may add extra info in free text.
  // Claude decides whether one short follow-up clarifies anything useful; else returns null.
  const history = fullHistory
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'Patient'}: ${m.content}`)
    .join('\n');

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: `You are a medical intake assistant. The patient just added extra detail after
the 5 fixed questions. Decide if ONE short clarifying follow-up would help the doctor. If yes,
respond with just the question (no preamble). If no, respond with exactly: NO_FOLLOWUP.`,
    messages: [
      {
        role: 'user',
        content: `Conversation so far:\n${history}\n\nPatient just said: "${previousAnswer}"\n\nYour response:`,
      },
    ],
  });
  const text = resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('')
    .trim();
  if (text === 'NO_FOLLOWUP' || text.includes('NO_FOLLOWUP')) return null;
  return text;
}

// ---------- In-room: summarize transcript ----------

export async function generateVisitSummary(
  transcript: TranscriptSegment[],
  speakerLabels: SpeakerLabels,
  intakeSummary: string | null
): Promise<string> {
  const labeled = transcript
    .map((seg) => {
      const who = speakerLabels[seg.speaker] || 'unknown';
      return `[${who}] ${seg.text}`;
    })
    .join('\n');

  const system = `You are a clinical scribe. Given a transcribed doctor-patient conversation,
produce a structured SOAP-style note for the doctor to review and edit.
Sections: Subjective, Objective, Assessment, Plan. Keep it factual — do NOT invent findings.
If a section has no information, write "(not discussed)".`;

  const userMsg = `${intakeSummary ? `Pre-visit intake summary:\n${intakeSummary}\n\n` : ''}In-room transcript:
${labeled}`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: userMsg }],
  });
  return resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

// ---------- In-room: doctor edits summary via chat ----------

export async function editSummary(
  currentSummary: string,
  editChat: { role: 'user' | 'assistant'; content: string }[],
  doctorMessage: string
): Promise<{ newSummary: string; assistantReply: string }> {
  const system = `You help a doctor refine a clinical note. When the doctor requests a change,
apply it and return the UPDATED FULL NOTE, then a short confirmation of what you changed.
Respond in this exact format:

<note>
...updated full note...
</note>
<reply>
...one-sentence confirmation...
</reply>`;

  const history = editChat.map((m) => ({ role: m.role, content: m.content }));

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system,
    messages: [
      {
        role: 'user',
        content: `Current note:\n${currentSummary}\n\nChange request: ${doctorMessage}`,
      },
      ...history,
    ],
  });
  const text = resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  const noteMatch = text.match(/<note>([\s\S]*?)<\/note>/);
  const replyMatch = text.match(/<reply>([\s\S]*?)<\/reply>/);
  return {
    newSummary: noteMatch?.[1]?.trim() || currentSummary,
    assistantReply: replyMatch?.[1]?.trim() || 'Updated.',
  };
}

// ---------- Prescription: draft from summary ----------

export async function draftPrescription(
  summary: string,
  patient: Pick<User, 'full_name' | 'age'>,
  doctor: Pick<User, 'full_name' | 'specialty'>
): Promise<Prescription> {
  const system = `You draft a structured medical prescription from a doctor's clinical note.
Respond ONLY with valid JSON matching this schema:
{
  "diagnosis": string,
  "medications": [{"name": string, "dosage": string, "frequency": string, "duration": string, "notes"?: string}],
  "instructions": string,
  "follow_up": string
}
Be conservative — only include medications clearly indicated by the note. If uncertain, use an empty list.`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system,
    messages: [{ role: 'user', content: `Clinical note:\n${summary}\n\nReturn JSON only.` }],
  });
  const text = resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('')
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { diagnosis: '', medications: [], instructions: '', follow_up: '' };

  return {
    patient_name: patient.full_name,
    patient_age: patient.age ?? undefined,
    doctor_name: doctor.full_name,
    doctor_specialty: doctor.specialty ?? undefined,
    diagnosis: parsed.diagnosis || '',
    medications: parsed.medications || [],
    instructions: parsed.instructions || '',
    follow_up: parsed.follow_up || '',
    issued_at: new Date().toISOString(),
  };
}

// ---------- Intake: get next question (step through fixed list) ----------

export function getNextIntakeQuestion(questionIndex: number): string | null {
  if (questionIndex < 0 || questionIndex >= INTAKE_QUESTIONS.length) return null;
  return INTAKE_QUESTIONS[questionIndex];
}
