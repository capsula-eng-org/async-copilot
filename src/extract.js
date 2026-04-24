import OpenAI from 'openai';
import { config, COMPANIES } from './config.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const SCHEMA = {
  type: 'object',
  properties: {
    company: { type: 'string', enum: COMPANIES },
    project: { type: 'string', description: 'Project name; must match a record in the Projects table (e.g. "Inbound Chat Automation", "SEO Blog", "Data Management")' },
    done: { type: 'string', description: 'Completed tasks' },
    inProgress: { type: 'string', description: 'Current tasks in progress today' },
    blocked: { type: 'string', description: 'Blockers or dependencies; "N/A" if none' },
  },
  required: ['company', 'project', 'done', 'inProgress', 'blocked'],
  additionalProperties: false,
};

const SYSTEM = `You extract a daily standup entry from a voice-note transcript.
Rules:
- Company MUST be one of: ${COMPANIES.join(', ')}. Pick the most likely one from context; if ambiguous, default to TradeSpace.
- Project: echo the project name exactly as the user says it. Do not invent or translate.
- If a field is not mentioned, use an empty string (for blocked, use "N/A").
- Do not invent facts. Strip filler words ("um", "like").`;

export async function extractUpdate(transcript) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: transcript },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'standup_entry', schema: SCHEMA, strict: true },
    },
  });
  return JSON.parse(res.choices[0].message.content);
}
