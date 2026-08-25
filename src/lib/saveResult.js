// ════════════════════════════════════════════════════════════════════════════
// saveResult — robust save for AI tool outputs.
//
// Every AI tool calls this instead of touching the entity directly. It:
//   1. Tries the normal entity create/update (Supabase or Base44).
//   2. If that fails, retries once after a short delay (handles transient
//      auth-token refresh races).
//   3. If the DB is completely unreachable, falls back to localStorage so
//      the student's work is never silently lost.
//
// loadSavedResults pulls from localStorage when the DB returns nothing,
// and mergeSavedResults deduplicates the two sources for display.
// ════════════════════════════════════════════════════════════════════════════

import { base44 } from '@/api/base44Client';

const LS_PREFIX = 'acedit_saved_';
const RETRY_MS = 800;

// ── localStorage helpers ──────────────────────────────────────────────────
function lsKey(toolType) { return `${LS_PREFIX}${toolType}`; }

function lsRead(toolType) {
  try {
    return JSON.parse(localStorage.getItem(lsKey(toolType)) || '[]');
  } catch { return []; }
}

function lsWrite(toolType, rows) {
  try { localStorage.setItem(lsKey(toolType), JSON.stringify(rows)); } catch {}
}

function lsUpsert(toolType, row) {
  const rows = lsRead(toolType);
  const idx = rows.findIndex(r => r.id === row.id);
  if (idx >= 0) rows[idx] = row; else rows.unshift(row);
  lsWrite(toolType, rows);
}

function lsRemove(toolType, id) {
  lsWrite(toolType, lsRead(toolType).filter(r => r.id !== id));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Save an AI tool result. Returns { ok, source, id, error? }.
 *
 * @param {'create'|'update'} mode
 * @param {object} payload - tool_type, title, content, etc.
 * @param {string} [id] - required for 'update' mode
 */
export async function saveResult(mode, payload, id) {
  const toolType = payload.tool_type || 'unknown';

  // Attempt 1 — direct entity call
  try {
    let res;
    if (mode === 'update' && id) {
      res = await base44.entities.AISavedResult.update(id, payload);
    } else {
      res = await base44.entities.AISavedResult.create(payload);
    }
    const saved = res || { ...payload, id: id || payload.id };
    lsUpsert(toolType, saved);            // keep localStorage in sync
    return { ok: true, source: 'db', id: saved.id };
  } catch (err1) {
    // Attempt 2 — retry once (handles token-refresh race)
    try {
      await sleep(RETRY_MS);
      let res;
      if (mode === 'update' && id) {
        res = await base44.entities.AISavedResult.update(id, payload);
      } else {
        res = await base44.entities.AISavedResult.create(payload);
      }
      const saved = res || { ...payload, id: id || payload.id };
      lsUpsert(toolType, saved);
      return { ok: true, source: 'db', id: saved.id };
    } catch (err2) {
      // Attempt 3 — localStorage fallback (never lose the student's work)
      const localId = id || payload.id || crypto.randomUUID?.() || `${Date.now()}`;
      const row = { ...payload, id: localId, _local: true, created_date: new Date().toISOString() };
      lsUpsert(toolType, row);
      console.warn(`[saveResult] DB save failed, stored locally:`, err2?.message || err2);
      return { ok: true, source: 'local', id: localId, error: err2?.message };
    }
  }
}

/**
 * Delete a saved result (DB + localStorage).
 */
export async function deleteResult(toolType, id) {
  try {
    await base44.entities.AISavedResult.delete(id);
  } catch {}
  lsRemove(toolType, id);
}

/**
 * Load saved results for a tool. Merges DB + localStorage, deduped by id.
 */
export async function loadSavedResults(toolType, userEmail) {
  let dbRows = [];
  try {
    dbRows = await base44.entities.AISavedResult.filter(
      { created_by: userEmail, tool_type: toolType },
      '-date_created'
    );
  } catch {}

  const localRows = lsRead(toolType);

  // Merge: DB rows first, then local-only rows (not in DB)
  const seen = new Set((dbRows || []).map(r => r.id));
  const localOnly = localRows.filter(r => !seen.has(r.id));

  return [...(dbRows || []), ...localOnly];
}
