// ════════════════════════════════════════════════════════════════════════════
// featureReach — how many students have ever found each feature. Read-only.
//
// The question behind "it's great but hard to learn" is which parts of the app
// students never reach, and until now nothing could answer it: analytics.js is
// marketing pixels only, so there is no in-app usage tracking at all. There is
// however a lot of incidental evidence — every feature that writes a row
// leaves one — and this reads it.
//
// Read it as reach, not engagement: "has this student ever done this once",
// which is the right measure for a discoverability problem. A feature with 3%
// reach is either undiscoverable or unwanted, and those need opposite fixes,
// so treat a low number as a question rather than an answer.
//
// USAGE:
//
//   node scripts/featureReach.mjs               # active = studied in last 28d
//   node scripts/featureReach.mjs --days=90     # widen the activity window
//   node scripts/featureReach.mjs --all         # every signup, not just active
//   node scripts/featureReach.mjs --csv         # machine-readable
//
// REQUIRED ENV VARS (in .env.local):
//   • VITE_SUPABASE_URL
//   • SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════════════════
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
}));
const DAYS = Number(args.days) || 28;
const SINCE = new Date(Date.now() - DAYS * 86400000).toISOString();

// Page every read. An unordered .limit() returns an arbitrary prefix, which on
// a usage audit reads as "nobody uses this" — the exact wrong answer.
const PAGE = 1000;
async function all(build, cap = 100000) {
    const out = [];
    for (let from = 0; from < cap; from += PAGE) {
        const { data, error } = await build().range(from, from + PAGE - 1);
        if (error) { console.error(`  ! ${error.message}`); break; }
        if (!data?.length) break;
        out.push(...data);
        if (data.length < PAGE) break;
    }
    return out;
}
const col = (rows, key) => rows.map((r) => r[key]).filter(Boolean);

// Each feature names the evidence it leaves behind. Where a feature writes no
// row of its own it says so rather than reporting a silent zero — an
// unmeasurable feature and an unused one look identical in a table, and
// confusing them is how a working feature gets deleted.
const UNMEASURED = Symbol('no signal');

async function main() {
    console.log(`\nReading… (activity window: ${DAYS} days)\n`);

    const [profiles, xp, techniques, sessions, maps, quizzes, attempts, cards,
           goals, plans, assessments, aiResults, friends, comps, wagers, groups] =
        await Promise.all([
            all(() => db.from('user_profiles').select('created_by, created_date')),
            all(() => db.from('xp_events').select('user_email, source, created_date').gte('created_date', SINCE)),
            all(() => db.from('study_techniques').select('created_by, technique_name')),
            all(() => db.from('study_sessions').select('created_by, technique')),
            all(() => db.from('mind_maps').select('created_by, phase')),
            all(() => db.from('quizzes').select('created_by')),
            all(() => db.from('quiz_attempts').select('created_by')),
            all(() => db.from('flashcards').select('created_by, total_reviews')),
            all(() => db.from('goals').select('created_by')),
            all(() => db.from('study_plans').select('created_by')),
            all(() => db.from('subject_assessments').select('created_by')),
            all(() => db.from('ai_saved_results').select('created_by, tool_type')),
            all(() => db.from('friendships').select('created_by')),
            all(() => db.from('goal_competitions').select('created_by')),
            all(() => db.from('score_wagers').select('created_by')),
            all(() => db.from('study_groups').select('created_by')),
        ]);

    const activeUsers = new Set(col(xp, 'user_email'));
    const population = args.all
        ? new Set(col(profiles, 'created_by'))
        : activeUsers;
    const N = population.size;
    if (!N) { console.log('No users in the population — nothing to report.'); return; }

    // Restrict any evidence set to the population being reported on.
    const reach = (emails) => {
        if (emails === UNMEASURED) return UNMEASURED;
        return new Set([...new Set(emails)].filter((e) => population.has(e)));
    };
    const whereTech = (name) => col(techniques.filter((t) => t.technique_name === name), 'created_by');
    const whereTool = (tool) => col(aiResults.filter((r) => r.tool_type === tool), 'created_by');
    const whereSrc  = (...s) => col(xp.filter((e) => s.includes(e.source)), 'user_email');

    const FEATURES = [
        ['Study', 'Pomodoro',            reach([...whereTech('pomodoro'), ...whereSrc('study_session', 'focus_session')])],
        ['Study', 'Spaced repetition',   reach([...whereTech('spaced_repetition'), ...whereSrc('flashcard')])],
        ['Study', 'Active recall',       reach([...whereTech('active_recall'), ...whereSrc('active_recall')])],
        ['Study', 'Blurting',            reach([...whereTech('blurting'), ...whereSrc('blurting')])],
        ['Study', 'Revision Mode',       reach(whereSrc('mini_test'))],
        ['Study', 'Mind maps',           reach(col(maps, 'created_by'))],
        ['Study', '  └ rebuilt a map',   reach(col(maps.filter((m) => m.phase && m.phase !== 'blind'), 'created_by'))],
        ['Study', 'Made flashcards',     reach(col(cards, 'created_by'))],
        ['Study', '  └ reviewed any',    reach(col(cards.filter((c) => (c.total_reviews || 0) > 0), 'created_by'))],

        ['Test',  'Made a quiz',         reach(col(quizzes, 'created_by'))],
        ['Test',  'Sat a quiz',          reach([...col(attempts, 'created_by'), ...whereSrc('quiz')])],

        ['Plan',  'Set a goal',          reach(col(goals, 'created_by'))],
        ['Plan',  'Planned a block',     reach(col(plans, 'created_by'))],
        ['Plan',  'Added a SAC/exam',    reach(col(assessments, 'created_by'))],
        ['Plan',  'Strategise',          UNMEASURED],

        ['AI',    'Any AI tool',         reach(col(aiResults, 'created_by'))],
        ...['concept_explainer', 'math_tutor', 'english_mentor', 'essay_planner',
            'exam_questions', 'teaching_assistant', 'note_summariser', 'line_memoriser']
            .map((t) => ['AI', `  └ ${t}`, reach(whereTool(t))]),

        ['Social', 'Added a friend',     reach(col(friends, 'created_by'))],
        ['Social', 'Competition',        reach(col(comps, 'created_by'))],
        ['Social', 'Wager',              reach(col(wagers, 'created_by'))],
        ['Social', 'Study group',        reach(col(groups, 'created_by'))],

        ['Other', 'Guides',              UNMEASURED],
        ['Other', 'Timer page',          UNMEASURED],
    ];

    if (args.csv) {
        console.log('section,feature,users,population,pct');
        for (const [s, name, r] of FEATURES) {
            console.log(`${s},"${name.trim()}",${r === UNMEASURED ? '' : r.size},${N},${r === UNMEASURED ? '' : ((r.size / N) * 100).toFixed(1)}`);
        }
        return;
    }

    const label = args.all ? 'all signups' : `active in last ${DAYS}d`;
    console.log(`Population: ${N} students (${label})`);
    console.log(`${profiles.length} signups total, ${activeUsers.size} active in the window\n`);

    let section = '';
    for (const [s, name, r] of FEATURES) {
        if (s !== section) { console.log(`\n  ${s.toUpperCase()}`); section = s; }
        if (r === UNMEASURED) {
            console.log(`    ${name.padEnd(22)}  ${'—'.padStart(5)}   (writes no row — can't be measured this way)`);
            continue;
        }
        const pct = (r.size / N) * 100;
        const bar = '█'.repeat(Math.round(pct / 5)).padEnd(20, '·');
        console.log(`    ${name.padEnd(22)}  ${String(r.size).padStart(3)}/${N}  ${bar} ${pct.toFixed(0)}%`);
    }

    console.log(`
  Reach = has ever done it at least once, among the population above.
  Low reach is a question, not a verdict: undiscoverable and unwanted look
  identical here and need opposite fixes. Check the ones you believe in.
`);
}

main().catch((e) => { console.error(e); process.exit(1); });
