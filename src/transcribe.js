import OpenAI, { toFile } from 'openai';
import { config } from './config.js';

const groq = new OpenAI({
  apiKey: config.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

export async function transcribeFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`voice download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = await toFile(buf, 'voice.ogg', { type: 'audio/ogg' });
  const result = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo',
  });
  return result.text;
}
