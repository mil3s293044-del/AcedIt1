// ════════════════════════════════════════════════════════════════════════════
// Phase 3c — migrate data from Base44 → Supabase.
//
// This is the ONLY script that does the data migration. Run it from the project
// root. It's idempotent — re-running skips users/rows already migrated.
//
// USAGE:
//
//   # Dry run — read from Base44, transform, but DO NOT write to Supabase.
//   node scripts/migrateBase44ToSupabase.mjs --dry-run
//
//   # Run for one entity only (good for testing).
//   node scripts/migrateBase44ToSupabase.mjs --dry-run --entity=user_profiles
//
//   # Run for one user only (great for spot-check).
//   node scripts/migrateBase44ToSupabase.mjs --dry-run --user=miles@example.com
//
//   # Real run (writes to Supabase). Always do a --dry-run first.
//   node scripts/migrateBase44ToSupabase.mjs
//
// REQUIRED ENV VARS (in .env.local):
//   • VITE_BASE44_APP_ID                — Base44 app ID
//   • VITE_BASE44_APP_BASE_URL          — Base44 deploy URL (https://acedit.au)
//   • BASE44_API_KEY                    — Base44 app-level API key (bypasses user RLS)
//   • VITE_SUPABASE_URL                 — Supabase project URL
//   • SUPABASE_SERVICE_ROLE_KEY         — Supabase service role key (server-only)
//
// HOW TO ADD A NEW ENTITY:
//   1. Add an entry to MIGRATIONS below: { base44: 'EntityName', supabase: 'table_name', transform }
//   2. The `transform` function takes a Base44 row and returns the Supabase row.
//   3. Re-run the script with --dry-run --entity=<table_name>.
// ════════════════════════════════════════════════════════════════════════════

import { config as loadEnv } from "dotenv";
import { createClient as createBase44 } from "@base44/sdk";
import { createClient as createSupabase } from "@supabase/supabase-js";

// Load .env.local
loadEnv({ path: ".env.local" });

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name) => {
  const f = flag(name);
  if (!f) return null;
  if (f.includes("=")) return f.split("=").slice(1).join("=");
  return true;
};

const DRY_RUN = !!flag("dry-run");
const ENTITY_FILTER = flagValue("entity");
const USER_FILTER = flagValue("user");

// ─── Env validation ────────────────────────────────────────────────────────
const required = {
  VITE_BASE44_APP_ID: process.env.VITE_BASE44_APP_ID,
  VITE_BASE44_APP_BASE_URL: process.env.VITE_BASE44_APP_BASE_URL,
  BASE44_API_KEY: process.env.BASE44_API_KEY,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("❌ Missing required env vars in .env.local:");
  missing.forEach((k) => console.error(`   - ${k}`));
  process.exit(1);
}

// ─── Clients ───────────────────────────────────────────────────────────────
// In the browser the SDK uses the Vite middleware proxy (serverUrl: '') to
// route /api → acedit.au. In Node there's no proxy, so we point serverUrl
// directly at the live deploy.
const base44 = createBase44({
  appId: process.env.VITE_BASE44_APP_ID,
  headers: { api_key: process.env.BASE44_API_KEY },
  serverUrl: process.env.VITE_BASE44_APP_BASE_URL,
  requiresAuth: false,
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL,
});

const supabaseAdmin = createSupabase(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ─── Fetcher: get all rows of a Base44 entity ──────────────────────────────
// Uses the app-level api_key passed in the request headers. That credential
// bypasses Base44's per-user RLS, so list() returns rows across all users.
async function fetchAllBase44Rows(entityName) {
  const entity = base44.entities[entityName];
  if (!entity || typeof entity.list !== "function") {
    throw new Error(`Base44 entity "${entityName}" not found or has no list() method.`);
  }

  // SDK signature appears to be list(filter, limit, offset) where limit is a
  // number. Default limit is small (~10-100), so pass a generous explicit one.
  // For 130 users a single page of 5000 is plenty.
  const result = await entity.list({}, 5000);
  if (!Array.isArray(result)) {
    throw new Error(`list() returned non-array: ${typeof result}`);
  }
  return result;
}

// ─── Per-entity transforms ─────────────────────────────────────────────────
// Each transform takes a Base44 row → returns the matching Supabase row.
// Unknown / extra Base44 fields go into `extra` jsonb so we don't lose them.
//
// IMPORTANT: don't include columns that don't exist in the Supabase table —
// the insert will fail with "column does not exist".
//
// Field handling rules:
//   • created_by must be the user's email (preserves identity post-migration).
//   • Generated UUIDs (`id`) are dropped — Supabase auto-assigns new ones.
//   • Date strings pass through (Postgres auto-parses ISO 8601).
//   • null / undefined fields are skipped (Supabase uses column defaults).

const MIGRATIONS = [
  // ─── User → user_profiles ──────────────────────────────────────────────────
  // Source of truth for the 132 signed-up users. Base44 UserProfile is full of
  // Gary's test data so we don't pull from it; instead we seed a profile row
  // per User auth identity. Leaderboard fills in XP/study-time below.
  {
    base44: "User",
    supabase: "user_profiles",
    naturalKey: "created_by",
    // User entity owns itself — `created_by` is empty, so dedupe on email.
    dedupeKey: (b) => b.email?.toLowerCase(),
    pickBest: (a, b) => (new Date(b.updated_date ?? 0) > new Date(a.updated_date ?? 0) ? b : a),
    transform: (b) => {
      if (!b.email) return null;
      const known = {
        created_by: b.email.toLowerCase(),
        full_name: b.full_name ?? b.display_name ?? null,
        username: b.display_name ?? null,
        // Onboarding flags from User entity (where present)
        onboarding_completed: b.onboarding_completed ?? false,
        onboarding_completed_at: b.onboarding_completed_at ?? null,
        // Preserve the original signup date
        created_date: b.created_date ?? new Date().toISOString(),
      };
      // Everything else (school_name, year_level, enrolled_subjects, etc.) → extra
      const consumed = new Set([
        "id", "email", "full_name", "display_name",
        "onboarding_completed", "onboarding_completed_at",
        "created_date", "updated_date", "app_id", "is_service",
        "collaborator_role", "_app_role", "disabled", "is_verified",
        "force_password_reset",
      ]);
      const extra = {};
      for (const [k, v] of Object.entries(b)) {
        if (!consumed.has(k) && v !== undefined && v !== null) extra[k] = v;
      }
      if (Object.keys(extra).length > 0) known.extra = extra;
      return known;
    },
  },

  // ─── Leaderboard → leaderboards ────────────────────────────────────────────
  // 41 distinct real users with aggregate study time + XP. Run AFTER User so
  // the user_profiles row exists for the FK / RLS to be coherent (though the
  // service role bypasses RLS, so order isn't strictly required).
  {
    base44: "Leaderboard",
    supabase: "leaderboards",
    naturalKey: "user_email",
    // user_email is the unique key in Supabase. Dedupe by it.
    dedupeKey: (b) => (b.user_email ?? b.created_by)?.toLowerCase(),
    // Keep the row with the highest total_xp (our "best" version of the user)
    pickBest: (a, b) => ((b.total_xp ?? 0) > (a.total_xp ?? 0) ? b : a),
    transform: (b) => {
      const email = (b.user_email ?? b.created_by)?.toLowerCase();
      if (!email) return null;
      const known = {
        created_by: email,
        user_email: email,
        user_name: b.user_name ?? null,
        username: b.username ?? null,
        total_xp: b.total_xp ?? 0,
        season_xp: b.season_xp ?? 0,
        level: b.level ?? 1,
        streak_days: b.streak_days ?? 0,
        total_study_time: b.total_study_time ?? 0,
        total_sessions: b.total_sessions ?? 0,
        is_anonymous: b.is_anonymous ?? false,
        last_updated: b.last_updated ?? new Date().toISOString(),
        created_date: b.created_date ?? new Date().toISOString(),
      };
      const consumed = new Set([
        "id", "user_email", "user_name", "username",
        "total_xp", "season_xp", "level", "streak_days",
        "total_study_time", "total_sessions", "is_anonymous", "last_updated",
        "created_by", "created_by_id", "created_date", "updated_date", "is_sample",
      ]);
      const extra = {};
      for (const [k, v] of Object.entries(b)) {
        if (!consumed.has(k) && v !== undefined && v !== null) extra[k] = v;
      }
      known.extra = extra;  // always set — column is NOT NULL
      return known;
    },
  },
];

// ─── Migration runner ──────────────────────────────────────────────────────
async function migrateEntity({ base44: entityName, supabase: tableName, naturalKey, transform, dedupeKey, pickBest }) {
  console.log(`\n━━━ ${entityName} → ${tableName} ${"━".repeat(40 - entityName.length - tableName.length)}`);
  console.log(`Reading from Base44…`);
  let rows;
  try {
    rows = await fetchAllBase44Rows(entityName);
  } catch (err) {
    console.error(`❌ Failed to read from Base44: ${err.message}`);
    return { ok: false, count: 0 };
  }
  console.log(`  ${rows.length} rows fetched.`);

  if (USER_FILTER) {
    rows = rows.filter((r) => r.created_by === USER_FILTER);
    console.log(`  Filtered to user "${USER_FILTER}": ${rows.length} rows.`);
  }
  if (rows.length === 0) {
    console.log(`  Nothing to migrate.`);
    return { ok: true, count: 0 };
  }

  // ─── Dedupe at SOURCE (on raw Base44 rows) so we keep the "best" version
  // per natural key before transforming. Defensive — Base44 has duplicates.
  if (dedupeKey) {
    const best = new Map();
    for (const r of rows) {
      const k = dedupeKey(r);
      if (!k) continue;
      const cur = best.get(k);
      best.set(k, cur ? pickBest(cur, r) : r);
    }
    const before = rows.length;
    rows = Array.from(best.values());
    if (before !== rows.length) {
      console.log(`  Deduped ${before} → ${rows.length} rows by ${naturalKey}.`);
    }
  }

  // Transform (transform may return null to skip the row)
  const transformed = [];
  const errors = [];
  for (const r of rows) {
    try {
      const out = transform(r);
      if (out !== null && out !== undefined) transformed.push(out);
    } catch (err) {
      errors.push({ row: r, error: err.message });
    }
  }
  if (errors.length) {
    console.warn(`  ⚠️ ${errors.length} rows failed to transform — skipping. First error:`, errors[0].error);
  }
  console.log(`  ${transformed.length} rows ready to write.`);

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would insert/upsert ${transformed.length} rows into ${tableName}.`);
    console.log(`  [DRY RUN] Sample row:`, JSON.stringify(transformed[0], null, 2));
    return { ok: true, count: transformed.length };
  }

  // Real write — upsert if natural key present, else insert (assume idempotent
  // by per-user delete in the future).
  let result;
  if (naturalKey) {
    result = await supabaseAdmin.from(tableName).upsert(transformed, { onConflict: naturalKey });
  } else {
    result = await supabaseAdmin.from(tableName).insert(transformed);
  }
  if (result.error) {
    console.error(`❌ Supabase write failed:`, result.error.message);
    return { ok: false, count: 0 };
  }
  console.log(`  ✅ Wrote ${transformed.length} rows to ${tableName}.`);
  return { ok: true, count: transformed.length };
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n━━━ Base44 → Supabase migration ━━━`);
  console.log(`  Mode:      ${DRY_RUN ? "DRY RUN (no writes)" : "REAL RUN (writes to Supabase)"}`);
  console.log(`  Filter:    entity=${ENTITY_FILTER ?? "all"}, user=${USER_FILTER ?? "all"}`);
  console.log(`  Base44:    ${process.env.VITE_BASE44_APP_BASE_URL}`);
  console.log(`  Supabase:  ${process.env.VITE_SUPABASE_URL}`);

  const target = ENTITY_FILTER
    ? MIGRATIONS.filter((m) => m.supabase === ENTITY_FILTER)
    : MIGRATIONS;
  if (target.length === 0) {
    console.error(`\n❌ No migrations matched filter --entity=${ENTITY_FILTER}.`);
    console.error(`   Available: ${MIGRATIONS.map((m) => m.supabase).join(", ")}`);
    process.exit(1);
  }

  let totalOk = 0;
  let totalFail = 0;
  for (const m of target) {
    const r = await migrateEntity(m);
    if (r.ok) totalOk += r.count;
    else totalFail += 1;
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`  Entities processed: ${target.length}`);
  console.log(`  Rows written:       ${totalOk} ${DRY_RUN ? "(would-be)" : ""}`);
  console.log(`  Failed entities:    ${totalFail}`);
  if (DRY_RUN) console.log(`  ⚠️ This was a dry run — no data written. Re-run without --dry-run to apply.`);
  process.exit(totalFail > 0 ? 1 : 0);
})();
