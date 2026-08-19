import { canAfford, stackOf, stackWarning, priceOf, WEEKLY_CHIPS } from './chips.js';

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
//   • ONE WEEKLY STACK of 1,000 chips, spent on whatever they like.
//     A quiz from notes is 30, a flashcard deck 25, an AI tool 15, an Ace
//     message 2. Saver runs the cheap model and makes the stack go 3x further.
//   • Spaced repetition / advanced analytics → unlimited (no AI cost)
//   • Weekly dollar ceiling → kept as a hard backstop behind the chips,
//     resets every Monday UTC
//
// The chips replaced eleven per-feature daily caps that were sized
// independently of that dollar ceiling and, priced against the real cost
// table, permitted 4.5x what it allowed. See src/lib/chips.js for the whole
// argument and the price list.
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
  QUIZ_AI_GEN:      'quiz_ai_gen',       // free: 5 lifetime, premium: 30 chips
  QUIZ_AI_MARK:     'quiz_ai_mark',      // free: 5 lifetime, premium: 10 chips
  FLASHCARD_AI_GEN: 'flashcard_ai_gen',  // free: 5 lifetime, premium: 25 chips
  AI_TOOL:          'ai_tool',           // one-shot AI tools (free: 5 lifetime, premium: 15 chips)
  AI_CHAT:          'ai_chat',           // conversational tools (Math Tutor, Teaching Assistant) — 8 chips a message; free shares the tools lifetime cap
  GOAL_AI_GEN:      'goal_ai_gen',       // free: blocked, premium: 15 chips
  ROADMAP_AI_GEN:   'roadmap_ai_gen',    // free: blocked, premium: 15 chips
  BLURTING:         'blurting',          // free: blocked, premium: 8 chips
  ACTIVE_RECALL:    'active_recall',     // free: blocked, premium: 8 chips
  SPACED_REP:       'spaced_repetition', // free: blocked, premium: unlimited (no AI cost)
  ADVANCED_ANALYTICS: 'advanced_analytics', // free: blocked, premium: unlimited (no AI cost)
  STUDY_COACH:      'study_coach',       // Ace companion — premium-only, 2 chips a message (Haiku, the cheap tier)
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

/**
 * RETIRED AS A GATE. Kept only so nothing importing it breaks mid-refactor.
 *
 * These were sized independently of the weekly dollar ceiling they were meant
 * to protect, and priced against the real cost table they permitted 4.5x what
 * it allowed. Premium is gated by the chip stack now — one pool, published
 * prices, spend it however you like. See src/lib/chips.js.
 *
 * @deprecated use priceOf()/canAfford() from chips.js
 */
export const PREMIUM_DAILY_CAPS = {};

// ─── Weekly spend ceiling, mirrored from the server ────────────────────────
// The server is the real boundary (TIER_WEEKLY_CAP_MICROS in server.mjs); these
// exist so the UI can draw a bar and warn early. They MUST track the server, or
// the meter tells students they have headroom the server has already refused —
// which is exactly what happened when the ceiling moved from $2.50 to $1.95 and
// this mirror was left behind.
//
// Micro-dollars, matching the server, because whole cents were too coarse to
// hold a sub-cent call and silently recorded zero. See src/lib/aiCost.js.
export const WEEKLY_COST_CAP_MICROS  = 1_950_000;   // $1.95 USD ≈ $3.00 AUD
export const WEEKLY_COST_WARN_MICROS = 1_365_000;   // 70% — early enough to still act on

/** Spend so far, in micro-dollars, tolerating a profile written before 0030. */
export function weeklySpendMicros(profile) {
    const micros = profile?.weekly_ai_cost_micros ?? 0;
    return micros > 0 ? micros : (profile?.weekly_ai_cost_cents ?? 0) * 10_000;
}

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
  [FEATURES.STUDY_COACH]:      'coach',
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
//
// ONE POOL. This used to check a per-feature daily counter and, separately, a
// weekly dollar ceiling — two limits sized independently, where the counters
// permitted 4.5x what the dollars allowed. The counters stopped a light user
// after three flashcard decks on a seventh of their budget, and let a heavy
// one walk into the money wall on day two while still claiming they had
// quizzes left. Chips replace them: one stack, published prices, spend it on
// whatever you like. See src/lib/chips.js.
//
// This mirror MUST track server.mjs. When it drifted before, students were
// shown headroom the server had already refused.
function checkPremiumTier(profile, feature) {
  // The money backstop stays first, same as the server. Chip prices are
  // rounded up so a full stack costs less than this, but if a price is ever
  // set wrong the dollars still stop.
  const cost = weeklySpendMicros(profile);
  if (cost >= WEEKLY_COST_CAP_MICROS) {
    return {
      allowed: false,
      reason: 'You\'ve hit your weekly AI usage limit. Resets Monday.',
      weeklyCostHit: true,
    };
  }

  const tier = profile?.ai_model_preference === 'saver' ? 'saver' : 'standard';
  const verdict = canAfford(profile, feature, tier);
  const stack = stackOf(profile);

  if (!verdict.ok) {
    return {
      allowed: false,
      // A refusal that names the way through, when there is one.
      reason: verdict.saverWouldWork
        ? `Not enough chips for this (${verdict.price} needed, ${verdict.remaining} left). Saver would make it ${verdict.saverPrice}.`
        : stack.empty
          ? 'That\'s this week\'s stack. It refills Monday.'
          : `Not enough chips left for this (${verdict.price} needed, ${verdict.remaining} left). Refills Monday.`,
      chipsHit: true,
      price: verdict.price,
      remaining: verdict.remaining,
      saverWouldWork: verdict.saverWouldWork,
      saverPrice: verdict.saverPrice,
    };
  }

  const warn = stackWarning(profile, tier);
  return {
    allowed: true,
    price: verdict.price,
    remaining: verdict.remaining,
    total: WEEKLY_CHIPS,
    warning: warn ? `${warn.title}. ${warn.body}` : null,
  };
}

// Dev-only bypass — VITE_TIER_BYPASS=true disables all caps so you can test
// the AI tools freely. Server-side has its own check on the same env var.
const TIER_BYPASS = import.meta.env.VITE_TIER_BYPASS === "true";

// Owner/allowlisted accounts get unlimited AI access (demos, content recording,
// support). Comma-separated emails; defaults to the owner account. Override with
// VITE_UNLIMITED_ACCESS_EMAILS. The server enforces the same allowlist.
const UNLIMITED_EMAILS = (import.meta.env.VITE_UNLIMITED_ACCESS_EMAILS || 'mil3s293044@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export function isUnlimitedAccount(profile) {
  const email = (profile?.created_by || '').toLowerCase();
  return !!email && UNLIMITED_EMAILS.includes(email);
}

// ─── Public entry point ────────────────────────────────────────────────────
export function canUseFeature(profile, feature) {
  if (TIER_BYPASS || isUnlimitedAccount(profile)) return { allowed: true };
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
