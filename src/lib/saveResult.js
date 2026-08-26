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
import { supabase } from '@/api/supabaseClient';

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

// ── Auth helper ─────────────────────────────────────────────────────────
// Ensure the payload always has `created_by` set so the NOT NULL constraint
// and RLS policy (`created_by = auth.email()`) both pass. Without this, a
// transient session glitch causes makeEntity.create() to omit created_by,
// triggering a 400 from PostgREST before RLS is even evaluated.
async function ensureCreatedBy(payload) {
  if (payload.created_by) return payload;           // already set
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (email) return { ...payload, created_by: email };
  } catch {}
  return payload;                                    // let the caller fail with a clear error
}

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

  // Always stamp created_by from the local session so NOT NULL + RLS pass.
  const safePayload = await ensureCreatedBy(payload);

  // Attempt 1 — direct entity call
  try {
    let res;
    if (mode === 'update' && id) {
      res = await base44.entities.AISavedResult.update(id, safePayload);
    } else {
      res = await base44.entities.AISavedResult.create(safePayload);
    }
    const saved = res || { ...safePayload, id: id || safePayload.id };
    lsUpsert(toolType, saved);            // keep localStorage in sync
    return { ok: true, source: 'db', id: saved.id };
  } catch (err1) {
    // Attempt 2 — retry once (handles token-refresh race)
    try {
      await sleep(RETRY_MS);
      let res;
      if (mode === 'update' && id) {
        res = await base44.entities.AISavedResult.update(id, safePayload);
      } else {
        res = await base44.entities.AISavedResult.create(safePayload);
      }
      const saved = res || { ...safePayload, id: id || safePayload.id };
      lsUpsert(toolType, saved);
      return { ok: true, source: 'db', id: saved.id };
    } catch (err2) {
      // Attempt 3 — localStorage fallback (never lose the student's work)
      const localId = id || safePayload.id || crypto.randomUUID?.() || `${Date.now()}`;
      const row = { ...safePayload, id: localId, _local: true, created_date: new Date().toISOString() };
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
 * When toolType is null, loads ALL tool results (used by UnifiedChat sidebar).
 */
export async function loadSavedResults(toolType, userEmail) {
  const filter = { created_by: userEmail };
  if (toolType) filter.tool_type = toolType;  // null → skip filter, load all tools

  let dbRows = [];
  try {
    dbRows = await base44.entities.AISavedResult.filter(filter, '-date_created');
  } catch {}

  // Read from localStorage — all tools or a specific one.
  let localRows;
  if (toolType) {
    localRows = lsRead(toolType);
  } else {
    // Scan all acedit_saved_* keys for the UnifiedChat sidebar.
    localRows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LS_PREFIX)) {
        try { localRows.push(...JSON.parse(localStorage.getItem(key) || '[]')); } catch {}
      }
    }
  }

  // Merge: DB rows first, then local-only rows (not in DB)
  const seen = new Set((dbRows || []).map(r => r.id));
  const localOnly = localRows.filter(r => r.id && !seen.has(r.id));

  return [...(dbRows || []), ...localOnly];
}
