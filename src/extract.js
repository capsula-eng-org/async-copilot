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

CRITICAL TRANSLATION RULE (do this BEFORE extracting fields):
If the transcript is not in English, TRANSLATE it to English first. The final JSON output MUST always be in English — every field value, every word — regardless of the input language. The only exception is proper nouns (project names), which stay as the user said them.

Output ONLY a JSON object (no prose, no markdown) matching this shape:
{
  "company": "TradeSpace" | "Enginectra",
  "project": "<project name as a proper noun, or empty string>",
  "done": "<completed tasks, IN ENGLISH>",
  "inProgress": "<today's tasks, IN ENGLISH>",
  "blocked": "<blockers in English, or 'N/A'>"
}

Field rules:
- "company": exactly "TradeSpace" or "Enginectra". If ambiguous, default to "TradeSpace".
- "project": the project name as spoken (proper noun, keep original). Empty string if no project mentioned.
- "done" / "inProgress" / "blocked": ALWAYS in English. If the user lists MULTIPLE items, format as a bulleted list with each item on its own line prefixed by "- " (hyphen + space). If ONE item, no bullet. Never bullet "N/A".
- Strip filler words in any language ("um", "like", "you know", "pues", "este", "o sea", "eh").
- Do not invent facts.

Example (Spanish input):
Transcript: "Hoy en TradeSpace trabajé en Marketing Q2. Terminé los copies del landing y revisé el brief del cliente. Mañana arranco con el diseño visual y una reunión con el equipo. No hay bloqueos por ahora."
Output:
{"company":"TradeSpace","project":"Marketing Q2","done":"- Finished the landing page copy\\n- Reviewed the client brief","inProgress":"- Start the visual design\\n- Team meeting","blocked":"N/A"}

Example (English, single-item fields):
Transcript: "Enginectra update. Finished the API integration. Today I'm working on deployment. Blocked by missing credentials from ops."
Output:
{"company":"Enginectra","project":"","done":"Finished the API integration","inProgress":"Working on deployment","blocked":"Missing credentials from ops"}`;

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
