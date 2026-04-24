import { Markup } from 'telegraf';
import { bot } from './bot.js';
import { config } from './config.js';
import { getPending } from './airtable.js';

function reviewKeyboard() {
  const buttons = [
    Markup.button.callback('✅ Approve & post now', 'review:approve'),
    Markup.button.callback('⏭ Skip today', 'review:skip'),
  ];
  if (config.AIRTABLE_DRAFTS_URL) {
    buttons.splice(1, 0, Markup.button.url('✏️ Edit in Airtable', config.AIRTABLE_DRAFTS_URL));
  }
  return Markup.inlineKeyboard(buttons, { columns: 1 });
}

export async function sendReview() {
  const drafts = await getPending();
  if (drafts.length === 0) {
    await bot.telegram.sendMessage(
      config.TELEGRAM_ALLOWED_USER_ID,
      '📭 no drafts pending — nothing will post at 10:00 AM'
    );
    return { sent: true, count: 0 };
  }

  const body = drafts.map((d, i) => {
    const f = d.fields;
    const project = Array.isArray(f['Project Linked']) && f['Project Linked'].length
      ? `linked (${f['Project Linked'].length})`
      : '⚠️ unlinked';
    return `*${i + 1}. ${f['Company'] || '?'}* — project: ${project}\n` +
      `Done: ${f['Done Yesterday'] || '—'}\n` +
      `Today: ${f['In Progress Today'] || '—'}\n` +
      `Blocked: ${f['Blocked'] || 'N/A'}`;
  }).join('\n\n');

  await bot.telegram.sendMessage(
    config.TELEGRAM_ALLOWED_USER_ID,
    `📝 *9:55 review* — auto-posts at 10:00 AM Colombia\n\n${body}`,
    { parse_mode: 'Markdown', ...reviewKeyboard() }
  );
  return { sent: true, count: drafts.length };
}
