// ════════════════════════════════════════════════════════════════════════════
// Tier access — single source of truth for what each subscription tier can do.
//
// Free tier:
//   • AI quiz generation     → 3 lifetime
//   • AI flashcard generation → 3 lifetime
//   • All other AI features   → BLOCKED (premium-only)
//
// Premium tier ($5/week):
//   • AI quizzes              → 5/day
//   • AI flashcards           → 5/day
//   • AI tools (combined)     → 15/day across all 10 tools
//   • AI test marker          → 3/day
//   • Goal/roadmap AI         → 3/day
//   • Blurting / active recall / spaced repetition / advanced analytics → unlimited
//   • Weekly cost ceiling     → 250 cents ($2.50) backstop (token-based estimate)
//                                resets every Monday UTC
//
// Usage on the frontend:
//   import { isPremium, canUseFeature, FEATURES } from '@/lib/tierAccess';
//   const access = canUseFeature(profile, FEATURES.AI_TOOL);
//   if (!access.allowed) {
//     toast({ title: 'Premium feature', description: access.reason });
//     navigate('/Pricing');
//     return;
//   }
//
// The server enforces the same rules independently — the frontend gate is for
// UX, the server gate is the security boundary. Don't trust the frontend alone.
// ════════════════════════════════════════════════════════════════════════════

export const FEATURES = {
  QUIZ_AI_GEN:      'quiz_ai_gen',       // free: 3 lifetime, premium: 3/day
  FLASHCARD_AI_GEN: 'flashcard_ai_gen',  // free: 3 lifetime, premium: 3/day
  AI_TOOL:          'ai_tool',           // any of the 10 AI tools (free: blocked, premium: 6/day combined)
  AI_TEST_MARKER:   'ai_test_marker',    // free: blocked, premium: 1/day (expensive call)
  GOAL_AI_GEN:      'goal_ai_gen',       // free: blocked, premium: 1/day (shares 'goal' bucket)
  ROADMAP_AI_GEN:   'roadmap_ai_gen',    // free: blocked, premium: 1/day (shares 'goal' bucket)
  BLURTING:         'blurting',          // free: blocked, premium: 5/day (uses AI for marking)
  ACTIVE_RECALL:    'active_recall',     // free: blocked, premium: 8/day
  SPACED_REP:       'spaced_repetition', // free: blocked, premium: unlimited (no AI cost)
  ADVANCED_ANALYTICS: 'advanced_analytics', // free: blocked, premium: unlimited (no AI cost)
};

// ─── Limits config ─────────────────────────────────────────────────────────
export const FREE_LIFETIME_CAPS = {
  [FEATURES.QUIZ_AI_GEN]:      3,
  [FEATURES.FLASHCARD_AI_GEN]: 3,
};

// Daily caps sized to land typical heavy-user spend around $1-2/week, with the
// $2.50 weekly $-ceiling as the backstop for outliers.
export const PREMIUM_DAILY_CAPS = {
  [FEATURES.QUIZ_AI_GEN]:      3,
  [FEATURES.FLASHCARD_AI_GEN]: 3,
  [FEATURES.AI_TOOL]:          6,
  [FEATURES.AI_TEST_MARKER]:   1,
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
  [FEATURES.FLASHCARD_AI_GEN]: 'flashcards',
  [FEATURES.AI_TOOL]:          'tools',
  [FEATURES.AI_TEST_MARKER]:   'marker',
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
function checkFreeTier(profile, feature) {
  const cap = FREE_LIFETIME_CAPS[feature];
  if (cap === undefined) {
    return {
      allowed: false,
      reason: 'This feature is for Premium subscribers. Upgrade to unlock all AI tools.',
      upgradeRequired: true,
    };
  }
  const usedKey = feature === FEATURES.QUIZ_AI_GEN
    ? 'free_ai_quizzes_used'
    : 'free_ai_flashcards_used';
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
