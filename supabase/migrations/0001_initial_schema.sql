-- Medical AI Assistant — Initial Schema
-- Users, appointments, intake chats, visit sessions, prescriptions, inbox messages

-- =====================================================================
-- USERS
-- =====================================================================
-- Extends Supabase auth.users with role-specific profile data.
-- role='patient' uses phone auth; role='doctor' uses email/password.

create type user_role as enum ('patient', 'doctor');
create type gender_t as enum ('male', 'female', 'other');
create type marital_status_t as enum ('single', 'married', 'divorced', 'widowed', 'other');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text not null,
  phone text,
  email text,
  -- patient-only fields
  gender gender_t,
  age int,
  marital_status marital_status_t,
  -- doctor-only fields
  specialty text,
  -- linking: for v1 (1-to-1), each patient is linked to exactly one doctor
  linked_doctor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_role_idx on public.users(role);
create index users_linked_doctor_idx on public.users(linked_doctor_id);

-- =====================================================================
-- APPOINTMENTS
-- =====================================================================

create type appointment_status as enum ('scheduled', 'intake_pending', 'intake_done', 'in_progress', 'completed', 'cancelled');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  doctor_id uuid not null references public.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  status appointment_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_doctor_idx on public.appointments(doctor_id, scheduled_at desc);
create index appointments_patient_idx on public.appointments(patient_id, scheduled_at desc);

-- =====================================================================
-- INTAKE CHAT (pre-visit)
-- =====================================================================
-- Holds the sequential 5-question intake plus any free-text follow-ups.

create type chat_role as enum ('assistant', 'user');

create table public.intake_chats (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.users(id) on delete cascade,
  completed boolean not null default false,
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id)
);

create table public.intake_messages (
  id uuid primary key default gen_random_uuid(),
  intake_chat_id uuid not null references public.intake_chats(id) on delete cascade,
  role chat_role not null,
  content text not null,
  question_index int,
  created_at timestamptz not null default now()
);

create index intake_messages_chat_idx on public.intake_messages(intake_chat_id, created_at);

-- =====================================================================
-- VISIT SESSIONS (in-room consultation)
-- =====================================================================

create type visit_status as enum ('recording', 'transcribing', 'summary_ready', 'summary_confirmed', 'prescription_ready', 'sent', 'cancelled');

create table public.visit_sessions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  doctor_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid not null references public.users(id) on delete cascade,
  status visit_status not null default 'recording',
  -- storage: audio in supabase storage bucket 'recordings'
  recording_path text,
  recording_duration_sec int,
  -- AWS Transcribe output
  transcript jsonb,  -- [{speaker: 'SPEAKER_0'|'SPEAKER_1', text, start, end}, ...]
  speaker_labels jsonb, -- {SPEAKER_0: 'doctor', SPEAKER_1: 'patient'}
  -- AI-generated summary (doctor may edit)
  summary_draft text,
  summary_final text,
  summary_edit_chat jsonb,  -- chat messages between doctor and AI while editing
  -- prescription draft + final
  prescription_draft jsonb,
  prescription_final jsonb,
  prescription_pdf_path text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visit_sessions_doctor_idx on public.visit_sessions(doctor_id, created_at desc);
create index visit_sessions_patient_idx on public.visit_sessions(patient_id, created_at desc);
create index visit_sessions_appointment_idx on public.visit_sessions(appointment_id);

-- =====================================================================
-- INBOX / MESSAGES (doctor → patient delivery of summary + prescription)
-- =====================================================================

create type message_kind as enum ('summary', 'prescription', 'note');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  visit_session_id uuid references public.visit_sessions(id) on delete cascade,
  kind message_kind not null,
  title text not null,
  body text,
  attachment_path text,  -- e.g. prescription PDF path in storage
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_to_user_idx on public.messages(to_user_id, created_at desc);

-- =====================================================================
-- UPDATED_AT TRIGGERS
-- =====================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at before update on public.users
  for each row execute function set_updated_at();
create trigger trg_appointments_updated_at before update on public.appointments
  for each row execute function set_updated_at();
create trigger trg_intake_chats_updated_at before update on public.intake_chats
  for each row execute function set_updated_at();
create trigger trg_visit_sessions_updated_at before update on public.visit_sessions
  for each row execute function set_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table public.users enable row level security;
alter table public.appointments enable row level security;
alter table public.intake_chats enable row level security;
alter table public.intake_messages enable row level security;
alter table public.visit_sessions enable row level security;
alter table public.messages enable row level security;

-- Users: can read self; doctors can read their linked patients; patients can read their linked doctor
create policy users_self_read on public.users for select
  using (
    id = auth.uid()
    or linked_doctor_id = auth.uid()
    or (select linked_doctor_id from public.users where id = auth.uid()) = id
  );

create policy users_self_update on public.users for update
  using (id = auth.uid());

create policy users_self_insert on public.users for insert
  with check (id = auth.uid());

-- Appointments: patient + doctor on the row can read; patient can create; both can update
create policy appointments_read on public.appointments for select
  using (patient_id = auth.uid() or doctor_id = auth.uid());

create policy appointments_patient_insert on public.appointments for insert
  with check (patient_id = auth.uid());

create policy appointments_update on public.appointments for update
  using (patient_id = auth.uid() or doctor_id = auth.uid());

-- Intake chats: patient owns; doctor on appointment can read
create policy intake_chats_patient on public.intake_chats for all
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

create policy intake_chats_doctor_read on public.intake_chats for select
  using (
    exists (
      select 1 from public.appointments a
      where a.id = intake_chats.appointment_id and a.doctor_id = auth.uid()
    )
  );

create policy intake_messages_patient on public.intake_messages for all
  using (
    exists (
      select 1 from public.intake_chats c
      where c.id = intake_messages.intake_chat_id and c.patient_id = auth.uid()
    )
  );

create policy intake_messages_doctor_read on public.intake_messages for select
  using (
    exists (
      select 1 from public.intake_chats c
      join public.appointments a on a.id = c.appointment_id
      where c.id = intake_messages.intake_chat_id and a.doctor_id = auth.uid()
    )
  );

-- Visit sessions: doctor owns; patient can read once sent
create policy visit_sessions_doctor on public.visit_sessions for all
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

create policy visit_sessions_patient_read on public.visit_sessions for select
  using (patient_id = auth.uid() and sent_at is not null);

-- Messages: sender and recipient can read; sender inserts
create policy messages_read on public.messages for select
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

create policy messages_insert on public.messages for insert
  with check (from_user_id = auth.uid());

create policy messages_update_read on public.messages for update
  using (to_user_id = auth.uid());

-- =====================================================================
-- STORAGE BUCKETS (created via app, policies defined here)
-- =====================================================================
-- Buckets to create manually in Supabase dashboard or via API:
--   'recordings' (private) — in-room audio recordings
--   'prescriptions' (private) — prescription PDFs

-- NOTE: storage.objects policies must be applied to the storage schema separately.
