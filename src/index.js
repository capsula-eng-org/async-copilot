import express from 'express';
import { bot } from './bot.js';
import { config } from './config.js';
import { submitDaily } from './submit.js';
import { sendReview } from './review.js';
import { loadProjectsMap } from './airtable.js';

const app = express();
app.use(express.json());

function requireSecret(req, res, next) {
  if (req.get('x-webhook-secret') !== config.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

let skipToday = false;

bot.command('skip', ctx => {
  skipToday = true;
  ctx.reply('⏭ today\'s 10:00 AM post is cancelled. Drafts remain pending for tomorrow.');
});

function formatSubmitResult(result) {
  if (result.submitted > 0 && !result.failed) {
    return `✅ posted ${result.submitted} entr${result.submitted === 1 ? 'y' : 'ies'} to Make`;
  }
  if (result.submitted > 0 && result.failed) {
    const lines = result.failures.map(f => `• ${f.error}`).join('\n');
    return `⚠️ posted ${result.submitted}, ${result.failed} failed:\n${lines}`;
  }
  if (result.failed) {
    const lines = result.failures.map(f => `• ${f.error}`).join('\n');
    return `❌ all ${result.failed} failed:\n${lines}`;
  }
  return `ℹ️ ${result.note || 'nothing to post'}`;
}

bot.action('review:approve', async ctx => {
  try {
    await ctx.answerCbQuery('Posting now…');
    const result = await submitDaily();
    skipToday = true;
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await ctx.reply(formatSubmitResult(result));
  } catch (err) {
    console.error('approve error:', err);
    await ctx.reply(`❌ submit failed: ${err.message}`);
  }
});

bot.action('review:skip', async ctx => {
  skipToday = true;
  await ctx.answerCbQuery('Skipped');
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});
  await ctx.reply('⏭ today\'s 10:00 AM post is cancelled. Drafts remain pending.');
});

app.get('/health', (_, res) => res.json({ ok: true, tz: config.TZ }));

app.post('/review', requireSecret, async (_req, res) => {
  try { res.json(await sendReview()); }
  catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

app.post('/submit', requireSecret, async (_req, res) => {
  try {
    if (skipToday) {
      skipToday = false;
      return res.json({ skipped: true });
    }
    const result = await submitDaily();
    skipToday = false;
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

async function boot() {
  const count = await loadProjectsMap();
  console.log(`loaded ${count} projects from Airtable`);
  app.listen(config.PORT, () => console.log(`http :${config.PORT} (tz=${config.TZ})`));
  await bot.launch();
  console.log('telegram bot launched');
}

boot().catch(err => {
  console.error('boot failed:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
