# Setup Guide

Step-by-step to get Patient + Doctor apps running end-to-end.

## 1. Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Project settings → **API** → copy:
   - `Project URL`
   - `anon` public key
   - `service_role` secret key (backend only)
3. Authentication → **Providers** → enable **Phone** (Twilio credentials required for real OTP; for dev you can use the Supabase test phone).
4. Authentication → **Providers** → enable **Email** (password sign-in) for doctors.
5. SQL Editor → paste and run these two files in order:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_storage_policies.sql`
6. Storage → confirm two buckets exist: `recordings`, `prescriptions` (the migration creates them).

## 2. Backend env

Copy `backend/.env.example` → `backend/.env` and fill:

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_TRANSCRIBE_BUCKET=your-s3-bucket-name
```

AWS needs: an S3 bucket in the same region for Transcribe inputs/outputs, and an IAM user with `s3:*` on that bucket + `transcribe:*`.

## 3. Wire Supabase into the apps

Edit `apps/patient/app.json` and `apps/doctor/app.json` → `expo.extra`:

```json
"extra": {
  "apiBaseUrl": "http://10.0.2.2:4000",   // emulator → host. Physical device: use your laptop LAN IP
  "supabaseUrl": "https://xxx.supabase.co",
  "supabaseAnonKey": "eyJ..."
}
```

For a physical Android device, `apiBaseUrl` must be your laptop's LAN IP (e.g. `http://192.168.1.42:4000`) — `localhost` won't reach the laptop from the phone.

## 4. Run

Three terminals:

```
# terminal 1
npm run backend

# terminal 2
npm run patient

# terminal 3
npm run doctor
```

## 5. First-time flow

1. In the Doctor app: sign up → go to Profile → copy your **doctor code** (your user UUID).
2. In the Patient app: sign up → paste the doctor code to link.
3. Patient: Home → Book appointment.
4. Patient: open the appointment → complete the 5-question intake.
5. Doctor: Queue → tap the intake-done patient → Start visit → record → stop → check transcription → review/edit summary → confirm → edit prescription → send.
6. Patient: Inbox → summary + prescription PDF appear.

## Troubleshooting

- **App shows "Setup required" banner**: `expo.extra.supabaseUrl` / `supabaseAnonKey` are empty in `app.json`. Fill them and restart the dev server.
- **OTP doesn't arrive**: Supabase phone auth needs Twilio (or another SMS provider) configured in the Supabase dashboard.
- **Transcription hangs**: visit Doctor app → visit → tap "Check status" to poll AWS Transcribe. First jobs can take 1–2 min.
- **Physical device can't reach backend**: verify `apiBaseUrl` is your laptop's LAN IP, and your firewall allows port 4000.
