import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_ALLOWED_USER_ID: z.coerce.number().int(),
  GROQ_API_KEY: z.string().min(1),
  AIRTABLE_API_KEY: z.string().min(1),
  AIRTABLE_BASE_ID: z.string().min(1),
  AIRTABLE_TABLE: z.string().default('Daily_Drafts'),
  AIRTABLE_PROJECTS_TABLE: z.string().default('Projects'),
  AIRTABLE_PROJECTS_NAME_FIELD: z.string().default('Name'),
  AIRTABLE_DRAFTS_URL: z.string().url().optional(),
  MAKE_WEBHOOK_URL: z.string().url(),
  WEBHOOK_SECRET: z.string().min(16),
  PORT: z.coerce.number().int().default(3000),
  TZ: z.string().default('America/Bogota'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const COMPANIES = ['TradeSpace', 'Enginectra'];
