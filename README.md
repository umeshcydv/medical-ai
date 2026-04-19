# Medical AI Assistant

Mobile app suite for AI-assisted doctor-patient consultations.

## Apps

- **Patient App** (`apps/patient`) — Pre-visit intake chat, appointments, prescriptions inbox
- **Doctor App** (`apps/doctor`) — Patient queue, in-room recording, AI summaries, prescriptions
- **Backend** (`backend`) — Node.js + Express + Socket.io API
- **Shared** (`packages/shared`) — Shared TypeScript types and API client

## Stack

- Mobile: React Native (Expo)
- Backend: Node.js + Express + Socket.io
- DB/Auth/Storage: Supabase (PostgreSQL)
- AI: Claude (`claude-sonnet-4-6`), AWS Transcribe, OpenAI Whisper
- PDF: PDFKit

## Quick Start

```bash
npm install
cp backend/.env.example backend/.env   # fill in keys
npm run backend                         # start backend
npm run patient                         # start patient app (separate terminal)
npm run doctor                          # start doctor app (separate terminal)
```

## Environment Variables

See `backend/.env.example` for the required backend keys:
- Supabase URL + service role key
- Anthropic API key
- AWS credentials (Transcribe)
- OpenAI API key (Whisper)

## Database

Supabase migrations in `supabase/migrations/`. Apply with:

```bash
npx supabase db push
```
