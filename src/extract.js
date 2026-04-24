import OpenAI from 'openai';
import { z } from 'zod';
import { config, COMPANIES } from './config.js';

const groq = new OpenAI({
  apiKey: config.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const Schema = z.object({
  company: z.enum(COMPANIES),
  project: z.string(),
  done: z.string(),
  inProgress: z.string(),
  blocked: z.string(),
});

const SYSTEM = `You extract a daily standup entry from a voice-note transcript.
Respond with ONLY a JSON object (no prose, no markdown wrapping), matching this exact shape:
{
  "company": "TradeSpace" | "Enginectra",
  "project": "<project name as the user spoke it, or empty string>",
  "done": "<completed tasks>",
  "inProgress": "<tasks today>",
  "blocked": "<blockers, or 'N/A'>"
}

Rules:
- ALWAYS output field values in English, regardless of input language (the user may speak Spanish). Translate faithfully; do not paraphrase heavily.
- "company" MUST be exactly "TradeSpace" or "Enginectra". If ambiguous, default to "TradeSpace".
- "project": echo the project name as the user spoke it (keep the original project name even if it's in Spanish — only translate verbs/descriptions, not proper nouns). If no project mentioned, use an empty string.
- For "done", "inProgress", "blocked": if the user mentions MULTIPLE items/tasks, format as a bulleted list with each item on its own line, each prefixed with "- " (hyphen + space). If only ONE item, just write it plainly without a bullet. Never bullet "N/A".
  Example of a multi-item field: "- Finished the API integration\\n- Ran unit tests\\n- Updated documentation"
  Example of a single-item field: "Finished the API integration"
- Strip filler words ("um", "like", "you know", "eh", "pues"). Do not invent facts.
- Empty strings are allowed for missing fields. "blocked" defaults to "N/A".`;

export async function extractUpdate(transcript) {
  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: transcript },
    ],
  });
  let raw;
  try {
    raw = JSON.parse(res.choices[0].message.content);
  } catch {
    throw new Error(`LLM returned non-JSON: ${res.choices[0].message.content?.slice(0, 200)}`);
  }
  const result = Schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`LLM JSON failed schema: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
  }
  return result.data;
}
