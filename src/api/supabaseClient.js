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
    if (value === undefined || value === '' || value === 'undefined') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      query = query.in(key, value);
    } else if (value === null) {
      query = query.is(key, null);
    } else {
      query = query.eq(key, value);
    }
  }
  return query;
}

async function currentUserEmail() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? null;
}

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
      let q = supabase.from(table).select('*');
      q = applyWhere(q, where);
      q = applySort(q, sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },

    async list(sort = '-created_date', limit) {
      return ops.filter({}, sort, limit);
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const email = await currentUserEmail();
      const row = email ? { created_by: email, ...payload } : { ...payload };
      const { data, error } = await supabase.from(table).insert(row).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return { id };
    },

    async bulkCreate(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return [];
      const email = await currentUserEmail();
      const stamped = email ? rows.map(r => ({ created_by: email, ...r })) : rows;
      const { data, error } = await supabase.from(table).insert(stamped).select();
      if (error) throw error;
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
const authApi = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
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
  // Support (Phase 3b-7):
  sendSupportTicket:        '/local-ai/fn/sendSupportTicket',
  // Stripe (Phase 3b-8):
  stripeCheckout:           '/local-ai/fn/stripeCheckout',
  stripePortal:             '/local-ai/fn/stripePortal',
  verifySubscription:       '/local-ai/fn/verifySubscription',
  // stripe-webhook is NOT here — it's called by Stripe, not the frontend.
  // stripeCheckout:   '/local-ai/fn/stripeCheckout',  // 3b-4c
  // ...
};

const functionsApi = {
  async invoke(name, payload) {
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
      const res = await fetch(url, {
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
