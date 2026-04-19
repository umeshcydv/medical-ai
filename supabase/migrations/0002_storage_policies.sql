-- Storage buckets and policies for recordings + prescriptions.
-- Run after buckets 'recordings' and 'prescriptions' are created.

-- Recordings: only the owning doctor can upload/read.
-- Path convention: recordings/{doctor_id}/{visit_session_id}.m4a

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('prescriptions', 'prescriptions', false)
on conflict (id) do nothing;

create policy "Doctors upload their recordings"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Doctors read their recordings"
on storage.objects for select
to authenticated
using (
  bucket_id = 'recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Prescriptions: doctor uploads; both doctor and recipient patient can read.
-- Path convention: prescriptions/{doctor_id}/{visit_session_id}.pdf
-- For patient read, we rely on a signed URL issued by the backend on message delivery.

create policy "Doctors upload prescriptions"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'prescriptions'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Doctors read own prescriptions"
on storage.objects for select
to authenticated
using (
  bucket_id = 'prescriptions'
  and (storage.foldername(name))[1] = auth.uid()::text
);
