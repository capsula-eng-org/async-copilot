import { createReadStream } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import OpenAI from 'openai';
import { config } from './config.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export async function transcribeFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`voice download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const path = join(tmpdir(), `voice-${Date.now()}.ogg`);
  await writeFile(path, buf);
  try {
    const result = await openai.audio.transcriptions.create({
      file: createReadStream(path),
      model: 'whisper-1',
    });
    return result.text;
  } finally {
    unlink(path).catch(() => {});
  }
}
