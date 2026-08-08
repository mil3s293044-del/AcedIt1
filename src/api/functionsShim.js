// ════════════════════════════════════════════════════════════════════════════
// Dual-run dispatcher for `@/functions/<name>` imports.
//
// Each `import { foo } from '@/functions/foo'` statement gets redirected here
// by vite.config.js. We export every function name as a callable that picks
// the active client (Base44 or Supabase) and calls `client.functions.invoke`.
//
// Same ESM-with-explicit-exports requirement as entitiesShim.js — see that
// file's header for the why.
//
// To add a function: append `export const fnName = makeFn('fnName');` below.
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

function makeFn(name) {
  return async (...args) => {
    const c = await pickClient();
    return c.functions.invoke(name, ...args);
  };
}

// ─── Explicit named exports — every function imported via @/functions/X ─────
export const awardXP                   = makeFn('awardXP');
export const awardXPIncremental        = makeFn('awardXPIncremental');
export const awardGoalXP               = makeFn('awardGoalXP');
export const updateStreak              = makeFn('updateStreak');
export const generateGoalWithAI        = makeFn('generateGoalWithAI');
export const updateGoalProgress        = makeFn('updateGoalProgress');
export const createGoalCompetition     = makeFn('createGoalCompetition');
export const joinGoalCompetition       = makeFn('joinGoalCompetition');
export const updateCompetitionProgress = makeFn('updateCompetitionProgress');
export const settleHoursCompetition    = makeFn('settleHoursCompetition');
export const resolveScoreWager         = makeFn('resolveScoreWager');
export const stripeCheckout            = makeFn('stripeCheckout');
export const stripePortal              = makeFn('stripePortal');
export const verifySubscription        = makeFn('verifySubscription');
export const sendSupportTicket         = makeFn('sendSupportTicket');
export const extractDocumentText       = makeFn('extractDocumentText');
export const fetchVCAAPaper            = makeFn('fetchVCAAPaper');
export const renderPdfPages            = makeFn('renderPdfPages');
export const resetAllCredits           = makeFn('resetAllCredits');
export const migrateStudyHoursToXP     = makeFn('migrateStudyHoursToXP');
export const banAbusiveAccounts        = makeFn('banAbusiveAccounts');
export const invokeAI                  = makeFn('invokeAI');

// ─── Call-outs — prove you learned it, not just that you clocked hours ──────
export const createCallout             = makeFn('createCallout');
export const getCallouts               = makeFn('getCallouts');
export const startCallout              = makeFn('startCallout');
export const submitCallout             = makeFn('submitCallout');
export const verifyMe                  = makeFn('verifyMe');
