import { Telegraf } from 'telegraf';
import { config } from './config.js';
import { transcribeFromUrl } from './transcribe.js';
import { extractUpdate } from './extract.js';
import { insertDraft } from './airtable.js';

export const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

bot.use(async (ctx, next) => {
  if (ctx.from?.id !== config.TELEGRAM_ALLOWED_USER_ID) {
    if (ctx.chat) await ctx.reply('Unauthorized.');
    return;
  }
  return next();
});

bot.start(ctx => ctx.reply(
  'Async Co-Pilot ready. Send voice notes throughout the day.\n' +
  '9:55 AM Colombia: review ping. 10:00 AM: auto-post. Mon–Fri only.'
));

bot.on('voice', async ctx => {
  try {
    await ctx.reply('🎧 transcribing…');
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const transcript = await transcribeFromUrl(link.href);
    const draft = await extractUpdate(transcript);
    const result = await insertDraft({ ...draft, raw: transcript });

    const projectLine = result.projectMatched
      ? `• Project: ${draft.project}`
      : `• Project: ⚠️ "${result.projectAttempted}" not found in Projects table — link manually in Airtable`;

    await ctx.replyWithMarkdown(
      `✅ *staged*\n` +
      `• Company: ${draft.company}\n` +
      `${projectLine}\n` +
      `• Done: ${draft.done || '—'}\n` +
      `• In Progress: ${draft.inProgress || '—'}\n` +
      `• Blocked: ${draft.blocked || 'N/A'}`
    );
  } catch (err) {
    console.error('voice handler error:', err);
    console.error('  name:', err?.name);
    console.error('  status:', err?.status);
    console.error('  cause:', err?.cause);
    console.error('  cause.code:', err?.cause?.code);
    console.error('  cause.cause:', err?.cause?.cause);
    await ctx.reply(`❌ ${err.name || 'error'}: ${err.message}${err?.cause?.code ? ` (${err.cause.code})` : ''}`);
  }
});

bot.on('text', ctx => {
  if (ctx.message.text.startsWith('/')) return;
  ctx.reply('Send a voice note. (Text input isn\'t processed — edit drafts in Airtable if needed.)');
});
