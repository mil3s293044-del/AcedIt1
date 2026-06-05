// ════════════════════════════════════════════════════════════════════════════
// Tier access — single source of truth for what each subscription tier can do.
//
// Free tier:
//   • AI quiz generation     → 5 lifetime
//   • AI flashcard generation → 5 lifetime
//   • AI study tools (combined) → 5 lifetime
//   • Lifetime cost ceiling  → 100 cents ($1) hard backstop
//   • All other AI features   → BLOCKED (premium-only)
//
// Premium tier ($5/week):
//   • AI quiz generation      → 3/day (creating a new quiz from notes)
//   • AI quiz marking         → 10/day (grading played quizzes — Miles, your call)
//   • AI flashcards           → 3/day
//   • AI tools (combined)     → 6/day across all 10 tools
//   • Goal/Roadmap AI         → 1/day (shared bucket)
//   • Blurting                → 5/day
//   • Active recall           → 8/day
//   • Spaced repetition / advanced analytics → unlimited
//   • Weekly cost ceiling     → 250 cents ($2.50) backstop (token-based estimate)
//                                resets every Monday UTC
//
// Usage on the frontend:
//   import { isPremium, canUseFeature, FEATURES } from '@/lib/tierAccess';
//   const access = canUseFeature(profile, FEATURES.AI_TOOL);
//   if (!access.allowed) {
//     toast({ title: 'Premium feature', description: access.reason });
//     navigate('/Subscription');
//     return;
//   }
//
// The server enforces the same rules independently — the frontend gate is for
// UX, the server gate is the security boundary. Don't trust the frontend alone.
// ════════════════════════════════════════════════════════════════════════════

export const FEATURES = {
  QUIZ_AI_GEN:      'quiz_ai_gen',       // free: 3 lifetime, premium: 3/day (create quiz from notes)
  QUIZ_AI_MARK:     'quiz_ai_mark',      // free: blocked, premium: 10/day (mark a played quiz)
  FLASHCARD_AI_GEN: 'flashcard_ai_gen',  // free: 3 lifetime, premium: 3/day
  AI_TOOL:          'ai_tool',           // one-shot AI tools (free: 5 lifetime, premium: 6/day combined)
  AI_CHAT:          'ai_chat',           // conversational tools (Math Tutor, Teaching Assistant) — premium: 8 msgs/day, free: shares the tools lifetime cap
  GOAL_AI_GEN:      'goal_ai_gen',       // free: blocked, premium: 1/day (shares 'goal' bucket)
  ROADMAP_AI_GEN:   'roadmap_ai_gen',    // free: blocked, premium: 1/day (shares 'goal' bucket)
  BLURTING:         'blurting',          // free: blocked, premium: 5/day (uses AI for marking)
  ACTIVE_RECALL:    'active_recall',     // free: blocked, premium: 8/day
  SPACED_REP:       'spaced_repetition', // free: blocked, premium: unlimited (no AI cost)
  ADVANCED_ANALYTICS: 'advanced_analytics', // free: blocked, premium: unlimited (no AI cost)
};

// ─── Limits config ─────────────────────────────────────────────────────────
export const FREE_LIFETIME_CAPS = {
  [FEATURES.QUIZ_AI_GEN]:      5,
  [FEATURES.QUIZ_AI_MARK]:     5,  // AI marking of played quizzes, lifetime
  [FEATURES.FLASHCARD_AI_GEN]: 5,
  [FEATURES.AI_TOOL]:          5,  // combined across the AI study tools
  [FEATURES.AI_CHAT]:          5,  // free chat shares the tools lifetime counter below
};

// Hard cost ceiling for free users (lifetime, in cents). Even if their count
// caps aren't hit, once they've spent this much compute they're blocked.
// Backstops the case where a user uploads massive files that drive cost-per-
// call above the typical ~5-10c.
export const FREE_LIFETIME_COST_CAP_CENTS = 100;

// Daily caps sized to land typical heavy-user spend around $1-2/week, with the
// $2.50 weekly $-ceiling as the backstop for outliers.
export const PREMIUM_DAILY_CAPS = {
  [FEATURES.QUIZ_AI_GEN]:      3,
  [FEATURES.QUIZ_AI_MARK]:     10,
  [FEATURES.FLASHCARD_AI_GEN]: 3,
  [FEATURES.AI_TOOL]:          6,
  [FEATURES.AI_CHAT]:          8,
  [FEATURES.GOAL_AI_GEN]:      1,
  [FEATURES.ROADMAP_AI_GEN]:   1,
  [FEATURES.BLURTING]:         5,
  [FEATURES.ACTIVE_RECALL]:    8,
};

export const WEEKLY_COST_CAP_CENTS  = 250;     // $2.50 hard ceiling
export const WEEKLY_COST_WARN_CENTS = 200;     // $2.00 soft notice

// Maps each feature to the daily-counter bucket it deducts from.
// (Quizzes and flashcards have their own buckets; the 10 tools share `tools`;
// goal_ai_gen and roadmap_ai_gen share `goal`.)
const COUNTER_KEY = {
  [FEATURES.QUIZ_AI_GEN]:      'quizzes',
  [FEATURES.QUIZ_AI_MARK]:     'quiz_marks',
  [FEATURES.FLASHCARD_AI_GEN]: 'flashcards',
  [FEATURES.AI_TOOL]:          'tools',
  [FEATURES.AI_CHAT]:          'chat',
  [FEATURES.GOAL_AI_GEN]:      'goal',
  [FEATURES.ROADMAP_AI_GEN]:   'goal',
  [FEATURES.BLURTING]:         'blurting',
  [FEATURES.ACTIVE_RECALL]:    'active_recall',
};

// ─── Tier check ────────────────────────────────────────────────────────────
export function isPremium(profile) {
  if (!profile) return false;
  if (profile.subscription_tier === 'premium') return true;
  if (profile.subscription_active === true) return true;
  // Trial: if trial_ends_at is in the future, treat as premium.
  if (profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date()) return true;
  return false;
}

// ─── Free tier limits ──────────────────────────────────────────────────────
// Maps each capped free feature to the counter field on user_profiles.
const FREE_COUNTER_KEY = {
  [FEATURES.QUIZ_AI_GEN]:      'free_ai_quizzes_used',
  [FEATURES.QUIZ_AI_MARK]:     'free_ai_quiz_marks_used',
  [FEATURES.FLASHCARD_AI_GEN]: 'free_ai_flashcards_used',
  [FEATURES.AI_TOOL]:          'free_ai_tools_used',
  [FEATURES.AI_CHAT]:          'free_ai_tools_used', // free chat shares the tools lifetime counter
};

function checkFreeTier(profile, feature) {
  // Hard lifetime cost ceiling — first stop.
  const lifetimeCost = profile?.lifetime_ai_cost_cents ?? 0;
  if (lifetimeCost >= FREE_LIFETIME_COST_CAP_CENTS) {
    return {
      allowed: false,
      reason: 'You\'ve reached your free AI usage limit. Upgrade to Premium for daily access.',
      upgradeRequired: true,
      lifetimeCostHit: true,
    };
  }

  const cap = FREE_LIFETIME_CAPS[feature];
  if (cap === undefined) {
    return {
      allowed: false,
      reason: 'This feature is for Premium subscribers. Upgrade to unlock all AI tools.',
      upgradeRequired: true,
    };
  }

  const usedKey = FREE_COUNTER_KEY[feature];
  const used = profile?.[usedKey] ?? 0;
  const remaining = Math.max(0, cap - used);
  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `You've used all ${cap} of your free AI generations. Upgrade to Premium for daily access.`,
      upgradeRequired: true,
      cap,
      used,
      remaining: 0,
    };
  }
  return { allowed: true, remaining, cap, used };
}

// ─── Premium tier limits ───────────────────────────────────────────────────
function checkPremiumTier(profile, feature) {
  // Weekly cost ceiling (hard backstop).
  const cost = profile?.weekly_ai_cost_cents ?? 0;
  if (cost >= WEEKLY_COST_CAP_CENTS) {
    return {
      allowed: false,
      reason: 'You\'ve hit your weekly AI usage limit. Resets Monday.',
      weeklyCostHit: true,
    };
  }

  const dailyCap = PREMIUM_DAILY_CAPS[feature];
  if (dailyCap === undefined) {
    // Feature has no daily cap (blurting, active recall, etc.) — always allowed for premium.
    return { allowed: true };
  }

  const counters = profile?.daily_ai_counters ?? {};
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const counterDate = counters.date;
  // If the date stamp is stale, treat usage as zero for today (server resets on next call).
  const used = counterDate === today ? (counters[COUNTER_KEY[feature]] ?? 0) : 0;
  const remaining = Math.max(0, dailyCap - used);

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Daily limit reached (${dailyCap}/day). Resets at midnight.`,
      dailyCapHit: true,
      cap: dailyCap,
      used,
      remaining: 0,
    };
  }

  // Soft warn near weekly cap.
  const warning = cost >= WEEKLY_COST_WARN_CENTS
    ? `You're approaching your weekly AI limit ($${(cost / 100).toFixed(2)} of $${(WEEKLY_COST_CAP_CENTS / 100).toFixed(2)}).`
    : null;

  return { allowed: true, remaining, cap: dailyCap, used, warning };
}

// Dev-only bypass — VITE_TIER_BYPASS=true disables all caps so you can test
// the AI tools freely. Server-side has its own check on the same env var.
const TIER_BYPASS = import.meta.env.VITE_TIER_BYPASS === "true";

// ─── Public entry point ────────────────────────────────────────────────────
export function canUseFeature(profile, feature) {
  if (TIER_BYPASS) return { allowed: true };
  if (isPremium(profile)) return checkPremiumTier(profile, feature);
  return checkFreeTier(profile, feature);
}

// Convenience: get a friendly counter string for UI display.
//   "3 of 5 today" / "1 of 3 lifetime" / "Unlimited"
export function formatRemaining(profile, feature) {
  const access = canUseFeature(profile, feature);
  if (access.cap === undefined) return 'Unlimited';
  const period = isPremium(profile) ? 'today' : 'lifetime';
  return `${access.used ?? 0} of ${access.cap} ${period}`;
}

// Fetch the current user's profile fresh from Supabase and run the gate.
// Use this from handlers that don't already have `userProfile` in scope —
// it adds ~200ms but avoids prop-drilling. Caller is expected to inspect
// `allowed` and bail with a toast.
//
//   const access = await checkLiveTier(FEATURES.GOAL_AI_GEN);
//   if (!access.allowed) { toast({ ... }); return; }
export async function checkLiveTier(feature) {
  if (TIER_BYPASS) return { allowed: true };
  try {
    const { base44 } = await import('@/api/base44Client');
    const me = await base44.auth.me();
    const rows = await base44.entities.UserProfile.filter({ created_by: me.email });
    return canUseFeature(rows?.[0] ?? null, feature);
  } catch {
    // Couldn't fetch — let it proceed; the server still enforces.
    return { allowed: true };
  }
}
