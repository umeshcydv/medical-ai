// Shared domain types used by backend, patient app, and doctor app.

export type UserRole = 'patient' | 'doctor';
export type Gender = 'male' | 'female' | 'other';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | 'other';

export interface User {
  id: string;
  role: UserRole;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  gender?: Gender | null;
  age?: number | null;
  marital_status?: MaritalStatus | null;
  specialty?: string | null;
  linked_doctor_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type AppointmentStatus =
  | 'scheduled'
  | 'intake_pending'
  | 'intake_done'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
}

export type ChatRole = 'assistant' | 'user';

export interface IntakeChat {
  id: string;
  appointment_id: string;
  patient_id: string;
  completed: boolean;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntakeMessage {
  id: string;
  intake_chat_id: string;
  role: ChatRole;
  content: string;
  question_index: number | null;
  created_at: string;
}

export type VisitStatus =
  | 'recording'
  | 'transcribing'
  | 'summary_ready'
  | 'summary_confirmed'
  | 'prescription_ready'
  | 'sent'
  | 'cancelled';

export interface TranscriptSegment {
  speaker: string; // e.g. 'SPEAKER_0', 'SPEAKER_1'
  text: string;
  start: number; // seconds
  end: number;
}

export interface SpeakerLabels {
  [speakerTag: string]: 'doctor' | 'patient' | 'unknown';
}

export interface PrescriptionMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface Prescription {
  patient_name: string;
  patient_age?: number;
  doctor_name: string;
  doctor_specialty?: string;
  diagnosis: string;
  medications: PrescriptionMedication[];
  instructions?: string;
  follow_up?: string;
  issued_at: string;
}

export interface VisitSession {
  id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  status: VisitStatus;
  recording_path: string | null;
  recording_duration_sec: number | null;
  transcript: TranscriptSegment[] | null;
  speaker_labels: SpeakerLabels | null;
  summary_draft: string | null;
  summary_final: string | null;
  summary_edit_chat: { role: ChatRole; content: string }[] | null;
  prescription_draft: Prescription | null;
  prescription_final: Prescription | null;
  prescription_pdf_path: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageKind = 'summary' | 'prescription' | 'note';

export interface InboxMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  visit_session_id: string | null;
  kind: MessageKind;
  title: string;
  body: string | null;
  attachment_path: string | null;
  read_at: string | null;
  created_at: string;
}

// -------- API request/response DTOs --------

export interface SignUpPatientReq {
  phone: string;
  full_name: string;
  gender: Gender;
  age: number;
  marital_status: MaritalStatus;
  linked_doctor_id: string; // v1: patient enters doctor's invite code
}

export interface BookAppointmentReq {
  doctor_id: string;
  scheduled_at: string;
}

export interface IntakeReplyReq {
  appointment_id: string;
  content: string;
}

export interface IntakeReplyRes {
  next_question: string | null; // null when intake is complete
  question_index: number | null;
  completed: boolean;
  summary?: string;
}

export interface StartVisitReq {
  appointment_id: string;
}

export interface UploadRecordingReq {
  visit_session_id: string;
  // file sent as multipart/form-data
}

export interface EditSummaryReq {
  visit_session_id: string;
  message: string; // e.g. "change diagnosis to migraine"
}

export interface EditSummaryRes {
  summary: string;
  assistant_reply: string;
}

export interface ConfirmSummaryReq {
  visit_session_id: string;
}

export interface GeneratePrescriptionRes {
  prescription: Prescription;
}

export interface UpdatePrescriptionReq {
  visit_session_id: string;
  prescription: Prescription;
}

export interface SendToPatientReq {
  visit_session_id: string;
}
