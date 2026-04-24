import Airtable from 'airtable';
import { config } from './config.js';

const base = new Airtable({ apiKey: config.AIRTABLE_API_KEY }).base(config.AIRTABLE_BASE_ID);
const drafts = () => base(config.AIRTABLE_TABLE);
const projects = () => base(config.AIRTABLE_PROJECTS_TABLE);

let projectMap = new Map();

export async function loadProjectsMap() {
  const records = await projects().select({
    fields: [config.AIRTABLE_PROJECTS_NAME_FIELD],
  }).all();
  projectMap = new Map(
    records
      .map(r => [String(r.fields[config.AIRTABLE_PROJECTS_NAME_FIELD] ?? '').trim().toLowerCase(), r.id])
      .filter(([name]) => name.length > 0)
  );
  return projectMap.size;
}

function resolveProjectId(name) {
  if (!name) return null;
  return projectMap.get(name.trim().toLowerCase()) ?? null;
}

export async function insertDraft(draft) {
  let projectId = resolveProjectId(draft.project);
  if (!projectId && draft.project) {
    await loadProjectsMap();
    projectId = resolveProjectId(draft.project);
  }

  const fields = {
    'Company': draft.company || '',
    'Done Yesterday': draft.done || '',
    'In Progress Today': draft.inProgress || '',
    'Blocked': draft.blocked || 'N/A',
    'Raw Transcript': draft.raw || '',
  };
  if (projectId) fields['Project Linked'] = [projectId];

  const [rec] = await drafts().create([{ fields }]);
  return {
    id: rec.id,
    projectMatched: Boolean(projectId),
    projectAttempted: draft.project || '',
  };
}

export async function getPending() {
  const records = await drafts().select({
    filterByFormula: 'NOT({Submitted At})',
  }).all();
  return records.map(r => ({ id: r.id, fields: r.fields }));
}

export async function markSubmitted(ids) {
  const stamp = new Date().toISOString();
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10).map(id => ({
      id,
      fields: { 'Submitted At': stamp },
    }));
    await drafts().update(batch);
  }
}
