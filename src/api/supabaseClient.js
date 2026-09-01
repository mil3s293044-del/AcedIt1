// ════════════════════════════════════════════════════════════════════════════
// Supabase client — Phase 3 dual-run adapter for AcedIt.
//
// Exposes the same surface as the Base44 SDK so existing call sites
// (`base44.entities.UserProfile.filter({ created_by })`, `base44.auth.me()`,
// etc.) work unchanged once the dispatch shim flips to this client.
//
// This module is ESM. It is consumed by entitiesShim.cjs / functionsShim.cjs
// (CJS files needed for Vite's named-import-via-Proxy interop) via dynamic
// import + a top-level promise that resolves before first use.
// ════════════════════════════════════════════════════════════════════════════

import { createClient, processLock } from '@supabase/supabase-js';
import { apiUrl } from '@/lib/apiBase';
import { createReadCache } from './readCache.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing — Supabase calls will fail.');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    // Use process-local lock instead of navigator.locks — Safari's Web Locks
    // API can hang signInWithOAuth indefinitely. processLock works everywhere.
    lock: processLock,
  },
});

// ─── Entity name → Postgres table name ──────────────────────────────────────
// Snake_case, plural where it reads naturally. Matches the schema migration.
const TABLES = {
  UserProfile:        'user_profiles',
  Goal:               'goals',
  StudySession:       'study_sessions',
  Flashcard:          'flashcards',
  Quiz:               'quizzes',
  QuizAttempt:        'quiz_attempts',
  StudyTechnique:     'study_techniques',
  StudyGuide:         'study_guides',
  StudyRoadmap:       'study_roadmaps',
  StudyStreak:        'study_streaks',
  StudyPlan:          'study_plans',
  MindMap:            'mind_maps',
  Leaderboard:        'leaderboards',
  StudyGroup:         'study_groups',
  Friendship:         'friendships',
  SchoolProfile:      'school_profiles',
  GoalChallenge:      'goal_challenges',
  GoalCompetition:    'goal_competitions',
  ScoreWager:         'score_wagers',
  SeasonRecord:       'season_records',
  AISavedResult:      'ai_saved_results',
  SharedFlashcard:    'shared_flashcards',
  SharedQuiz:         'shared_quizzes',
  SharedAIResult:     'shared_ai_results',
  GroupMessage:       'group_messages',
  GroupSharedResource:'group_shared_resources',
  PastPaperAttempt:   'past_paper_attempts',
  VCESubject:         'vce_subjects',
  UserSubject:        'user_subjects',
  SubjectAssessment:  'subject_assessments',
  UniversityCourse:   'university_courses',
  DailyTimetable:     'daily_timetables',
  XPEvent:            'xp_events',
  IPCallLog:          'ip_call_logs',
  BlockedIPs:         'blocked_ips',
  SupportTicket:      'support_tickets',
  AIRateLimit:        'ai_rate_limits',
  // Added in Phase 3b after grep showed they're imported via @/entities/all
  ActiveRecallSession:'active_recall_sessions',
  BlurtingSession:    'blurting_sessions',
  GroupFlashcardDeck: 'group_flashcard_decks',
  PastPaper:          'past_papers',
};

// Parse a Base44-style sort spec ("created_date" | "-created_date") into
// PostgREST's order params.
function applySort(query, sort) {
  if (!sort) return query;
  const desc = sort.startsWith('-');
  const column = desc ? sort.slice(1) : sort;
  return query.order(column, { ascending: !desc });
}

function applyWhere(query, where) {
  if (!where || typeof where !== 'object') return query;
  for (const [key, value] of Object.entries(where)) {
    // Skip undefined/empty/literal-undefined-string values — these cause
    // PostgREST to return 400 ("expected value after operator") on URLs like
    // `?key=eq.` or `?key=eq.undefined`. Base44 silently ignored them; do the
    // same so half-initialized component state doesn't crash queries.
    if (value === undefined || value === null || value === '' || value === 'undefined') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      query = query.in(key, value);
    } else if (value === null) {
      query = query.is(key, null);
    } else if (typeof value === 'object') {
      // Mongo-style comparison operators (Base44 used these for date ranges,
      // e.g. `date: { $gte: start, $lte: end }`). Without translation they'd
      // serialise to `?date=eq.[object Object]` and match nothing — the
      // "analytics not synced" bug. Map each to its PostgREST equivalent.
      const OP = { $gte: 'gte', $lte: 'lte', $gt: 'gt', $lt: 'lt', $ne: 'neq', $eq: 'eq' };
      for (const [op, opVal] of Object.entries(value)) {
        if (opVal === undefined || opVal === null || opVal === '' || opVal === 'undefined') continue;
        const pgOp = OP[op];
        if (pgOp) query = query[pgOp](key, opVal);
      }
    } else {
      query = query.eq(key, value);
    }
  }
  return query;
}

// ─── Read cache ─────────────────────────────────────────────────────────────
// Shared by every entity. See readCache.js for what it does and does not
// promise. Exported so the dev tools and tests can inspect and clear it.
export const readCache = createReadCache();

// A read is identified by everything that changes its answer. Object key order
// varies between call sites that pass the same filter, so the keys are sorted
// before stringifying or two identical queries would miss each other.
function cacheKey(op, where, sort, limit) {
  const norm = (v) => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce((o, k) => { o[k] = norm(v[k]); return o; }, {});
    }
    return v;
  };
  return JSON.stringify([op, norm(where ?? null), sort ?? null, limit ?? null]);
}

// PostgREST caps a response at 1000 rows and says nothing about it — the row
// count just stops. Every unbounded `.filter({...})` in the app (110 of them)
// has been silently truncating for any student past that many flashcards or
// xp_events. So reads PAGE: 1000 at a time until the server runs out or we hit
// the ceiling below.
const PAGE_SIZE = 1000;

// The ceiling is a guard against a runaway query, not a row budget, and it
// warns when it bites instead of quietly handing back a prefix — the exact
// failure the ATAR window queries hit, where an unordered `.limit(n)` on
// xp_events cost heavy users breadth, effort and mastery at once.
const ROW_CEILING = 20000;

async function fetchPaged(table, { where, sort, limit, columns = '*' }) {
  const cap = limit && limit > 0 ? limit : ROW_CEILING;
  const out = [];
  for (let from = 0; from < cap; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, cap) - 1;
    let q = supabase.from(table).select(columns);
    q = applyWhere(q, where);
    q = applySort(q, sort);
    // Ties in the sort column would let a row appear on two pages and another
    // on none. id is unique, so it makes the order total.
    if (sort) q = q.order('id', { ascending: true });
    const { data, error } = await q.range(from, to);
    if (error) throw error;
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < to - from + 1) return out;   // server ran out
  }
  if (!limit && out.length >= ROW_CEILING) {
    console.warn(
      `[supabaseClient] '${table}' hit the ${ROW_CEILING}-row ceiling and was truncated. ` +
      `This read needs a narrower filter or an explicit limit — what came back is a prefix, not the whole set.`,
      { where, sort },
    );
  }
  return out;
}

// ─── Memoised session email ─────────────────────────────────────────────────
// Every create() and bulkCreate() stamped created_by, and each one paid an
// auth round trip to learn an email that cannot change without a sign-in.
// Held until the auth state actually changes.
let _emailMemo = null;

async function currentUserEmail() {
  if (_emailMemo) return _emailMemo;
  // Prefer getSession() (fast, cached) over getUser() (network round-trip that
  // can fail during token-refresh races or when the tab has been backgrounded).
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.email) { _emailMemo = session.user.email; return _emailMemo; }
  // Fallback: validate against the Auth server (handles edge cases where the
  // cached session is stale).
  try {
    const { data: { user } } = await supabase.auth.getUser();
    _emailMemo = user?.email ?? null;
    return _emailMemo;
  } catch { return null; }
}

// Sign-in, sign-out and user-update all mean the memo and every cached read
// belong to someone else now. TOKEN_REFRESHED is deliberately not in the list:
// it fires on a timer and would flush the cache for nobody's benefit.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') return;
  _emailMemo = null;
  resetMeMemo();
  readCache.clear();
});

function makeEntity(entityName) {
  const table = TABLES[entityName];
  if (!table) {
    // Unknown entity — return a stub that throws on access so we surface gaps loudly.
    return new Proxy({}, {
      get: (_, prop) => () => {
        throw new Error(`[supabaseClient] Unknown entity '${entityName}' — missing TABLES mapping. Called .${String(prop)}().`);
      },
    });
  }

  const ops = {
    async filter(where = {}, sort = '-created_date', limit) {
      // The cached value is shared between every caller of this key, and call
      // sites sort and splice what they get back. They get their own array;
      // the rows inside are shared, same as two components reading the same
      // row from a store.
      const rows = await readCache.read(
        table,
        cacheKey('filter', where, sort, limit),
        () => fetchPaged(table, { where, sort, limit }),
      );
      return rows.slice();
    },

    async list(sort = '-created_date', limit) {
      return ops.filter({}, sort, limit);
    },

    async get(id) {
      return readCache.read(table, cacheKey('get', { id }), async () => {
        const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
        if (error) throw error;
        return data;
      });
    },

    async create(payload) {
      const email = await currentUserEmail();
      const row = email ? { created_by: email, ...payload } : { ...payload };
      const { data, error } = await supabase.from(table).insert(row).select().single();
      if (error) throw error;
      readCache.invalidate(table);
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) throw error;
      readCache.invalidate(table);
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      readCache.invalidate(table);
      return { id };
    },

    /**
     * One payload applied to many rows in a single round trip.
     *
     * The audit screen exists to let somebody clear a pile of two hundred
     * cards in one gesture, and looping .update() would be two hundred
     * requests for one button press. Chunked because a PostgREST `in` list
     * goes into the URL and a few thousand uuids will exceed what the server
     * accepts.
     */
    async bulkUpdate(ids, payload) {
      const list = [...new Set((ids || []).filter(Boolean))];
      if (list.length === 0) return [];
      const CHUNK = 200;
      const out = [];
      for (let i = 0; i < list.length; i += CHUNK) {
        const { data, error } = await supabase
          .from(table).update(payload).in('id', list.slice(i, i + CHUNK)).select();
        if (error) throw error;
        out.push(...(data ?? []));
      }
      readCache.invalidate(table);
      return out;
    },

    async bulkCreate(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return [];
      const email = await currentUserEmail();
      const stamped = email ? rows.map(r => ({ created_by: email, ...r })) : rows;
      const { data, error } = await supabase.from(table).insert(stamped).select();
      if (error) throw error;
      readCache.invalidate(table);
      return data ?? [];
    },

    // ─── Real-time subscribe stub ───────────────────────────────────────
    // Base44 returns an unsubscribe function from subscribe(). We don't have
    // Supabase Realtime wired yet, so return a no-op unsubscribe — components
    // using subscribe()/unsubscribe() won't crash; they just won't get live
    // updates. Adding real Supabase Realtime is a separate phase.
    subscribe(_callback) {
      return () => {};
    },
  };

  return ops;
}

// ─── Auth surface — matches base44.auth.* shape used in the codebase ────────

// 46 call sites ask who the user is, most of them from a mount effect, and
// they all resolve to one row that cannot change without an auth event. The
// promise itself is memoised, so a burst on first paint is one resolution
// rather than 46 racing through the session lock. Cleared by the auth-state
// listener above, alongside the email memo and the read cache.
let _mePromise = null;

function resetMeMemo() { _mePromise = null; }

const authApi = {
  async me() {
    if (!_mePromise) {
      _mePromise = authApi._loadMe().catch((err) => { _mePromise = null; throw err; });
    }
    return _mePromise;
  },

  async _loadMe() {
    // Prefer getSession() (reads the session already restored from storage,
    // no network round trip) over getUser() alone — called this early, right
    // after a fresh page load, the client can still be mid-restore and
    // getUser() throws AuthSessionMissingError. Same race already fixed in
    // currentUserEmail() above; this one matters more, because nearly every
    // page's mount effect calls auth.me() first and silently swallows a
    // throw here (`.catch(() => {})`) — so this one function failing
    // intermittently on load looked like a dozen unrelated features being
    // broken (AI tool chat history not loading among them), when it was
    // really always this.
    const { data: { session } } = await supabase.auth.getSession();
    let user = session?.user ?? null;
    if (!user) {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      user = data.user;
    }
    if (!user) throw new Error('Not authenticated');
    return {
      id: user.id,
      email: user.email,
      full_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        '',
      // Surface raw user for components that need it
      _raw: user,
    };
  },

  async redirectToLogin(redirectPath) {
    const redirectTo = redirectPath
      ? `${window.location.origin}${redirectPath}`
      : window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
  },

  // Legacy name used by base44 compat / some components
  async loginWithRedirect(redirectPath) {
    return authApi.redirectToLogin(redirectPath);
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async updateMe(patch) {
    const { data, error } = await supabase.auth.updateUser({ data: patch });
    if (error) throw error;
    resetMeMemo();
    return data.user;
  },
};

// ─── Functions surface — Base44 server functions called via .invoke(name) ───
// PORTED_FUNCTIONS maps Base44 function name → local URL (proxied through
// Vite's `/local-ai` rule to server.mjs on :3001). When a name is in the map
// we hit our endpoint with a JWT-authenticated POST. Anything not in the map
// falls through to the real Base44 client so the app keeps working during
// the gradual port.
//
// Adding a function here:
//   1. Implement the endpoint in server.mjs (or an Edge Function)
//   2. Add the entry below
//   3. Test with the dual-run flag on
const PORTED_FUNCTIONS = {
  // Already-ported functions (these endpoints existed before Phase 3b-4):
  extractDocumentText: '/local-ai/extractDocumentText',
  invokeAI:            '/local-ai/invokeAI',
  // Phase 3b-4 ports:
  updateStreak:        '/local-ai/fn/updateStreak',
  awardXP:             '/local-ai/fn/awardXP',
  awardXPIncremental:  '/local-ai/fn/awardXPIncremental',
  awardGoalXP:         '/local-ai/fn/awardGoalXP',
  // Goal AI cluster (Phase 3b-5):
  updateGoalProgress:    '/local-ai/fn/updateGoalProgress',
  generateGoalWithAI:    '/local-ai/fn/generateGoalWithAI',
  // Competitions + wagers (Phase 3b-6):
  createGoalCompetition:    '/local-ai/fn/createGoalCompetition',
  joinGoalCompetition:      '/local-ai/fn/joinGoalCompetition',
  updateCompetitionProgress:'/local-ai/fn/updateCompetitionProgress',
  settleHoursCompetition:   '/local-ai/fn/settleHoursCompetition',
  resolveScoreWager:        '/local-ai/fn/resolveScoreWager',
  // PvP over/under bets — escrow + settlement live server-side:
  placeProgressBet:         '/local-ai/fn/placeProgressBet',
  submitPredictionResult:   '/local-ai/fn/submitPredictionResult',
  // The Arena — study duels + back-yourself bets:
  createDuel:               '/local-ai/fn/createDuel',
  // Call-outs — prove you learned it, not just that you clocked hours.
  createCallout:            '/local-ai/fn/createCallout',
  getCallouts:              '/local-ai/fn/getCallouts',
  startCallout:             '/local-ai/fn/startCallout',
  submitCallout:            '/local-ai/fn/submitCallout',
  verifyMe:                 '/local-ai/fn/verifyMe',
  respondDuel:              '/local-ai/fn/respondDuel',
  placeDuelSideBet:         '/local-ai/fn/placeDuelSideBet',
  createStudyBet:           '/local-ai/fn/createStudyBet',
  createStudyQuest:         '/local-ai/fn/createStudyQuest',
  mindMapGaps:              '/local-ai/fn/mindMapGaps',
  getArenaState:            '/local-ai/fn/getArenaState',
  getMyStakes:              '/local-ai/fn/getMyStakes',
  // AcedIt ATAR + standardised ranked boards:
  getRankedBoards:          '/local-ai/fn/getRankedBoards',
  // Support (Phase 3b-7):
  sendSupportTicket:        '/local-ai/fn/sendSupportTicket',
  // Marketing — public top-of-funnel email capture (no auth required):
  captureLead:              '/local-ai/fn/captureLead',
  // Stripe (Phase 3b-8):
  stripeCheckout:           '/local-ai/fn/stripeCheckout',
  stripePortal:             '/local-ai/fn/stripePortal',
  verifySubscription:       '/local-ai/fn/verifySubscription',
  // stripe-webhook is NOT here — it's called by Stripe, not the frontend.
  // stripeCheckout:   '/local-ai/fn/stripeCheckout',  // 3b-4c
  // ...
};

// Functions that only read. Everything else writes rows we cannot see from
// here — awardXP alone touches xp_events, user_profiles and leaderboards — so
// anything not on this list flushes the whole read cache when it returns.
// Getting a name wrong in the safe direction costs one refetch; getting it
// wrong the other way shows a student a stale XP total right after they earned
// it, so a function whose behaviour you are unsure of does NOT go here.
const READ_ONLY_FUNCTIONS = new Set([
  'getRankedBoards', 'getArenaState', 'getMyStakes', 'getCallouts',
  'extractDocumentText', 'invokeAI', 'mindMapGaps',
]);

const functionsApi = {
  async invoke(name, payload) {
    try {
      return await functionsApi._invoke(name, payload);
    } finally {
      // After, not before: a read that fires while the function is running
      // would otherwise cache the pre-write state and outlive the flush. In
      // `finally` because a function that throws may still have written.
      if (!READ_ONLY_FUNCTIONS.has(name)) readCache.clear();
    }
  },

  async _invoke(name, payload) {
    const url = PORTED_FUNCTIONS[name];
    if (url) {
      // Attach the user's Supabase JWT so server.mjs can identify them.
      // Endpoints that need to bypass RLS use the service_role key on the
      // server side; the JWT here is just for `who is calling`.
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(apiUrl(url), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload ?? {}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Function '${name}' failed (${res.status}): ${text}`);
      }
      // Match Base44's SDK envelope so call sites that destructure `{ data }`
      // keep working (`base44.functions.invoke(...)` returns `{ data, error }`).
      const body = await res.json();
      return { data: body, error: null };
    }
    // Fallback — function not yet ported. Hit Base44 directly, bypassing
    // our dispatch wrapper to avoid an infinite loop.
    const { realBase44 } = await import('./base44Client.js');
    return realBase44.functions.invoke(name, payload);
  },
};

// ─── Build entities object lazily so unused entities don't cost anything ────
const entitiesCache = {};
const entities = new Proxy({}, {
  get: (_, name) => {
    if (typeof name !== 'string') return undefined;
    if (!entitiesCache[name]) entitiesCache[name] = makeEntity(name);
    return entitiesCache[name];
  },
});

export const supabase44 = {
  entities,
  auth: authApi,
  functions: functionsApi,
  // service-role calls only happen server-side; expose the entities surface as
  // a no-op stub here so any accidental client-side use throws clearly.
  asServiceRole: {
    entities: new Proxy({}, {
      get: () => new Proxy({}, {
        get: () => () => {
          throw new Error('[supabaseClient] asServiceRole is server-only. Use the service-role key in server.mjs / Edge Functions.');
        },
      }),
    }),
  },
};
