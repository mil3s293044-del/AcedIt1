// ════════════════════════════════════════════════════════════════════════════
// Verify that the pre-signup onboarding wizard's answers landed in Supabase
// for recent signups. Read-only.
//
// USAGE:
//
//   # Print the 5 most recent signups with their onboarding fields + subjects.
//   node scripts/verifyOnboardingSaved.mjs
//
//   # Show last N signups.
//   node scripts/verifyOnboardingSaved.mjs --limit=10
//
//   # Focus on one user by email.
//   node scripts/verifyOnboardingSaved.mjs --email=miles@example.com
//
// REQUIRED ENV VARS (in .env.local):
//   • VITE_SUPABASE_URL
//   • SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════════════════
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

// ─── Args ────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const m = a.match(/^--([^=]+)(?:=(.*))?$/);
        return m ? [m[1], m[2] ?? true] : [a, true];
    })
);
const limit = Number.isFinite(parseInt(args.limit, 10)) ? parseInt(args.limit, 10) : 5;
const email = typeof args.email === 'string' ? args.email : null;

// ─── Pretty printers ─────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
    green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', gray: '\x1b[90m',
};
const ok    = (s) => `${C.green}✓${C.reset} ${s}`;
const miss  = (s) => `${C.red}✗${C.reset} ${s}`;
const warn  = (s) => `${C.yellow}!${C.reset} ${s}`;
const label = (s) => `${C.dim}${s}${C.reset}`;

function fmtVal(v) {
    if (v === null || v === undefined) return `${C.gray}(null)${C.reset}`;
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    const heading = email
        ? `Verifying onboarding for ${C.bold}${email}${C.reset}`
        : `Verifying onboarding for the last ${C.bold}${limit}${C.reset} signups`;
    console.log(`\n${heading}\n${'─'.repeat(72)}`);

    let q = supabase
        .from('user_profiles')
        .select('id, created_by, created_date, full_name, goal_atar, goal_course_name, goal_university, extra, onboarding_tasks')
        .order('created_date', { ascending: false });

    if (email) {
        q = q.eq('created_by', email).limit(1);
    } else {
        q = q.limit(limit);
    }

    const { data: profiles, error: pErr } = await q;
    if (pErr) {
        console.error('user_profiles query failed:', pErr);
        process.exit(1);
    }
    if (!profiles || profiles.length === 0) {
        console.log(miss(email ? 'No profile found for that email.' : 'No profiles at all.'));
        return;
    }

    for (const p of profiles) {
        console.log(`\n${C.bold}${C.cyan}${p.created_by}${C.reset}  ${label('(created ' + new Date(p.created_date).toLocaleString() + ')')}`);
        console.log(`  ${label('id')}            ${p.id}`);
        console.log(`  ${label('full_name')}     ${fmtVal(p.full_name)}`);

        // Onboarding-driven fields
        const yearLevel = p.extra?.year_level ?? null;
        printField('year_level (extra)', yearLevel);
        printField('goal_atar',          p.goal_atar);
        printField('goal_course_name',   p.goal_course_name);
        printField('goal_university',    p.goal_university);

        // onboarding_tasks flags
        const tasks = p.onboarding_tasks || {};
        const subjectsSelected = !!tasks.subjects_selected;
        const goalsSet         = !!tasks.goals_set;
        console.log(`  ${label('onboarding_tasks.subjects_selected')}  ${subjectsSelected ? ok('true') : miss('false')}`);
        console.log(`  ${label('onboarding_tasks.goals_set')}         ${goalsSet ? ok('true') : warn('false (optional)')}`);

        // user_subjects rows
        const { data: subs, error: sErr } = await supabase
            .from('user_subjects')
            .select('id, subject_name, subject_code, year_level, vce_subject_id, is_active, created_date')
            .eq('created_by', p.created_by)
            .order('created_date', { ascending: true });
        if (sErr) {
            console.log(`  ${miss('user_subjects query failed: ' + sErr.message)}`);
        } else if (!subs || subs.length === 0) {
            console.log(`  ${miss('user_subjects: 0 rows')}`);
        } else {
            console.log(`  ${label('user_subjects')}  ${ok(subs.length + ' rows')}`);
            for (const s of subs) {
                const customTag = s.vce_subject_id ? '' : ` ${C.yellow}(no vce_subject_id)${C.reset}`;
                console.log(`    • ${s.subject_name} ${C.gray}[${s.subject_code}]${C.reset}  yr=${fmtVal(s.year_level)}${customTag}`);
            }
        }

        // Private vce_subjects rows created by this user (custom subjects)
        const { data: customVce, error: vErr } = await supabase
            .from('vce_subjects')
            .select('id, name, code, is_private, created_date')
            .eq('created_by', p.created_by)
            .eq('is_private', true)
            .order('created_date', { ascending: true });
        if (!vErr && customVce && customVce.length > 0) {
            console.log(`  ${label('custom vce_subjects')}  ${ok(customVce.length + ' private rows')}`);
            for (const v of customVce) {
                console.log(`    • ${v.name} ${C.gray}[${v.code}]${C.reset}`);
            }
        }

        // Verdict
        const everythingMissing = !yearLevel && !p.goal_atar && !p.goal_course_name && !p.goal_university
            && !subjectsSelected && (!subs || subs.length === 0);
        if (everythingMissing) {
            console.log(`  ${miss('VERDICT: onboarding answers do NOT appear to have been applied')}`);
        } else {
            console.log(`  ${ok('VERDICT: onboarding answers landed')}`);
        }
    }

    console.log(`\n${'─'.repeat(72)}\nDone.\n`);
}

function printField(name, value) {
    const padded = name.padEnd(18);
    if (value === null || value === undefined || value === '') {
        console.log(`  ${label(padded)} ${miss('(empty)')}`);
    } else {
        console.log(`  ${label(padded)} ${ok(fmtVal(value))}`);
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
