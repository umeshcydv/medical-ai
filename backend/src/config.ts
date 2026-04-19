import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    anonKey: required('SUPABASE_ANON_KEY'),
  },
  anthropic: {
    apiKey: required('ANTHROPIC_API_KEY'),
    model: 'claude-sonnet-4-6',
  },
  openai: {
    apiKey: required('OPENAI_API_KEY'),
  },
  aws: {
    accessKeyId: required('AWS_ACCESS_KEY_ID'),
    secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
    region: process.env.AWS_REGION || 'us-east-1',
    transcribeBucket: required('AWS_TRANSCRIBE_BUCKET'),
  },
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:4000',
};
