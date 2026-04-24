import { config } from './config.js';
import { getPending, markSubmitted } from './airtable.js';

export async function submitDaily() {
  const drafts = await getPending();
  if (drafts.length === 0) return { submitted: 0, note: 'no pending drafts' };

  const payload = {
    date: new Date().toISOString().slice(0, 10),
    count: drafts.length,
    entries: drafts.map(d => ({
      company: d.fields['Company'] ?? '',
      project: d.fields['Project Linked'] ?? '',
      done: d.fields['Done Yesterday'] ?? '',
      inProgress: d.fields['In Progress Today'] ?? '',
      blocked: d.fields['Blocked'] ?? 'N/A',
    })),
  };

  const res = await fetch(config.MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`webhook POST failed: ${res.status} ${text}`);
  }

  await markSubmitted(drafts.map(d => d.id));
  return { submitted: drafts.length };
}
