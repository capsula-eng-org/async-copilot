import OpenAI, { toFile } from 'openai';
import { config } from './config.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export async function transcribeFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`voice download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = await toFile(buf, 'voice.ogg', { type: 'audio/ogg' });
  const result = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
  });
  return result.text;
}
