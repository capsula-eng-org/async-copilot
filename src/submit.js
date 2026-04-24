import { config } from './config.js';
import { getPending, markSubmitted, createAsyncsRecord } from './airtable.js';

export async function submitDaily() {
  const drafts = await getPending();
  if (drafts.length === 0) return { submitted: 0, failed: 0, note: 'no pending drafts' };

  const submittedIds = [];
  const failures = [];

  for (const draft of drafts) {
    try {
      const recordId = await createAsyncsRecord(draft.fields);
      const res = await fetch(config.MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ record_id: recordId }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`webhook ${res.status} ${text.slice(0, 120)}`);
      }
      submittedIds.push(draft.id);
    } catch (err) {
      console.error(`submit failed for draft ${draft.id}:`, err.message);
      failures.push({ draftId: draft.id, error: err.message });
    }
  }

  if (submittedIds.length) await markSubmitted(submittedIds);

  return {
    submitted: submittedIds.length,
    failed: failures.length,
    failures: failures.length ? failures : undefined,
  };
}
