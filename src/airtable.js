import Airtable from 'airtable';
import { config } from './config.js';

const base = new Airtable({ apiKey: config.AIRTABLE_API_KEY }).base(config.AIRTABLE_BASE_ID);
const drafts = () => base(config.AIRTABLE_TABLE);
const projects = () => base(config.AIRTABLE_PROJECTS_TABLE);
const asyncs = () => base(config.AIRTABLE_ASYNCS_TABLE);

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
    'Team Member': config.AIRTABLE_TEAM_MEMBER,
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

function bogotaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function createAsyncsRecord(draftFields) {
  const fields = {
    'Date': bogotaToday(),
    'Team Member': draftFields['Team Member'] || config.AIRTABLE_TEAM_MEMBER,
    'Company': draftFields['Company'] || '',
    'Done Yesterday': draftFields['Done Yesterday'] || '',
    'In Progress Today': draftFields['In Progress Today'] || '',
    'Blocked': draftFields['Blocked'] || 'N/A',
  };
  const linked = draftFields['Project Linked'];
  if (Array.isArray(linked) && linked.length) {
    fields['Project Linked'] = linked;
  }
  const [rec] = await asyncs().create([{ fields }]);
  return rec.id;
}
