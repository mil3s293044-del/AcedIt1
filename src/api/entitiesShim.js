// ════════════════════════════════════════════════════════════════════════════
// Dual-run dispatcher for `@/entities/all` imports.
//
// Each named export below dispatches to the Base44 client OR the Supabase
// client based on runtimeConfig.shouldUseSupabase().
//
// IMPORTANT: This MUST use explicit named exports (not a Proxy as the module
// itself), because Vite's in-source ESM bundling does static binding checks
// (`Importing binding name 'X' is not found`). The Base44 plugin's compat
// shim survives the same pattern only because it lives in node_modules where
// esbuild prebundles CJS→ESM with wildcard re-exports.
//
// To add an entity: append a `export const X = makeEntity('X');` line below.
// ════════════════════════════════════════════════════════════════════════════

import { shouldUseSupabase } from './runtimeConfig.js';

let _base44 = null;
let _supabase = null;

async function getBase44() {
  if (!_base44) _base44 = (await import('./base44Client.js')).base44;
  return _base44;
}

async function getSupabase() {
  if (!_supabase) _supabase = (await import('./supabaseClient.js')).supabase44;
  return _supabase;
}

async function pickClient() {
  return shouldUseSupabase() ? await getSupabase() : await getBase44();
}

// User entity has special-case auth methods (Base44 maps these from auth.*).
function makeUserEntity() {
  return new Proxy({}, {
    get: (_t, prop) => {
      if (typeof prop !== 'string') return undefined;
      return async (...args) => {
        const c = await pickClient();
        if (prop === 'me')                    return c.auth.me(...args);
        if (prop === 'loginWithRedirect' ||
            prop === 'login')                 return (c.auth.loginWithRedirect || c.auth.redirectToLogin)(...args);
        if (prop === 'logout')                return c.auth.logout(...args);
        if (prop === 'updateMyUserData')      return c.auth.updateMe(...args);
        const fn = c.entities?.User?.[prop];
        if (typeof fn === 'function') return fn(...args);
        throw new Error(`[entitiesShim] User entity has no method '${prop}'.`);
      };
    },
  });
}

function makeEntity(entityName) {
  return new Proxy({}, {
    get: (_t, prop) => {
      if (typeof prop !== 'string') return undefined;

      // subscribe MUST be sync — see comment in base44Client.js.
      if (prop === 'subscribe') {
        return (...args) => {
          if (shouldUseSupabase()) {
            return () => {};
          }
          // Base44 mode: client may not be loaded yet. If not, return no-op
          // unsub but kick off the load so future subscribes work.
          if (!_base44) {
            getBase44();
            return () => {};
          }
          const fn = _base44.entities?.[entityName]?.subscribe;
          return typeof fn === 'function' ? fn(...args) : () => {};
        };
      }

      return async (...args) => {
        const c = await pickClient();
        const fn = c.entities?.[entityName]?.[prop];
        if (typeof fn !== 'function') {
          const target = shouldUseSupabase() ? 'Supabase' : 'Base44';
          throw new Error(`[entitiesShim] Entity '${entityName}' has no method '${prop}' on ${target} client.`);
        }
        return fn(...args);
      };
    },
  });
}

// ─── Explicit named exports — every entity imported via @/entities/all ──────
export const User                = makeUserEntity();
export const UserProfile         = makeEntity('UserProfile');
export const Goal                = makeEntity('Goal');
export const StudySession        = makeEntity('StudySession');
export const Flashcard           = makeEntity('Flashcard');
export const Quiz                = makeEntity('Quiz');
export const QuizAttempt         = makeEntity('QuizAttempt');
export const StudyTechnique      = makeEntity('StudyTechnique');
export const StudyStreak         = makeEntity('StudyStreak');
export const ActiveRecallSession = makeEntity('ActiveRecallSession');
export const BlurtingSession     = makeEntity('BlurtingSession');
export const Friendship          = makeEntity('Friendship');
export const AISavedResult       = makeEntity('AISavedResult');
export const GroupMessage        = makeEntity('GroupMessage');
export const GroupSharedResource = makeEntity('GroupSharedResource');
export const GroupFlashcardDeck  = makeEntity('GroupFlashcardDeck');
export const PastPaper           = makeEntity('PastPaper');
export const PastPaperAttempt    = makeEntity('PastPaperAttempt');
export const SubjectAssessment   = makeEntity('SubjectAssessment');
export const UniversityCourse    = makeEntity('UniversityCourse');
export const UserSubject         = makeEntity('UserSubject');
export const VCESubject          = makeEntity('VCESubject');
export const GoalCompetition     = makeEntity('GoalCompetition');
export const ScoreWager          = makeEntity('ScoreWager');
export const SeasonRecord        = makeEntity('SeasonRecord');
export const Leaderboard         = makeEntity('Leaderboard');
export const SchoolProfile       = makeEntity('SchoolProfile');
export const StudyGroup          = makeEntity('StudyGroup');
export const MindMap             = makeEntity('MindMap');
export const StudyPlan           = makeEntity('StudyPlan');
export const StudyGuide          = makeEntity('StudyGuide');
export const StudyRoadmap        = makeEntity('StudyRoadmap');
export const SharedFlashcard     = makeEntity('SharedFlashcard');
export const SharedQuiz          = makeEntity('SharedQuiz');
export const SharedAIResult      = makeEntity('SharedAIResult');
export const DailyTimetable      = makeEntity('DailyTimetable');
export const XPEvent             = makeEntity('XPEvent');
export const SupportTicket       = makeEntity('SupportTicket');
