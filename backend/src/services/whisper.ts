import OpenAI from 'openai';
import { config } from '../config.js';
import { toFile } from 'openai/uploads';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export async function transcribeVoiceNote(
  audio: Buffer,
  filename = 'note.m4a'
): Promise<string> {
  const file = await toFile(audio, filename);
  const resp = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
  });
  return resp.text;
}
