import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import heicConvert from "heic-convert";
import mammoth from "mammoth";
import JSZip from "jszip";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { Resend } from "resend";

// dotenv looks for .env by default; explicitly load .env.local too.
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: true });

const PORT = Number(process.env.LOCAL_AI_PORT || 3001);
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "[local-ai] ANTHROPIC_API_KEY is not set. Add it to .env.local and restart.",
  );
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Supabase admin client + JWT auth helper ───────────────────────────────
// Used by ported server functions (updateStreak, awardXP, etc.) to verify
// the caller's JWT and bypass RLS for trusted writes (e.g. setting another
// user's leaderboard row, writing audit logs).
//
// Both env vars are loaded from .env.local. SUPABASE_SERVICE_ROLE_KEY has
// no VITE_ prefix because it must NEVER be exposed to the browser bundle.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseEnabled = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
let supabaseAdmin = null;
if (supabaseEnabled) {
  supabaseAdmin = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log("[local-ai] Supabase admin client ready (service_role).");
} else {
  console.warn(
    "[local-ai] Supabase env vars missing — ported server functions will reject all calls.",
  );
}

// ─── Stripe client ─────────────────────────────────────────────────────────
// Used by stripeCheckout / stripePortal / verifySubscription / stripe-webhook.
// Without STRIPE_SECRET_KEY set, those endpoints return 500.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
let stripe = null;
if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
  console.log("[local-ai] Stripe client ready.");
} else {
  console.warn("[local-ai] STRIPE_SECRET_KEY not set — Stripe endpoints will reject calls.");
}

// ─── Resend client (transactional email) ───────────────────────────────────
// Sender domain `acedit.au` is DNS-verified in Resend. Without RESEND_API_KEY
// set, support tickets still save to DB but no admin/user emails are sent.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@acedit.com.au";
const SUPPORT_FROM = "AcedIt Support <support@acedit.au>";
let resend = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  console.log("[local-ai] Resend client ready.");
} else {
  console.warn(
    "[local-ai] RESEND_API_KEY not set — support emails will be skipped (tickets still save to DB).",
  );
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Verifies the bearer JWT in `Authorization: Bearer <token>` and returns the
// authenticated Supabase user, or null. The supabase-js admin call hits
// auth.getUser() which validates signature + expiry against the project's
// JWT secret.
async function authenticateRequest(req) {
  if (!supabaseAdmin) return null;
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

// Helpers for ported functions to call other local endpoints (e.g. awardXP
// from updateGoalProgress / completeGoalChallenge, or invokeAI from the
// goal-AI generators). Forward the caller's auth header so JWT-protected
// endpoints see the same user.
async function callLocalFn(name, payload, authHeader) {
  const r = await fetch(`http://localhost:${PORT}/local-ai/fn/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(payload || {}),
  });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
  if (!r.ok) throw new Error(`local fn ${name} failed (${r.status}): ${data?.error || text}`);
  return data;
}

async function callInvokeAI({ prompt, response_json_schema }) {
  const r = await fetch(`http://localhost:${PORT}/local-ai/invokeAI`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, response_json_schema }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`invokeAI failed (${r.status}): ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

// ─── Tier enforcement (server-side mirror of src/lib/tierAccess.js) ────────
// Frontend gate is UX; THIS is the security boundary that protects API spend.
//
// Free tier:
//   • quiz_ai_gen / flashcard_ai_gen → 3 lifetime each.
//   • Everything else → blocked.
//
// Premium tier ($5/week):
//   • Per-feature daily caps sized so typical heavy use lands ~$1-2/wk in
//     estimated Anthropic spend. Spaced-repetition and advanced-analytics
//     have no daily cap because they don't make AI calls.
//   • Weekly hard ceiling at 250 cents ($2.50) is the backstop for outliers.
//     Resets every Monday UTC.
//
// If a request arrives WITHOUT a Supabase JWT (legacy Base44 path), we allow
// it but log a warning — phase 3d ships all users onto Supabase auth.
const TIER_FREE_CAPS    = { quiz_ai_gen: 5, flashcard_ai_gen: 5, ai_tool: 5 };
const TIER_FREE_COUNTER = { quiz_ai_gen: "free_ai_quizzes_used", flashcard_ai_gen: "free_ai_flashcards_used", ai_tool: "free_ai_tools_used" };
const TIER_PREMIUM_CAPS = { quiz_ai_gen: 3, quiz_ai_mark: 10, flashcard_ai_gen: 3, ai_tool: 6, goal_ai_gen: 1, roadmap_ai_gen: 1, blurting: 5, active_recall: 8 };
const TIER_COUNTER_KEY  = { quiz_ai_gen: "quizzes", quiz_ai_mark: "quiz_marks", flashcard_ai_gen: "flashcards", ai_tool: "tools", goal_ai_gen: "goal", roadmap_ai_gen: "goal", blurting: "blurting", active_recall: "active_recall" };
const TIER_WEEKLY_CAP_CENTS = 250;
const TIER_FREE_LIFETIME_COST_CAP_CENTS = 100;   // $1 hard ceiling per free user, lifetime

// Returns YYYY-MM-DD for the Monday of the current ISO week, in UTC.
function currentWeekStartUTC() {
  const d = new Date();
  const day = d.getUTCDay();           // Sun=0..Sat=6
  const offset = (day + 6) % 7;        // Mon=0, Sun=6
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

// ─── Weekly Leagues (Duolingo-style) ───────────────────────────────────────
// 6 tiers, groups of 30, top 5 promote / bottom 5 demote each week.
// Lazy rollover — no cron required: every awardXP triggers a check.
const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
const LEAGUE_GROUP_SIZE = 30;
const LEAGUE_PROMOTE_COUNT = 5;
const LEAGUE_DEMOTE_COUNT  = 5;

function nextTier(t) { const i = LEAGUE_TIERS.indexOf(t); return LEAGUE_TIERS[Math.min(i + 1, LEAGUE_TIERS.length - 1)]; }
function prevTier(t) { const i = LEAGUE_TIERS.indexOf(t); return LEAGUE_TIERS[Math.max(i - 1, 0)]; }

// Settle a stale membership (week_start < current). Sorts the user's group
// by weekly_xp, marks promoted/demoted, and updates user_profiles.tier.
// Idempotent — if final_position is already set, no-ops.
async function settleStaleMembership(membership, currentTierOfUser) {
  if (!supabaseAdmin) return currentTierOfUser;
  if (membership.final_position) return currentTierOfUser; // already settled

  // Pull all members of this group, sort by weekly_xp DESC.
  const { data: groupMembers } = await supabaseAdmin
    .from('league_memberships')
    .select('id, user_email, weekly_xp')
    .eq('league_group_id', membership.league_group_id)
    .order('weekly_xp', { ascending: false });

  if (!groupMembers?.length) return currentTierOfUser;

  // Find my position in this group.
  const myIdx = groupMembers.findIndex(m => m.user_email === membership.user_email);
  if (myIdx < 0) return currentTierOfUser;

  const finalPosition = myIdx + 1;
  const promoted = finalPosition <= LEAGUE_PROMOTE_COUNT;
  const demoted  = finalPosition > (groupMembers.length - LEAGUE_DEMOTE_COUNT);

  // Compute the resulting tier the user starts the new week in.
  let newTier = membership.tier;
  if (promoted) newTier = nextTier(membership.tier);
  else if (demoted) newTier = prevTier(membership.tier);

  // Persist outcome on the stale membership row.
  await supabaseAdmin
    .from('league_memberships')
    .update({ final_position: finalPosition, promoted, demoted })
    .eq('id', membership.id);

  // Bump lifetime counters on user_profiles.
  const profileUpdate = { current_league_tier: newTier };
  // The lifetime promote/demote counters get incremented via an RPC pattern
  // (or we just re-read + write). We'll do the lighter-weight read+write here.
  const { data: profRow } = await supabaseAdmin
    .from('user_profiles')
    .select('id, league_lifetime_promotes, league_lifetime_demotes')
    .eq('created_by', membership.user_email)
    .maybeSingle();
  if (profRow) {
    if (promoted) profileUpdate.league_lifetime_promotes = (profRow.league_lifetime_promotes ?? 0) + 1;
    if (demoted)  profileUpdate.league_lifetime_demotes  = (profRow.league_lifetime_demotes ?? 0) + 1;
    await supabaseAdmin.from('user_profiles').update(profileUpdate).eq('id', profRow.id);
  }

  return newTier;
}

// Find an open league_group for (tier, weekStart) or create a new one.
async function findOrCreateOpenGroup(tier, weekStart) {
  if (!supabaseAdmin) return null;
  const { data: open } = await supabaseAdmin
    .from('league_groups')
    .select('id, member_count')
    .eq('tier', tier)
    .eq('week_start', weekStart)
    .eq('is_full', false)
    .order('created_at', { ascending: true })
    .limit(1);
  if (open?.[0]) return open[0];

  const { data: created } = await supabaseAdmin
    .from('league_groups')
    .insert({ tier, week_start: weekStart, member_count: 0, is_full: false })
    .select('id, member_count')
    .single();
  return created || null;
}

// Place user in the current week's league. Handles lazy settlement of
// previous week if stale. Returns the user's current membership row
// (with group + position info) or null on failure.
async function ensureCurrentLeagueMembership(userEmail, userProfile) {
  if (!supabaseAdmin || !userEmail) return null;
  const weekStart = currentWeekStartUTC();

  // 1. Does a current-week membership already exist? Return it.
  const { data: current } = await supabaseAdmin
    .from('league_memberships')
    .select('*')
    .eq('user_email', userEmail)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (current) return current;

  // 2. Find any stale memberships and settle them. Most-recent first.
  const { data: stale } = await supabaseAdmin
    .from('league_memberships')
    .select('*')
    .eq('user_email', userEmail)
    .lt('week_start', weekStart)
    .order('week_start', { ascending: false })
    .limit(1);

  let nextStartTier = userProfile?.current_league_tier || 'bronze';
  if (stale?.[0]) {
    nextStartTier = await settleStaleMembership(stale[0], nextStartTier);
  }

  // 3. Place into an open group at `nextStartTier`.
  const group = await findOrCreateOpenGroup(nextStartTier, weekStart);
  if (!group) return null;

  const isAnon = !!userProfile?.league_anonymous_default;
  const { data: newMem } = await supabaseAdmin
    .from('league_memberships')
    .insert({
      user_email:      userEmail,
      league_group_id: group.id,
      week_start:      weekStart,
      tier:            nextStartTier,
      weekly_xp:       0,
      is_anonymous:    isAnon,
    })
    .select('*')
    .single();

  // Bump group member_count + close if full.
  const newCount = (group.member_count ?? 0) + 1;
  await supabaseAdmin
    .from('league_groups')
    .update({ member_count: newCount, is_full: newCount >= LEAGUE_GROUP_SIZE })
    .eq('id', group.id);

  // Mirror tier + group on user_profiles for fast reads.
  await supabaseAdmin
    .from('user_profiles')
    .update({ current_league_tier: nextStartTier, current_league_group_id: group.id })
    .eq('created_by', userEmail);

  return newMem || null;
}

// Add XP delta to the user's current-week membership. Best-effort, lazily
// initialises the membership if it doesn't exist yet.
async function addLeagueXP(userEmail, userProfile, deltaXp) {
  if (!supabaseAdmin || !userEmail || !deltaXp || deltaXp <= 0) return;
  try {
    const mem = await ensureCurrentLeagueMembership(userEmail, userProfile);
    if (!mem) return;
    await supabaseAdmin
      .from('league_memberships')
      .update({
        weekly_xp:  (mem.weekly_xp ?? 0) + deltaXp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mem.id);
  } catch (e) {
    console.warn('[leagues] addLeagueXP failed:', e?.message || e);
  }
}

function tierIsPremium(profile) {
  if (!profile) return false;
  if (profile.subscription_tier === "premium") return true;
  if (profile.subscription_active === true) return true;
  if (profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date()) return true;
  return false;
}

async function loadUserProfile(userEmail) {
  if (!supabaseAdmin || !userEmail) return null;
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .eq("created_by", userEmail)
    .limit(1)
    .maybeSingle();
  return data || null;
}

function checkTierAccess(profile, feature) {
  // Dev-only bypass — set VITE_TIER_BYPASS=true in .env.local to disable all
  // caps for testing. The frontend has its own copy of this check so the UI
  // doesn't show "limit reached" warnings either.
  if (process.env.VITE_TIER_BYPASS === "true") return { allowed: true };
  if (!profile) return { allowed: false, status: 401, reason: "Sign in to use AI features." };
  if (tierIsPremium(profile)) {
    if ((profile.weekly_ai_cost_cents ?? 0) >= TIER_WEEKLY_CAP_CENTS) {
      return { allowed: false, status: 429, reason: "Weekly AI usage limit reached. Resets Monday." };
    }
    const cap = TIER_PREMIUM_CAPS[feature];
    if (cap === undefined) return { allowed: true };
    const counters = profile.daily_ai_counters ?? {};
    const today = new Date().toISOString().slice(0, 10);
    const used = counters.date === today ? (counters[TIER_COUNTER_KEY[feature]] ?? 0) : 0;
    if (used >= cap) {
      return { allowed: false, status: 429, reason: `Daily limit reached (${cap}/day). Resets at midnight.` };
    }
    return { allowed: true };
  }
  // Free-tier lifetime cost ceiling — first check, $1 hard backstop.
  if ((profile.lifetime_ai_cost_cents ?? 0) >= TIER_FREE_LIFETIME_COST_CAP_CENTS) {
    return { allowed: false, status: 402, reason: "You've reached your free AI usage limit. Upgrade to Premium for daily access." };
  }
  const cap = TIER_FREE_CAPS[feature];
  if (cap === undefined) {
    return { allowed: false, status: 402, reason: "This is a Premium feature — upgrade to unlock." };
  }
  const usedKey = TIER_FREE_COUNTER[feature];
  const used = profile[usedKey] ?? 0;
  if (used >= cap) {
    return { allowed: false, status: 402, reason: `You've used all ${cap} free generations. Upgrade for daily access.` };
  }
  return { allowed: true };
}

function estimateCostCents(usage) {
  if (!usage) return 0;
  // Sonnet 4.6 pricing per 1M tokens (USD):
  //   input $3.00, cache_read $0.30, cache_create $3.75, output $15.00
  const inT  = usage.input_tokens ?? 0;
  const cR   = usage.cache_read_input_tokens ?? 0;
  const cC   = usage.cache_creation_input_tokens ?? 0;
  const outT = usage.output_tokens ?? 0;
  const dollars =
    ((inT - cR - cC) * 3.00 + cR * 0.30 + cC * 3.75 + outT * 15.00) / 1_000_000;
  return Math.max(0, Math.round(dollars * 100));
}

async function recordTierUsage(profile, feature, usage) {
  if (!supabaseAdmin || !profile) return;
  const updates = {};
  if (tierIsPremium(profile)) {
    const today = new Date().toISOString().slice(0, 10);
    let counters = profile.daily_ai_counters ?? {};
    if (counters.date !== today) {
      counters = { date: today, quizzes: 0, flashcards: 0, tools: 0, marker: 0, goal: 0, blurting: 0, active_recall: 0 };
    }
    const counterKey = TIER_COUNTER_KEY[feature];
    if (counterKey) counters = { ...counters, [counterKey]: (counters[counterKey] ?? 0) + 1 };
    updates.daily_ai_counters = counters;

    const weekStartStr = currentWeekStartUTC();
    const prevStartStr = profile.weekly_cost_period_start
      ? new Date(profile.weekly_cost_period_start).toISOString().slice(0, 10)
      : null;
    const sameWeek = prevStartStr && prevStartStr >= weekStartStr;
    const baseCost = sameWeek ? (profile.weekly_ai_cost_cents ?? 0) : 0;
    updates.weekly_ai_cost_cents = baseCost + estimateCostCents(usage);
    updates.weekly_cost_period_start = weekStartStr;
  } else {
    // Free user — increment the matching counter AND the lifetime cost.
    const counterKey = TIER_FREE_COUNTER[feature];
    if (counterKey) updates[counterKey] = (profile[counterKey] ?? 0) + 1;
    updates.lifetime_ai_cost_cents = (profile.lifetime_ai_cost_cents ?? 0) + estimateCostCents(usage);
  }
  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from("user_profiles").update(updates).eq("id", profile.id);
  }
}

// Same prompt-injection patterns the original Base44 invokeAI used.
const THREAT_PATTERNS = [
  /ignore\s+(previous|prior|all)\s+instructions?/i,
  /forget\s+(previous|prior|all|your)\s+instructions?/i,
  /pretend\s+(you\s+have\s+no\s+rules|you\s+are\s+|to\s+be\s+)/i,
  /act\s+as\s+(dan|jailbreak|a\s+different|an?\s+unrestricted|an?\s+unfiltered)/i,
  /you\s+are\s+now\s+(dan|a\s+different\s+ai|free|unrestricted)/i,
  /do\s+anything\s+now/i,
  /jailbreak/i,
  /\bdan\b.*\bmode\b/i,
  /override\s+(your\s+)?(system|safety|security|content)\s+(prompt|instructions?|rules?|filter)/i,
  /bypass\s+(your\s+)?(safety|security|content|filter|restrict)/i,
  /disable\s+(your\s+)?(safety|security|content|filter|restrict)/i,
  /api[\s_-]?key/i,
  /system\s+prompt/i,
  /reveal\s+(your\s+)?(instructions?|prompt|rules?|config)/i,
  /show\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions?|rules?)/i,
  /print\s+(your\s+)?(system\s+)?(prompt|instructions?)/i,
];

function detectThreat(text) {
  if (!text || typeof text !== "string") return false;
  return THREAT_PATTERNS.some((p) => p.test(text));
}

// Mirror of VCE_EXPERT_SYSTEM_PROMPT from src/components/shared/vceExpertPrompt.jsx.
// When the client prompt starts with this, we hoist it to a cached system block.
const VCE_EXPERT_SYSTEM_PROMPT = `You are the "AcedIt VCE Expert," a specialized AI tutor designed exclusively for the Victorian Certificate of Education (VCE) curriculum. Your primary goal is to assist students in achieving high Study Scores by enforcing VCAA (Victorian Curriculum and Assessment Authority) standards.

CRITICAL: You must strictly apply the VCAA Glossary of Command Terms in all interactions:

- IDENTIFY/STATE: Brief name or fact only
- DESCRIBE/OUTLINE: Detailed account of features and characteristics
- EXPLAIN: Cause-and-effect links using phrases like "This leads to... because..."
- COMPARE: Identify both similarities AND differences
- EVALUATE/DISCUSS: Provide balanced argument of pros/cons with a concluding judgment
- JUSTIFY: Provide evidence to support a choice

When generating questions or marking student work, if a student provides a correct fact but misses the specific link required by the command term, you MUST explain exactly why they would lose marks in a real VCAA exam.

ENGLISH MENTOR MODE (2024-2027 VCE English Study Design):
- Section A: Focus on authorial intent and thematic analysis
- Section B: Focus on "Framework of Ideas" and mentor text links
- Section C: Focus on "What, How, Why" of persuasive techniques and tone shifts
- Always suggest high-level metalanguage (e.g., "juxtaposition," "appeals to authority," "subtext")

TONE: Professional, academic, yet encouraging. Use VCE-specific terminology like "Study Design," "AOS," "SAC prep," and "VCAA Exam Reports."

NEVER give general advice; always ensure advice is applicable to the specific requirements of the Victorian curriculum.

CRITICAL MATH FORMATTING RULES — ALWAYS FOLLOW:
- ALWAYS use LaTeX notation for every mathematical expression, equation, formula, fraction, integral, derivative, matrix, vector, or symbol.
- Use inline delimiters \\( and \\) for inline expressions — e.g. \\( f(x) = 3x - 4 \\)
- Use display delimiters \\[ and \\] for standalone/block expressions — e.g. \\[ \\int_0^1 x^2 \\, dx \\]
- NEVER write maths in plain text format. This applies to every part of your response: questions, explanations, model answers, options, marking criteria, and feedback.
- Examples of correct formatting:
  * Fractions: \\( \\frac{3}{4} \\) or \\( \\frac{x+1}{x-2} \\)
  * Exponents: \\( x^2 \\), \\( e^{2x} \\), \\( 10^3 \\)
  * Square roots: \\( \\sqrt{x} \\)
  * Integrals: \\[ \\int_0^1 x^2 \\, dx \\]
  * Derivatives: \\( \\frac{d}{dx} f(x) \\) or \\( f'(x) \\)
  * Greek letters: \\( \\theta \\), \\( \\pi \\), \\( \\delta \\), \\( \\lambda \\)
  * Vectors/matrices: \\( \\vec{v} \\), \\( \\begin{pmatrix} a \\\\ b \\end{pmatrix} \\)`;

// If the prompt is the VCE-expert prompt + "\n\n" + user content, split them
// so we can cache the long system prompt across requests (~90% cheaper after first hit).
function splitSystemAndUser(prompt) {
  if (typeof prompt !== "string") return { system: null, user: String(prompt ?? "") };
  const prefix = VCE_EXPERT_SYSTEM_PROMPT + "\n\n";
  if (prompt.startsWith(prefix)) {
    return { system: VCE_EXPERT_SYSTEM_PROMPT, user: prompt.slice(prefix.length) };
  }
  return { system: null, user: prompt };
}

// In-memory file store for uploads. Keyed by UUID, value is {buffer, mimeType, originalName}.
// Files live for the lifetime of the server process — fine for dev. For production
// we'd swap this for real storage (Supabase Storage, S3, etc.).
const fileStore = new Map();

// Cap memory: keep at most 50 files; evict oldest first.
const MAX_FILES = 50;
function storeFile(buffer, mimeType, originalName) {
  if (fileStore.size >= MAX_FILES) {
    const oldestKey = fileStore.keys().next().value;
    if (oldestKey) fileStore.delete(oldestKey);
  }
  const id = randomUUID();
  fileStore.set(id, { buffer, mimeType, originalName, uploadedAt: Date.now() });
  return id;
}

// Anthropic only accepts these image media types. HEIC (iPhone default) needs
// transcoding to JPEG before Claude will read it.
const CLAUDE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

async function convertFileForClaude(file) {
  const mt = file.mimeType || "application/octet-stream";

  // HEIC / HEIF → JPEG.
  if (mt === "image/heic" || mt === "image/heif") {
    const jpegBuffer = await heicConvert({ buffer: file.buffer, format: "JPEG", quality: 0.92 });
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: Buffer.from(jpegBuffer).toString("base64"),
      },
    };
  }

  // Native Claude-compatible images.
  if (CLAUDE_IMAGE_TYPES.has(mt)) {
    return {
      type: "image",
      source: { type: "base64", media_type: mt, data: file.buffer.toString("base64") },
    };
  }

  // PDFs — Claude reads natively.
  if (mt === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: file.buffer.toString("base64") },
    };
  }

  // DOCX → extract text via mammoth, embed as plain text. Loses formatting but
  // gives Claude the actual content to read.
  if (mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    console.log(`[local-ai] extracting DOCX text from ${file.originalName} (${file.buffer.length} bytes)`);
    const { value: text } = await mammoth.extractRawText({ buffer: file.buffer });
    console.log(`[local-ai] DOCX extracted: ${text.length} chars`);
    return {
      type: "text",
      text: `Contents of file "${file.originalName}":\n\n${text}`,
    };
  }

  // Plain text → just include directly.
  if (mt.startsWith("text/")) {
    return {
      type: "text",
      text: `Contents of file "${file.originalName}":\n\n${file.buffer.toString("utf8")}`,
    };
  }

  console.warn(`[local-ai] unsupported file type for Claude: ${mt} (${file.originalName})`);
  return null;
}

// Convert file_urls → Anthropic content blocks. Three URL shapes are supported:
//   1. local-file://<uuid>  — file we just uploaded; pulled from in-memory store
//   2. https://...pdf       — pass through as document URL source
//   3. https://...           — pass through as image URL source
async function buildFileContentBlocks(fileUrls) {
  if (!Array.isArray(fileUrls) || fileUrls.length === 0) return [];
  const blocks = await Promise.all(
    fileUrls
      .filter((u) => typeof u === "string" && u.length > 0)
      .map(async (url) => {
        // Local upload — base64-encode the cached bytes (transcoding if needed).
        if (url.startsWith("local-file://")) {
          const id = url.slice("local-file://".length);
          const file = fileStore.get(id);
          if (!file) {
            console.warn(`[local-ai] missing local file for ${url}`);
            return null;
          }
          try {
            return await convertFileForClaude(file);
          } catch (err) {
            console.error(`[local-ai] file conversion failed for ${file.originalName}:`, err);
            return null;
          }
        }

        // External URL — Claude fetches it directly.
        const lower = url.toLowerCase();
        if (lower.endsWith(".pdf")) {
          return { type: "document", source: { type: "url", url } };
        }
        return { type: "image", source: { type: "url", url } };
      }),
  );
  return blocks.filter(Boolean);
}

// Anthropic structured outputs require `additionalProperties: false` on every
// object schema. Walk the schema tree and add it where missing. Also recurse
// into properties / items / anyOf / oneOf / allOf so nested schemas comply.
function sanitizeSchemaForAnthropic(schema) {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForAnthropic);

  const out = { ...schema };
  if (out.type === "object") {
    if (!("additionalProperties" in out)) {
      out.additionalProperties = false;
    }
    if (out.properties && typeof out.properties === "object") {
      out.properties = Object.fromEntries(
        Object.entries(out.properties).map(([k, v]) => [k, sanitizeSchemaForAnthropic(v)]),
      );
    }
  }
  // Anthropic strict schema only allows minItems of 0 or 1; clamp anything
  // higher to 1 (still expresses "must have at least one"). maxItems isn't
  // supported in strict mode at all — drop it. Schemas relying on these will
  // still get coverage from the prompt instructions inside the function body.
  if (out.type === "array") {
    if (typeof out.minItems === "number" && out.minItems > 1) out.minItems = 1;
    delete out.maxItems;
  }
  if (out.items) out.items = sanitizeSchemaForAnthropic(out.items);
  if (out.anyOf) out.anyOf = out.anyOf.map(sanitizeSchemaForAnthropic);
  if (out.oneOf) out.oneOf = out.oneOf.map(sanitizeSchemaForAnthropic);
  if (out.allOf) out.allOf = out.allOf.map(sanitizeSchemaForAnthropic);
  return out;
}

const app = express();
app.use(cors());
// Stripe webhook needs the raw body to verify the signature — mount raw
// parser for that path BEFORE the json parser would consume it.
// Quietly absorb leftover Base44 SDK calls (analytics, app-public-settings,
// etc.). After DNS cutover acedit.au IS this server, so we can't proxy back —
// these calls would loop. Returning 204 No Content makes the SDK's .catch
// handlers no-op silently. File upload is intercepted client-side and routed
// to /local-ai/uploadFile, so we don't lose any actual functionality.
app.all(/^\/api\//, (req, res) => res.status(204).end());

app.use("/local-ai/fn/stripe-webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "20mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

// Mirrors Base44's Core/UploadFile integration. The Base44 SDK sends
// multipart/form-data with the file under whatever field name the caller
// chose (usually "file"). We accept any field, stash the bytes, and return
// the same response shape Base44 returns: { file_url: "..." }.
//
// The returned URL uses our `local-file://` scheme so we can recognize it
// later in InvokeLLM and serve the cached bytes inline as base64.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});
// Mirrors Base44's `extractDocumentText` server function. Quizzes calls this
// for DOCX/PPTX files (it asks Base44 to convert them to text before passing
// the text into the AI prompt). Original function fetches the file_url; we
// just look up the file from our in-memory store.
app.post("/local-ai/extractDocumentText", async (req, res) => {
  try {
    const { file_url, file_extension } = req.body || {};
    if (!file_url) return res.status(400).json({ error: "file_url is required" });
    if (!file_url.startsWith("local-file://")) {
      return res.status(400).json({ error: "Only local-file:// URLs are supported by the local server" });
    }

    const id = file_url.slice("local-file://".length);
    const file = fileStore.get(id);
    if (!file) return res.status(404).json({ error: "File not found in local store" });

    // Prefer explicit file_extension param; fall back to mime-based detection.
    const ext =
      (file_extension || "").toLowerCase() ||
      (file.mimeType?.includes("wordprocessingml") ? "docx" :
       file.mimeType?.includes("presentationml") ? "pptx" :
       file.mimeType === "text/plain" ? "txt" : "");

    let text = "";
    if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value;
    } else if (ext === "pptx") {
      const zip = await JSZip.loadAsync(file.buffer);
      const slideFiles = Object.keys(zip.files)
        .filter((name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"))
        .sort();
      const slideTexts = [];
      for (const slidePath of slideFiles) {
        const slideXml = await zip.files[slidePath].async("text");
        const matches = slideXml.match(/<a:t>([^<]+)<\/a:t>/g) || [];
        const slideText = matches.map((m) => m.replace(/<\/?a:t>/g, "")).join(" ");
        if (slideText.trim()) slideTexts.push(slideText.trim());
      }
      text = slideTexts.join("\n\n");
    } else if (ext === "txt") {
      text = file.buffer.toString("utf8");
    } else if (ext === "pdf") {
      return res.status(400).json({ error: "PDF files should be processed directly by the AI" });
    } else if (ext === "doc" || ext === "ppt") {
      return res.status(400).json({ error: `${ext.toUpperCase()} files are not supported. Convert to ${ext}x or PDF first.` });
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    console.log(`[local-ai] extracted ${text.length} chars from ${file.originalName} (${ext})`);
    return res.json({ text });
  } catch (err) {
    console.error("[local-ai] extractDocumentText error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PORTED SERVER FUNCTIONS — /local-ai/fn/*
//
// Each endpoint is a Node port of a Base44 server function. They:
//   1. Authenticate the caller via JWT (authenticateRequest helper above)
//   2. Use supabaseAdmin (service_role) to read/write Supabase tables —
//      bypassing RLS only where the original Base44 function used asServiceRole
//   3. Return the same JSON shape the Base44 versions returned
//
// Add the function name to PORTED_FUNCTIONS in src/api/supabaseClient.js so
// the dual-run shim routes calls here when the flag is on.
// ════════════════════════════════════════════════════════════════════════════

// ─── updateStreak ──────────────────────────────────────────────────────────
// Daily streak maintenance. Idempotent per calendar day (using the user's
// timezone offset, defaulting to AEST +660). Increments on consecutive days,
// resets on a missed day. Mirrors base44/functions/updateStreak/entry.ts.
function getStreakMultiplier(days) {
  if (days >= 30) return 2.0;
  if (days >= 14) return 1.5;
  if (days >= 7) return 1.25;
  if (days >= 3) return 1.1;
  return 1.0;
}
function getLocalDateStr(timezoneOffsetMinutes) {
  const localMs = Date.now() + timezoneOffsetMinutes * 60 * 1000;
  return new Date(localMs).toISOString().split("T")[0];
}
function getPreviousDateStr(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

app.post("/local-ai/fn/updateStreak", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const body = req.body || {};
    const tzOffset = typeof body.timezoneOffset === "number" ? body.timezoneOffset : 660;
    const todayStr = getLocalDateStr(tzOffset);
    const userEmail = user.email;

    // Load (or create) the profile
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("created_by", userEmail);
    if (profileErr) throw profileErr;

    let profile = profiles?.[0];
    if (!profile) {
      const { data: created, error: createErr } = await supabaseAdmin
        .from("user_profiles")
        .insert({ created_by: userEmail, user_email: userEmail, total_xp: 0, current_level: 1, streak_days: 0 })
        .select()
        .single();
      if (createErr) throw createErr;
      profile = created;
    }

    const lastStreakDate = profile.last_streak_date || null;
    const currentStreak = profile.streak_days || 0;
    const peakStreak = profile.peak_streak || 0;

    // Idempotent: if we already counted today, return current state unchanged.
    if (lastStreakDate === todayStr) {
      return res.json({
        success: true,
        streak_days: currentStreak,
        is_new_day: false,
        multiplier: getStreakMultiplier(currentStreak),
        peak_streak: peakStreak,
      });
    }

    const yesterdayStr = getPreviousDateStr(todayStr);
    const isConsecutive = lastStreakDate === yesterdayStr;
    const newStreak = isConsecutive ? currentStreak + 1 : 1;
    const newPeak = Math.max(peakStreak, newStreak);

    // Write streak update to UserProfile
    const { error: updateErr } = await supabaseAdmin
      .from("user_profiles")
      .update({ streak_days: newStreak, peak_streak: newPeak, last_streak_date: todayStr })
      .eq("id", profile.id);
    if (updateErr) throw updateErr;

    // Mirror to Leaderboard (best-effort — non-fatal)
    try {
      const { data: lbEntries } = await supabaseAdmin
        .from("leaderboards")
        .select("id")
        .eq("user_email", userEmail)
        .limit(1);
      if (lbEntries?.[0]) {
        await supabaseAdmin
          .from("leaderboards")
          .update({ streak_days: newStreak, last_updated: new Date().toISOString() })
          .eq("id", lbEntries[0].id);
      }
    } catch (e) {
      console.warn("[updateStreak] leaderboard mirror failed:", e?.message);
    }

    const milestones = [3, 7, 14, 30, 60, 100, 150, 200, 365];
    return res.json({
      success: true,
      streak_days: newStreak,
      is_new_day: true,
      is_consecutive: isConsecutive,
      multiplier: getStreakMultiplier(newStreak),
      peak_streak: newPeak,
      hit_milestone: milestones.includes(newStreak),
    });
  } catch (err) {
    console.error("[updateStreak] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// ─── awardXP — XP engine v2 (verified, idempotent, anti-cheat) ─────────────
// Direct port of base44/functions/awardXP/entry.ts. All formulas, daily caps,
// velocity caps, level curve, and rank tiers are bit-for-bit identical so
// numbers don't shift when we cut over. See that file for the full design doc.

// Level curve: 120 × i^1.6 per level — slow, real long-term effort
function xpForLevel(n) {
  if (n <= 1) return 0;
  let total = 0;
  for (let i = 1; i < n; i++) total += Math.round(120 * Math.pow(i, 1.6));
  return total;
}
function xpToNextLevel(n) {
  return Math.round(120 * Math.pow(n, 1.6));
}
function levelFromXP(totalXP) {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXP) {
    level++;
    if (level > 500) break;
  }
  return level;
}
function levelProgress(totalXP) {
  const level = levelFromXP(totalXP);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  return Math.min(100, Math.round(((totalXP - start) / (end - start)) * 100));
}

// All-time rank tiers (keyed by total_xp)
const XP_RANKS = [
  { name: "Slackademic",            minXP: 0,       maxXP: 800,    tier: 1,  color: "#64748b", emoji: "😴" },
  { name: "Barely Literate Bandit", minXP: 800,     maxXP: 3000,   tier: 2,  color: "#78716c", emoji: "📖" },
  { name: "Wikipedia Warrior",      minXP: 3000,    maxXP: 8000,   tier: 3,  color: "#f97316", emoji: "🖱️" },
  { name: "Flash Card Finesser",    minXP: 8000,    maxXP: 18000,  tier: 4,  color: "#f59e0b", emoji: "🗂️" },
  { name: "Highlighter Hoarder",    minXP: 18000,   maxXP: 35000,  tier: 5,  color: "#84cc16", emoji: "🖍️" },
  { name: "Grind Gremlin",          minXP: 35000,   maxXP: 65000,  tier: 6,  color: "#10b981", emoji: "🧠" },
  { name: "Pomodoro Prodigy",       minXP: 65000,   maxXP: 120000, tier: 7,  color: "#06b6d4", emoji: "⏱️" },
  { name: "Academic Weapon",        minXP: 120000,  maxXP: 220000, tier: 8,  color: "#8b5cf6", emoji: "🚀" },
  { name: "VCE Demigod",            minXP: 220000,  maxXP: 400000, tier: 9,  color: "#f43f5e", emoji: "⚡" },
  { name: "Legend of the HSC",      minXP: 400000,  maxXP: Infinity, tier: 10, color: "#f59e0b", emoji: "👑" },
];
function getRankFromXP(totalXP) {
  return XP_RANKS.find(r => totalXP >= r.minXP && totalXP < r.maxXP) || XP_RANKS[XP_RANKS.length - 1];
}

// Seasonal rank tiers (keyed by season_xp, resets each ~20-week season)
const SEASON_RANKS = [
  { name: "Bronze I",    minXP: 0,     maxXP: 1200,   tier: 1,  color: "#92400e", emoji: "🥉" },
  { name: "Bronze II",   minXP: 1200,  maxXP: 2800,   tier: 2,  color: "#b45309", emoji: "🥉" },
  { name: "Bronze III",  minXP: 2800,  maxXP: 5000,   tier: 3,  color: "#d97706", emoji: "🥉" },
  { name: "Silver I",    minXP: 5000,  maxXP: 9000,   tier: 4,  color: "#6b7280", emoji: "🥈" },
  { name: "Silver II",   minXP: 9000,  maxXP: 15000,  tier: 5,  color: "#9ca3af", emoji: "🥈" },
  { name: "Silver III",  minXP: 15000, maxXP: 24000,  tier: 6,  color: "#d1d5db", emoji: "🥈" },
  { name: "Gold I",      minXP: 24000, maxXP: 38000,  tier: 7,  color: "#f59e0b", emoji: "🥇" },
  { name: "Gold II",     minXP: 38000, maxXP: 58000,  tier: 8,  color: "#fbbf24", emoji: "🥇" },
  { name: "Gold III",    minXP: 58000, maxXP: 85000,  tier: 9,  color: "#fde68a", emoji: "🥇" },
  { name: "Platinum I",  minXP: 85000, maxXP: 120000, tier: 10, color: "#0891b2", emoji: "💠" },
  { name: "Platinum II", minXP: 120000, maxXP: 170000, tier: 11, color: "#22d3ee", emoji: "💠" },
  { name: "Platinum III",minXP: 170000, maxXP: 240000, tier: 12, color: "#7dd3fc", emoji: "💠" },
  { name: "Diamond I",   minXP: 240000, maxXP: 330000, tier: 13, color: "#8b5cf6", emoji: "💎" },
  { name: "Diamond II",  minXP: 330000, maxXP: 440000, tier: 14, color: "#a78bfa", emoji: "💎" },
  { name: "Diamond III", minXP: 440000, maxXP: 600000, tier: 15, color: "#c084fc", emoji: "💎" },
  { name: "Elite",       minXP: 600000, maxXP: 800000, tier: 16, color: "#f43f5e", emoji: "⚔️" },
  { name: "Legend",      minXP: 800000, maxXP: Infinity, tier: 17, color: "#fbbf24", emoji: "👑" },
];
function getSeasonRankFromXP(seasonXP) {
  return SEASON_RANKS.find(r => seasonXP >= r.minXP && seasonXP < r.maxXP) || SEASON_RANKS[SEASON_RANKS.length - 1];
}

// XP formula multipliers
const DIFF_MULT = { foundation: 0.7, developing: 0.9, proficient: 1.0, advanced: 1.3, exam_ready: 1.6 };
const PRIORITY_MULT = { low: 0.8, medium: 1.0, high: 1.3 };
const GOAL_DIFF_MULT = { easy: 0.8, medium: 1.0, hard: 1.4, very_hard: 1.8 };
const CHALLENGE_BASE = { practice_questions: 40, flashcard_sprint: 30, focus_session: 50, mini_test: 60, revision_schedule: 35 };

function calcFocusTimerXP({ duration_minutes = 0 }) {
  if (duration_minutes < 2) return 0;
  return Math.round(Math.min(duration_minutes, 120) * 1.25);
}
function calcPracticeQuestionsXP({ questions_attempted = 0, questions_correct = 0, difficulty = "proficient", consecutive_streak = 0 }) {
  if (questions_attempted === 0) return 0;
  const accuracy = questions_correct / questions_attempted;
  const accuracyMult = 1 + Math.max(0, (accuracy - 0.5) / 0.5);
  const diffMult = DIFF_MULT[difficulty] || 1.0;
  const streakBonus = Math.min(10, consecutive_streak * 0.5);
  return Math.round(questions_attempted * 1.5 * accuracyMult * diffMult + streakBonus);
}
function calcFlashcardXP({ cards_reviewed = 0 }) {
  if (cards_reviewed === 0) return 0;
  return Math.round(cards_reviewed * 0.5);
}
function calcMiniTestXP({ score = 0, prev_best_score = null }) {
  const scoreMult = 1 + score / 100;
  const improveMult = prev_best_score != null && score > prev_best_score
    ? 1 + (score - prev_best_score) / 100
    : 1.0;
  return Math.round(20 * scoreMult * improveMult);
}
function calcChallengeXP({ challenge_type, difficulty, score_percent, days_until_deadline, importance }) {
  const base = CHALLENGE_BASE[challenge_type] || 40;
  const diffMult = DIFF_MULT[difficulty] || 1.0;
  const impMult = PRIORITY_MULT[importance] || 1.0;
  let scoreMult = 1.0;
  if (score_percent != null) {
    if (score_percent >= 90) scoreMult = 1.3;
    else if (score_percent >= 75) scoreMult = 1.1;
    else if (score_percent < 50) scoreMult = 0.8;
  }
  const urgencyBonus = days_until_deadline != null && days_until_deadline <= 3 ? 1.15 : 1.0;
  return Math.round(base * diffMult * impMult * scoreMult * urgencyBonus);
}
function calcSubGoalXP(xp_reward, priority) {
  return Math.round((xp_reward || 50) * (PRIORITY_MULT[priority] || 1.0));
}
function calcGoalXP(xp_reward, difficulty_level) {
  return Math.round((xp_reward || 300) * (GOAL_DIFF_MULT[difficulty_level] || 1.0));
}
function calcQuizXP({ quiz_score = 0, questions_total = 1, questions_correct = 0, total_marks = 0 }) {
  if (total_marks > 0) return Math.round(total_marks * 2);
  return Math.round((questions_correct || Math.round((quiz_score / 100) * questions_total)) * 2);
}
function calcStudySessionXP(duration_minutes) {
  if (duration_minutes < 2) return 0;
  return Math.min(150, Math.round(duration_minutes * 1.25));
}
function calcStreakXP(streak_days) {
  return Math.min(100, 15 + streak_days * 2);
}
function calcWagerXP(wagered_xp, accuracy) {
  if (accuracy === "exact") return Math.round(wagered_xp * 3.5);
  if (accuracy === "close") return Math.round(wagered_xp * 1.5);
  return 0;
}

const DAILY_CAPS = {
  focus_session:      150,
  practice_questions: 100,
  flashcard:          80,
  mini_test:          120,
  challenge:          250,
  sub_goal:           400,
  goal:               1200,
  quiz:               100,
  study_session:      160,
  active_recall:      120,
  blurting:           80,
  streak:             100,
  weekly_streak:      75,
  friend_win:         200,
  competition_bonus:  500,
  wager:              300,
  season_reward:      2000,
};
const HOURLY_VELOCITY_CAP = 600;

app.post("/local-ai/fn/awardXP", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const body = req.body || {};
    const {
      source, event_key,
      duration_minutes, idle_ratio, tab_away_count, session_complete,
      questions_attempted, questions_correct, consecutive_streak,
      cards_reviewed, cards_correct, hard_cards,
      score, prev_best_score,
      challenge_type, difficulty, score_percent, days_until_deadline, importance,
      xp_reward, priority, difficulty_level,
      quiz_score, questions_total, time_taken_secs,
      streak_days,
      wagered_xp, wager_accuracy,
      flat_xp,
      streak_multiplier,
    } = body;

    if (!source) return res.status(400).json({ error: "source required" });
    if (!event_key) return res.status(400).json({ error: "event_key required for idempotency" });

    const userEmail = user.email;

    // ── Idempotency check ───────────────────────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from("xp_events")
      .select("id, xp_awarded")
      .eq("event_key", event_key)
      .eq("user_email", userEmail)
      .limit(1);
    if (existing?.[0]) {
      return res.json({
        success: true,
        xp_awarded: existing[0].xp_awarded,
        message: "Already awarded",
        deduplicated: true,
        event_id: existing[0].id,
      });
    }

    // ── Load (or create) profile ────────────────────────────────────────
    let { data: profileRows } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("created_by", userEmail);
    let profile = profileRows?.[0];
    if (!profile) {
      const { data: created } = await supabaseAdmin
        .from("user_profiles")
        .insert({ created_by: userEmail, user_email: userEmail, total_xp: 0, current_level: 1 })
        .select()
        .single();
      profile = created;
    }

    // ── XP integrity restore (audit log = source of truth) ──────────────
    if ((profile.total_xp || 0) === 0) {
      const { data: allEvents } = await supabaseAdmin
        .from("xp_events")
        .select("xp_awarded")
        .eq("user_email", userEmail);
      const auditTotal = (allEvents || []).reduce((sum, e) => sum + (e.xp_awarded || 0), 0);
      if (auditTotal > 0) {
        console.warn(`[awardXP] integrity restore for ${userEmail}: stored=0 audit=${auditTotal}`);
        const { data: restored } = await supabaseAdmin
          .from("user_profiles")
          .update({ total_xp: auditTotal, current_level: levelFromXP(auditTotal), user_email: userEmail })
          .eq("id", profile.id)
          .select()
          .single();
        profile = restored || profile;
      }
    }

    // ── Calculate raw XP ────────────────────────────────────────────────
    let rawXP = 0;
    switch (source) {
      case "focus_session":
        rawXP = calcFocusTimerXP({ duration_minutes, idle_ratio, tab_away_count, session_complete });
        break;
      case "practice_questions":
        rawXP = calcPracticeQuestionsXP({ questions_attempted, questions_correct, difficulty, consecutive_streak });
        break;
      case "flashcard":
        rawXP = calcFlashcardXP({ cards_reviewed, cards_correct, hard_cards });
        break;
      case "mini_test":
        rawXP = calcMiniTestXP({ score, prev_best_score });
        break;
      case "challenge":
        rawXP = calcChallengeXP({ challenge_type, difficulty, score_percent, days_until_deadline, importance });
        break;
      case "sub_goal":
        rawXP = calcSubGoalXP(xp_reward, priority);
        break;
      case "goal":
        rawXP = calcGoalXP(xp_reward, difficulty_level);
        break;
      case "quiz":
        rawXP = calcQuizXP({ quiz_score: quiz_score || 0, questions_total: questions_total || 1, questions_correct: questions_correct || 0, total_marks: body.total_marks || 0, time_taken_secs });
        break;
      case "study_session":
      case "active_recall":
      case "blurting":
        rawXP = calcStudySessionXP(duration_minutes || 0);
        break;
      case "streak":
        rawXP = calcStreakXP(streak_days || 1);
        break;
      case "weekly_streak":
        rawXP = 75;
        break;
      case "friend_win":
        rawXP = 100;
        break;
      case "competition_bonus":
      case "season_reward":
        rawXP = flat_xp || 0;
        break;
      case "wager":
        rawXP = calcWagerXP(wagered_xp || 0, wager_accuracy || "wrong");
        break;
      default:
        return res.status(400).json({ error: `Unknown source: ${source}` });
    }

    // ── Apply streak multiplier (1.0×–2.0×, clamped) ────────────────────
    const safeMultiplier = Math.max(1.0, Math.min(2.0, streak_multiplier || 1.0));
    if (safeMultiplier > 1.0 && !["streak", "weekly_streak", "wager", "competition_bonus", "season_reward", "friend_win"].includes(source)) {
      rawXP = Math.round(rawXP * safeMultiplier);
    }

    // Helper: write a zero-XP audit event (for capped/zero outcomes)
    const writeZeroEvent = async (flags = [], metadata = {}) => {
      await supabaseAdmin.from("xp_events").insert({
        created_by: userEmail,
        event_key,
        user_email: userEmail,
        source,
        xp_awarded: 0,
        raw_xp: rawXP,
        capped: flags.length > 0,
        integrity_flags: flags,
        total_xp_after: profile.total_xp || 0,
        season_xp_after: profile.season_xp || 0,
        level_before: profile.current_level || 1,
        level_after: profile.current_level || 1,
        leveled_up: false,
        metadata: { ...body, ...metadata },
      });
    };

    if (rawXP <= 0) {
      await writeZeroEvent([]);
      return res.json({ success: true, xp_awarded: 0, message: "Zero XP calculated" });
    }

    // ── Daily cap enforcement ───────────────────────────────────────────
    const todayKey = new Date().toISOString().split("T")[0];
    const dailyCaps = profile.daily_xp_caps || {};
    const todayCaps = dailyCaps[todayKey] || {};
    const currentSourceTotal = todayCaps[source] || 0;
    const cap = DAILY_CAPS[source] || 500;
    const afterCap = Math.min(rawXP, Math.max(0, cap - currentSourceTotal));
    const isCapped = afterCap < rawXP;

    if (afterCap <= 0) {
      await writeZeroEvent(["daily_cap"], { cap, used: currentSourceTotal });
      return res.json({ success: true, xp_awarded: 0, message: `Daily cap reached for ${source}`, capped: true });
    }

    // ── Velocity check (anti-burst) ─────────────────────────────────────
    const velocityLog = profile.xp_velocity_log || [];
    const oneHourAgo = Date.now() - 3600000;
    const recentXP = velocityLog
      .filter((e) => e.ts > oneHourAgo)
      .reduce((sum, e) => sum + (e.xp || 0), 0);
    const velocityAllowed = Math.max(0, HOURLY_VELOCITY_CAP - recentXP);
    const finalXP = Math.min(afterCap, velocityAllowed);
    const velocityCapped = finalXP < afterCap;

    if (finalXP <= 0) {
      await writeZeroEvent(["velocity_cap"], { recent_xp: recentXP });
      return res.json({ success: true, xp_awarded: 0, message: "Velocity cap reached", capped: true });
    }

    // ── Re-read profile for race-safety, then write XP ──────────────────
    const { data: freshRows } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("created_by", userEmail);
    const freshProfile = freshRows?.[0] || profile;

    // total_xp is STRICTLY ADDITIVE — take max so a stale read can't reduce it
    const prevTotalXP = Math.max(freshProfile.total_xp || 0, profile.total_xp || 0);
    const newTotalXP = prevTotalXP + finalXP;
    const newSeasonXP = (freshProfile.season_xp || 0) + finalXP;
    const prevLevel = levelFromXP(prevTotalXP);
    const newLevel = levelFromXP(newTotalXP);
    const leveledUp = newLevel > prevLevel;
    const newAllTimeRank = getRankFromXP(newTotalXP);
    const prevAllTimeRank = getRankFromXP(prevTotalXP);
    const rankUp = newAllTimeRank.tier > prevAllTimeRank.tier;
    const newSeasonRank = getSeasonRankFromXP(newSeasonXP);
    const prevSeasonRank = getSeasonRankFromXP(freshProfile.season_xp || 0);
    const seasonRankUp = newSeasonRank.tier > prevSeasonRank.tier;

    // Write the audit event FIRST (idempotency anchor)
    const { data: xpEvent } = await supabaseAdmin
      .from("xp_events")
      .insert({
        created_by: userEmail,
        event_key,
        user_email: userEmail,
        source,
        xp_awarded: finalXP,
        raw_xp: rawXP,
        capped: isCapped || velocityCapped,
        integrity_flags: [],
        total_xp_after: newTotalXP,
        season_xp_after: newSeasonXP,
        level_before: prevLevel,
        level_after: newLevel,
        leveled_up: leveledUp,
        metadata: { challenge_type, difficulty, score_percent, score, duration_minutes },
      })
      .select()
      .single();

    // Update UserProfile XP (CRITICAL — strictly increasing)
    await supabaseAdmin
      .from("user_profiles")
      .update({
        total_xp: newTotalXP,
        current_level: newLevel,
        season_xp: newSeasonXP,
        peak_streak: Math.max(freshProfile.peak_streak || 0, freshProfile.streak_days || 0),
        user_email: userEmail,
      })
      .eq("id", freshProfile.id);

    // Caps + velocity log update — non-fatal if it fails
    try {
      const updatedCaps = {
        ...(freshProfile.daily_xp_caps || {}),
        [todayKey]: {
          ...(freshProfile.daily_xp_caps?.[todayKey] || {}),
          [source]: currentSourceTotal + finalXP,
        },
      };
      const updatedVelocity = [
        ...(freshProfile.xp_velocity_log || []).filter((e) => e.ts > Date.now() - 7200000).slice(-49),
        { ts: Date.now(), xp: finalXP, source },
      ];
      await supabaseAdmin
        .from("user_profiles")
        .update({ daily_xp_caps: updatedCaps, xp_velocity_log: updatedVelocity })
        .eq("id", freshProfile.id);
    } catch (capErr) {
      console.warn("[awardXP] caps/velocity update failed (XP was still saved):", capErr?.message);
    }

    // School aggregate update — best-effort
    if (freshProfile.school_name) {
      try {
        const { data: schools } = await supabaseAdmin
          .from("school_profiles")
          .select("id, total_season_xp, total_alltime_xp")
          .eq("school_name", freshProfile.school_name)
          .limit(1);
        const school = schools?.[0];
        if (school) {
          await supabaseAdmin
            .from("school_profiles")
            .update({
              total_season_xp: (school.total_season_xp || 0) + finalXP,
              total_alltime_xp: (school.total_alltime_xp || 0) + finalXP,
            })
            .eq("id", school.id);
        }
      } catch (e) {
        console.warn("[awardXP] school update failed:", e?.message);
      }
    }

    // Leaderboard mirror — best-effort
    try {
      const { data: lbRows } = await supabaseAdmin
        .from("leaderboards")
        .select("id")
        .eq("user_email", userEmail)
        .limit(1);
      if (lbRows?.[0]) {
        await supabaseAdmin
          .from("leaderboards")
          .update({
            total_xp: newTotalXP,
            level: newLevel,
            season_xp: newSeasonXP,
            last_updated: new Date().toISOString(),
          })
          .eq("id", lbRows[0].id);
      }
    } catch (e) {
      console.warn("[awardXP] leaderboard update failed:", e?.message);
    }

    // Weekly Leagues — credit XP to the user's current-week league
    // membership. Fire-and-forget; failure doesn't block the awardXP response.
    addLeagueXP(userEmail, profile, finalXP).catch((e) =>
      console.warn("[leagues] hook from awardXP failed:", e?.message || e),
    );

    return res.json({
      success: true,
      xp_awarded: finalXP,
      raw_xp: rawXP,
      capped: isCapped || velocityCapped,
      total_xp: newTotalXP,
      season_xp: newSeasonXP,
      current_level: newLevel,
      level_progress: levelProgress(newTotalXP),
      xp_to_next_level: xpToNextLevel(newLevel) - (newTotalXP - xpForLevel(newLevel)),
      leveled_up: leveledUp,
      levels_gained: newLevel - prevLevel,
      alltime_rank: newAllTimeRank,
      season_rank: newSeasonRank,
      rank_up: rankUp,
      season_rank_up: seasonRankUp,
      event_id: xpEvent?.id,
    });
  } catch (err) {
    console.error("[awardXP] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// ─── awardXPIncremental — per-minute / per-card XP drips ───────────────────
// Called continuously during ongoing activities (Pomodoro tick, flashcard
// review). Lighter-weight than awardXP — same idempotency + cap pattern but
// no level/rank computation since the deltas are tiny.
app.post("/local-ai/fn/awardXPIncremental", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const { type, event_key, metadata = {} } = req.body || {};
    if (!event_key) return res.status(400).json({ error: "event_key required" });
    const userEmail = user.email;

    // Idempotency
    const { data: existing } = await supabaseAdmin
      .from("xp_events")
      .select("id, xp_awarded")
      .eq("event_key", event_key)
      .eq("user_email", userEmail)
      .limit(1);
    if (existing?.[0]) {
      return res.json({ success: true, xp_awarded: existing[0].xp_awarded, deduplicated: true });
    }

    // Calculate XP — small per-tick amounts
    let xp = 0;
    let source = "study_session";
    if (type === "focus_minute") {
      const tabAway = metadata.tab_away_count || 0;
      const tabPenalty = tabAway > 5 ? 0.4 : tabAway > 2 ? 0.7 : 1.0;
      const diff = metadata.difficulty || "proficient";
      const diffMult = DIFF_MULT[diff] || 1.0;
      xp = Math.max(1, Math.round(1.6 * diffMult * tabPenalty));
      source = "study_session";
    } else if (type === "flashcard_card") {
      xp = metadata.correct ? 2 : 1;
      source = "flashcard";
    } else {
      return res.status(400).json({ error: "Unknown type" });
    }
    if (xp <= 0) return res.json({ success: true, xp_awarded: 0 });

    // Load (or create) profile
    let { data: profileRows } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("created_by", userEmail);
    let profile = profileRows?.[0];
    if (!profile) {
      const { data: created } = await supabaseAdmin
        .from("user_profiles")
        .insert({ created_by: userEmail, user_email: userEmail, total_xp: 0, current_level: 1 })
        .select()
        .single();
      profile = created;
    }

    // Daily cap (incremental: focus 160/day, flashcards 80/day)
    const todayKey = new Date().toISOString().split("T")[0];
    const dailyCaps = profile.daily_xp_caps || {};
    const todayCaps = dailyCaps[todayKey] || {};
    const CAP = type === "focus_minute" ? 160 : 80;
    const usedToday = todayCaps[source] || 0;
    const allowed = Math.max(0, CAP - usedToday);
    const finalXP = Math.min(xp, allowed);
    if (finalXP <= 0) {
      return res.json({ success: true, xp_awarded: 0, message: "Daily cap reached" });
    }

    // Velocity check (rolling 1h, 600 XP cap)
    const velocityLog = profile.xp_velocity_log || [];
    const oneHourAgo = Date.now() - 3600000;
    const recentXP = velocityLog.filter(e => e.ts > oneHourAgo).reduce((s, e) => s + (e.xp || 0), 0);
    if (recentXP >= 600) {
      return res.json({ success: true, xp_awarded: 0, message: "Velocity cap reached" });
    }

    const newTotalXP = (profile.total_xp || 0) + finalXP;
    const newSeasonXP = (profile.season_xp || 0) + finalXP;

    // Audit event
    await supabaseAdmin.from("xp_events").insert({
      created_by: userEmail,
      event_key,
      user_email: userEmail,
      source,
      xp_awarded: finalXP,
      raw_xp: xp,
      capped: finalXP < xp,
      integrity_flags: [],
      total_xp_after: newTotalXP,
      season_xp_after: newSeasonXP,
      level_before: profile.current_level || 1,
      level_after: profile.current_level || 1,
      leveled_up: false,
      metadata: { type, ...metadata },
    });

    // Update profile + caps + velocity
    const updatedCaps = {
      ...dailyCaps,
      [todayKey]: { ...todayCaps, [source]: usedToday + finalXP },
    };
    const updatedVelocity = [
      ...velocityLog.filter(e => e.ts > Date.now() - 7200000),
      { ts: Date.now(), xp: finalXP, source },
    ].slice(-100);

    await supabaseAdmin
      .from("user_profiles")
      .update({
        total_xp: newTotalXP,
        season_xp: newSeasonXP,
        daily_xp_caps: updatedCaps,
        xp_velocity_log: updatedVelocity,
      })
      .eq("id", profile.id);

    // Leagues: credit incremental XP to the user's current weekly membership.
    addLeagueXP(userEmail, profile, finalXP).catch(() => {});

    return res.json({ success: true, xp_awarded: finalXP, total_xp: newTotalXP });
  } catch (err) {
    console.error("[awardXPIncremental] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// ─── awardGoalXP — DEPRECATED but still called for sub-goal completions ────
// The Base44 source flagged this as legacy; new code uses awardXP. Port kept
// for backward-compat. Awards xp_reward from the goal/sub-goal directly,
// updates profile + leaderboard, no caps.
app.post("/local-ai/fn/awardGoalXP", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const { goal_id, sub_goal_id, is_full_goal } = req.body || {};
    const userEmail = user.email;

    const { data: goal, error: goalErr } = await supabaseAdmin
      .from("goals")
      .select("*")
      .eq("id", goal_id)
      .single();
    if (goalErr || !goal) return res.status(404).json({ error: "Goal not found" });
    if (goal.created_by !== userEmail) return res.status(404).json({ error: "Goal not found" });

    let xpAwarded = 0;
    if (is_full_goal) {
      xpAwarded = goal.total_xp_reward || 0;
    } else if (sub_goal_id) {
      const subGoal = (goal.sub_goals || []).find(sg => sg.id === sub_goal_id);
      if (!subGoal) return res.status(404).json({ error: "Sub-goal not found" });
      xpAwarded = subGoal.xp_reward || 0;
    }
    if (xpAwarded === 0) return res.json({ xp_awarded: 0, message: "No XP to award" });

    // Profile update — note: legacy uses simple "100 XP per level" math
    const { data: profileRows } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("created_by", userEmail);
    let profile = profileRows?.[0];
    const currentXP = (profile?.total_xp || 0) + xpAwarded;
    const newLevel = Math.floor(currentXP / 100) + 1;

    if (profile) {
      await supabaseAdmin
        .from("user_profiles")
        .update({ total_xp: currentXP, current_level: newLevel })
        .eq("id", profile.id);
    } else {
      const { data: created } = await supabaseAdmin
        .from("user_profiles")
        .insert({ created_by: userEmail, user_email: userEmail, total_xp: currentXP, current_level: newLevel })
        .select()
        .single();
      profile = created;
    }

    // Leaderboard mirror — best-effort
    try {
      const { data: lbRows } = await supabaseAdmin
        .from("leaderboards")
        .select("id")
        .eq("user_email", userEmail)
        .limit(1);
      if (lbRows?.[0]) {
        await supabaseAdmin
          .from("leaderboards")
          .update({ total_xp: currentXP, level: newLevel })
          .eq("id", lbRows[0].id);
      }
    } catch (e) {
      console.warn("[awardGoalXP] leaderboard update failed:", e?.message);
    }

    return res.json({
      success: true,
      xp_awarded: xpAwarded,
      total_xp: currentXP,
      current_level: newLevel,
      level_up: profile && newLevel > (profile.current_level || 1),
    });
  } catch (err) {
    console.error("[awardGoalXP] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

app.post("/local-ai/uploadFile", upload.any(), (req, res) => {
  try {
    const file = req.files?.[0];
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const id = storeFile(file.buffer, file.mimetype, file.originalname);
    console.log(
      `[local-ai] upload: ${file.originalname} (${file.size} bytes, ${file.mimetype}) -> local-file://${id}`,
    );
    return res.json({ file_url: `local-file://${id}` });
  } catch (err) {
    console.error("[local-ai] upload error:", err);
    return res.status(500).json({ message: err?.message || String(err) });
  }
});

// Streaming variant of /local-ai/invokeAI. Same request shape, but emits
// Server-Sent Events:
//   event: text   data: {"text": "...delta..."}     (one per output chunk)
//   event: done   data: {"ok": true}                (final, before close)
//   event: error  data: {"message": "..."}          (terminal failure)
//
// Client should consume this with the `invokeLLMStream` helper in
// src/lib/streamingAI.js. Use this for free-form text outputs (essay plans,
// explanations, feedback). For structured-output tools that pass a
// response_json_schema, keep using the batch /local-ai/invokeAI endpoint —
// streaming partial JSON isn't useful until it's complete.
app.post("/local-ai/invokeAIStream", async (req, res) => {
  console.log(`[local-ai] invokeAIStream received (file_urls=${(req.body?.file_urls || []).length})`);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sse = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const params = req.body || {};
    const promptText =
      typeof params.prompt === "string" ? params.prompt : JSON.stringify(params.prompt ?? "");

    if (detectThreat(promptText)) {
      sse("error", {
        message:
          "🚫 This request has been flagged as potentially malicious and cannot be processed.",
      });
      return res.end();
    }

    // ─── Tier gate (streaming) ────────────────────────────────────────────
    const tierUser = await authenticateRequest(req);
    let tierProfile = null;
    const feature = params.feature || "ai_tool";
    if (tierUser) {
      tierProfile = await loadUserProfile(tierUser.email);
      const access = checkTierAccess(tierProfile, feature);
      if (!access.allowed) {
        console.log(`[local-ai] (stream) tier-gate blocked: ${tierUser.email} feature=${feature} status=${access.status}`);
        sse("error", { message: access.reason, upgradeRequired: access.status === 402 });
        return res.end();
      }
    } else {
      console.warn(`[local-ai] invokeAIStream called without auth — tier limits NOT enforced (legacy path).`);
    }

    const { system, user } = splitSystemAndUser(promptText);
    const fileBlocks = await buildFileContentBlocks(params.file_urls);
    const userContent = [...fileBlocks, { type: "text", text: user }];

    const request = {
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: "user", content: userContent }],
    };

    if (system) {
      request.system = [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
      ];
    }

    if (params.add_context_from_internet) {
      request.tools = [
        { type: "web_search_20260209", name: "web_search", max_uses: 5 },
      ];
    }

    const stream = anthropic.messages.stream(request);

    stream.on("text", (delta) => {
      sse("text", { text: delta });
    });

    const finalMessage = await stream.finalMessage();

    if (finalMessage.usage) {
      console.log(
        `[local-ai] (stream) in=${finalMessage.usage.input_tokens} cache_read=${finalMessage.usage.cache_read_input_tokens ?? 0} cache_write=${finalMessage.usage.cache_creation_input_tokens ?? 0} out=${finalMessage.usage.output_tokens}`,
      );
    }

    if (tierProfile) {
      recordTierUsage(tierProfile, feature, finalMessage.usage).catch((e) =>
        console.error("[local-ai] (stream) recordTierUsage failed:", e?.message || e),
      );
    }

    sse("done", { ok: true });
    res.end();
  } catch (err) {
    console.error("[local-ai] stream error:", err);
    try {
      sse("error", { message: err?.message || String(err) });
    } catch {}
    res.end();
  }
});

app.post("/local-ai/invokeAI", async (req, res) => {
  console.log(`[local-ai] invokeAI received (file_urls=${(req.body?.file_urls || []).length}, has_schema=${!!req.body?.response_json_schema}, feature=${req.body?.feature || "(none)"})`);
  try {
    const params = req.body || {};
    const promptText =
      typeof params.prompt === "string" ? params.prompt : JSON.stringify(params.prompt ?? "");

    if (detectThreat(promptText)) {
      return res.status(403).json({
        message:
          "🚫 This request has been flagged as potentially malicious and cannot be processed. If you believe this is an error, please contact support.",
      });
    }

    // ─── Tier gate ────────────────────────────────────────────────────────
    // Authenticated callers (Supabase JWT) get tier checks + usage tracking.
    // Unauthenticated callers (legacy Base44) pass through with a warning —
    // post phase 3c+3d migration, every caller will have a Supabase JWT and
    // we can flip this to hard-require.
    const tierUser = await authenticateRequest(req);
    let tierProfile = null;
    const feature = params.feature || "ai_tool";
    if (tierUser) {
      tierProfile = await loadUserProfile(tierUser.email);
      const access = checkTierAccess(tierProfile, feature);
      if (!access.allowed) {
        console.log(`[local-ai] tier-gate blocked: ${tierUser.email} feature=${feature} status=${access.status}`);
        return res.status(access.status).json({
          message: access.reason,
          upgradeRequired: access.status === 402,
        });
      }
    } else {
      console.warn(`[local-ai] invokeAI called without auth — tier limits NOT enforced (legacy path).`);
    }

    const { system, user } = splitSystemAndUser(promptText);
    const fileBlocks = await buildFileContentBlocks(params.file_urls);

    // Compose the user message: any image/PDF blocks first, then the text.
    const userContent = [
      ...fileBlocks,
      { type: "text", text: user },
    ];

    // Build the request. Cache the VCE expert system prompt when present.
    // max_tokens bumped to 32k — 8k truncates structured outputs like the Exam
    // Question Generator (15 questions × marking_criteria + model_answer is big).
    const request = {
      model: MODEL,
      max_tokens: 32000,
      messages: [{ role: "user", content: userContent }],
    };

    if (system) {
      request.system = [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ];
    }

    // Optional: web search when the caller asks for fresh internet context.
    if (params.add_context_from_internet) {
      request.tools = [
        { type: "web_search_20260209", name: "web_search", max_uses: 5 },
      ];
    }

    // Structured output via JSON schema when the caller passes one.
    // Anthropic's grammar compilation has complexity limits (deeply nested
    // schemas like Study Roadmap blow past them with "Schema is too complex").
    // We try strict structured outputs first, and fall back to prompt-based
    // JSON if the schema is rejected — Claude is reliable at producing JSON
    // matching a schema described in the prompt.
    const schema = params.response_json_schema;
    const useStrictSchema = schema && typeof schema === "object";
    if (useStrictSchema) {
      request.output_config = {
        format: {
          type: "json_schema",
          schema: sanitizeSchemaForAnthropic(schema),
        },
      };
    }

    // Use streaming internally to avoid HTTP timeouts on long generations
    // (large PDFs, big essays, etc.). We still return a single JSON response
    // to the caller — the streaming is purely for connection-level reliability.
    let response;
    try {
      const stream = anthropic.messages.stream(request);
      response = await stream.finalMessage();
    } catch (err) {
      // Fallback: schema rejected by Anthropic's grammar compiler.
      // Either the schema exceeds complexity limits ("Schema is too complex")
      // or the grammar compilation service is temporarily down with a 503
      // ("Grammar compilation is temporarily unavailable"). Both are recoverable
      // by retrying without output_config and asking for JSON in the prompt.
      const msg = (err?.message || "").toLowerCase();
      const isSchemaIssue =
        msg.includes("schema is too complex") ||
        msg.includes("grammar compilation") ||
        msg.includes("grammar") ||
        msg.includes("output_config.format.schema") ||
        msg.includes("minitems") ||
        msg.includes("maxitems");
      if (useStrictSchema && isSchemaIssue) {
        console.warn(`[local-ai] structured-outputs failed (${err?.message?.slice(0, 80)}); retrying with prompt-based JSON`);
        delete request.output_config;
        // Inject a system instruction telling Claude to output ONLY valid JSON
        // matching the requested schema. This is reliable in practice.
        const schemaInstruction = {
          type: "text",
          text:
            "Your response must be ONLY valid JSON matching this exact schema. " +
            "Do not include markdown code fences, prose, or any text outside the JSON.\n\n" +
            "Schema:\n" + JSON.stringify(schema, null, 2),
        };
        request.system = request.system
          ? [...request.system, schemaInstruction]
          : [schemaInstruction];
        const stream = anthropic.messages.stream(request);
        response = await stream.finalMessage();
      } else {
        throw err;
      }
    }

    // Concatenate text blocks (Claude may emit multiple).
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // If structured output was requested, parse and return the object.
    // The fallback path may yield text wrapped in ``` fences if Claude slips
    // into markdown — strip those before parsing.
    let result;
    if (params.response_json_schema) {
      const stripped = text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      try {
        result = JSON.parse(stripped);
      } catch (e) {
        // Parse failed — almost always means the response was truncated.
        // Surface this as a 500 so the client's catch handler fires; returning
        // the raw text on success silently breaks every JSON-schema caller.
        console.error("[local-ai] Failed to parse JSON response (likely truncated). First 500 chars:", stripped.slice(0, 500));
        return res.status(500).json({
          message: "AI response was incomplete — try generating fewer items at once (e.g. 5–8 questions instead of 15+).",
          truncated: true,
        });
      }
    } else {
      result = text;
    }

    if (response.usage) {
      console.log(
        `[local-ai] in=${response.usage.input_tokens} cache_read=${response.usage.cache_read_input_tokens ?? 0} cache_write=${response.usage.cache_creation_input_tokens ?? 0} out=${response.usage.output_tokens}`,
      );
    }

    // Fire-and-forget usage tracking (don't block the response on Supabase write).
    if (tierProfile) {
      recordTierUsage(tierProfile, feature, response.usage).catch((e) =>
        console.error("[local-ai] recordTierUsage failed:", e?.message || e),
      );
    }

    // Base44's HTTP integration endpoint returns the bare result (string for
    // text prompts, object for response_json_schema). The SDK's axios
    // interceptor returns `response.data` to the caller, so what we send here
    // becomes what the AI tool sees directly.
    return res.json(result);
  } catch (err) {
    console.error("[local-ai] error:", err);
    const message = err?.message || String(err);
    // SDK's error interceptor reads error.response.data.message — give it that
    // shape so AI tools see a useful message.
    return res.status(500).json({ message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Goal AI cluster — Phase 3b ports (2 functions: AI plan generator + auto-progress tracker)
// ════════════════════════════════════════════════════════════════════════════

// ─── updateGoalProgress ────────────────────────────────────────────────────
// Recomputes auto-tracked sub-goal progress from study activity (sessions,
// quizzes, flashcards) and awards XP for newly completed sub-goals or the
// whole goal. Called when the Goals page is opened.
app.post("/local-ai/fn/updateGoalProgress", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const { goal_id } = req.body || {};
    if (!goal_id) return res.status(400).json({ error: "goal_id required" });

    const userEmail = user.email;
    const authHeader = req.headers.authorization || "";

    const { data: currentGoal, error: goalErr } = await supabaseAdmin
      .from("goals")
      .select("*")
      .eq("id", goal_id)
      .maybeSingle();
    if (goalErr) throw goalErr;
    if (!currentGoal || currentGoal.created_by !== userEmail) {
      return res.status(404).json({ error: "Goal not found" });
    }

    if (currentGoal.is_completed) {
      return res.json({ success: true, skipped: true, reason: "Goal already completed" });
    }
    if (currentGoal.target_date && new Date(currentGoal.target_date) < new Date()) {
      return res.json({ success: true, skipped: true, reason: "Goal deadline has passed" });
    }

    const goalBaseline = currentGoal.tracking_start_date || currentGoal.created_date || null;
    const baselineDate = goalBaseline ? new Date(goalBaseline) : null;
    const afterBaseline = (record) => {
      if (!baselineDate) return true;
      const d = record.created_date ? new Date(record.created_date) : null;
      return d ? d >= baselineDate : true;
    };
    const matchesSubject = (record, filter) => {
      if (!filter) return true;
      const f = filter.toLowerCase();
      return (
        (record.subject || "").toLowerCase().includes(f) ||
        (record.subject_name || "").toLowerCase().includes(f)
      );
    };

    async function calcProgress(subGoal) {
      const subjectFilter = subGoal.subject_filter || null;
      try {
        switch (subGoal.type) {
          case "study_hours": {
            const [{ data: techs }, { data: sess }] = await Promise.all([
              supabaseAdmin.from("study_techniques").select("*").eq("created_by", userEmail),
              supabaseAdmin.from("study_sessions").select("*").eq("created_by", userEmail),
            ]);
            const techMin = (techs || [])
              .filter(afterBaseline)
              .filter((s) => matchesSubject(s, subjectFilter))
              .reduce((sum, s) => sum + (s.session_duration || 0), 0);
            const sessMin = (sess || [])
              .filter(afterBaseline)
              .filter((s) => matchesSubject(s, subjectFilter))
              .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
            return Math.min((techMin + sessMin) / 60, subGoal.target);
          }
          case "quiz_score": {
            const { data: attempts } = await supabaseAdmin
              .from("quiz_attempts").select("*").eq("created_by", userEmail);
            let filtered = (attempts || []).filter(afterBaseline);
            if (subjectFilter) {
              filtered = filtered.filter((a) =>
                a.quiz_title?.toLowerCase().includes(subjectFilter.toLowerCase()),
              );
            }
            if (filtered.length === 0) return 0;
            const avg = filtered.reduce((s, a) => s + (a.score || 0), 0) / filtered.length;
            return Math.min(avg, subGoal.target);
          }
          case "quiz_count": {
            const { data: attempts } = await supabaseAdmin
              .from("quiz_attempts").select("*").eq("created_by", userEmail);
            let filtered = (attempts || []).filter(afterBaseline);
            if (subjectFilter) {
              filtered = filtered.filter((a) =>
                a.quiz_title?.toLowerCase().includes(subjectFilter.toLowerCase()),
              );
            }
            return Math.min(filtered.length, subGoal.target);
          }
          case "flashcard_reviews": {
            let q = supabaseAdmin.from("flashcards").select("*").eq("created_by", userEmail);
            if (subjectFilter) q = q.eq("subject_name", subjectFilter);
            const { data: cards } = await q;
            const total = (cards || []).reduce((sum, f) => {
              if (!baselineDate) return sum + (f.totalReviews || 0);
              const updatedAt = f.updated_date ? new Date(f.updated_date) : null;
              if (!updatedAt || updatedAt < baselineDate) return sum;
              return sum + (f.review_count_good || 0) + (f.review_count_easy || 0);
            }, 0);
            return Math.min(total, subGoal.target);
          }
          case "study_sessions": {
            const [{ data: techs }, { data: sess }] = await Promise.all([
              supabaseAdmin.from("study_techniques").select("*").eq("created_by", userEmail),
              supabaseAdmin.from("study_sessions").select("*").eq("created_by", userEmail),
            ]);
            const t = (techs || []).filter(afterBaseline).filter((s) => matchesSubject(s, subjectFilter));
            const p = (sess || []).filter(afterBaseline).filter((s) => matchesSubject(s, subjectFilter));
            return Math.min(t.length + p.length, subGoal.target);
          }
          default:
            return 0;
        }
      } catch (e) {
        console.error(`[updateGoalProgress] calc error for ${subGoal.type}:`, e?.message);
        return subGoal.current_progress || 0;
      }
    }

    const updatedSubGoals = await Promise.all(
      (currentGoal.sub_goals || []).map(async (sg) => {
        if (sg.sub_sub_goals && sg.sub_sub_goals.length > 0) {
          const updatedSSG = await Promise.all(
            sg.sub_sub_goals.map(async (ssg) => {
              if (!ssg.type || ssg.type === "manual") return ssg;
              const cp = await calcProgress(ssg);
              const isComplete = ssg.target > 0 ? (cp / ssg.target) * 100 >= 100 : ssg.completed;
              return { ...ssg, current_progress: cp, completed: isComplete };
            }),
          );
          const allDone = updatedSSG.length > 0 && updatedSSG.every((x) => x.completed);
          return { ...sg, sub_sub_goals: updatedSSG, completed: allDone };
        }
        if (!sg.type || sg.type === "manual") return sg;
        const cp = await calcProgress(sg);
        const isComplete = sg.target > 0 ? (cp / sg.target) * 100 >= 100 : sg.completed;
        return { ...sg, current_progress: cp, completed: isComplete };
      }),
    );

    const completedCount = updatedSubGoals.filter((sg) => sg.completed).length;
    const overallProgress = updatedSubGoals.length > 0
      ? Math.round((completedCount / updatedSubGoals.length) * 100)
      : 0;

    await supabaseAdmin
      .from("goals")
      .update({
        sub_goals: updatedSubGoals,
        progress: overallProgress,
        is_completed: overallProgress === 100,
      })
      .eq("id", goal_id);

    // Award XP for newly completed items
    for (const sg of updatedSubGoals) {
      const orig = (currentGoal.sub_goals || []).find((x) => x.id === sg.id);
      if (sg.sub_sub_goals) {
        for (const ssg of sg.sub_sub_goals) {
          const origSSG = orig?.sub_sub_goals?.find((x) => x.id === ssg.id);
          if (!origSSG?.completed && ssg.completed && (ssg.xp_reward || 0) > 0) {
            try {
              const isFlash = ssg.type === "flashcard_reviews";
              const cappedXp = isFlash ? Math.min(ssg.xp_reward, 400) : ssg.xp_reward;
              await callLocalFn(
                "awardXP",
                {
                  source: "sub_goal",
                  event_key: `sub_sub_goal_${goal_id}_${ssg.id}`,
                  xp_reward: cappedXp,
                  priority: currentGoal.priority || "medium",
                },
                authHeader,
              );
            } catch (e) {
              console.error("[updateGoalProgress] sub-sub-goal XP error:", e?.message);
            }
          }
        }
      }
      if (!orig?.completed && sg.completed && (sg.xp_reward || 0) > 0) {
        try {
          await callLocalFn(
            "awardXP",
            {
              source: "sub_goal",
              event_key: `sub_goal_${goal_id}_${sg.id}`,
              xp_reward: sg.xp_reward,
              priority: currentGoal.priority || "medium",
            },
            authHeader,
          );
        } catch (e) {
          console.error("[updateGoalProgress] sub-goal XP error:", e?.message);
        }
      }
    }

    if (overallProgress === 100 && currentGoal.progress !== 100 && (currentGoal.total_xp_reward || 0) > 0) {
      try {
        await callLocalFn(
          "awardXP",
          {
            source: "goal",
            event_key: `goal_complete_${goal_id}`,
            xp_reward: currentGoal.total_xp_reward,
            difficulty_level: currentGoal.difficulty_level || "medium",
          },
          authHeader,
        );
      } catch (e) {
        console.error("[updateGoalProgress] goal-completion XP error:", e?.message);
      }
    }

    return res.json({
      success: true,
      updated_sub_goals: updatedSubGoals,
      overall_progress: overallProgress,
    });
  } catch (err) {
    console.error("[updateGoalProgress] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// ─── generateGoalWithAI ────────────────────────────────────────────────────
// Calibrates AcedIt-specific targets (study hours, quiz counts, etc.) based on
// timeframe + importance + confidence + target score, then asks Claude to
// turn them into a structured set of sub-goals.
app.post("/local-ai/fn/generateGoalWithAI", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const {
      title, description, target_date,
      subject_code, subject_name, user_sub_goals,
      assessment_type, target_score = 80,
      importance = 3, confidence = 3,
    } = req.body || {};

    if (!title || !description || !target_date) {
      return res.status(400).json({ error: "Missing required fields: title, description, target_date" });
    }

    // Days until target
    const daysUntilTarget = (() => {
      if (!target_date) return 30;
      const diff = Math.ceil((new Date(target_date).getTime() - Date.now()) / 86400000);
      return Math.max(1, diff);
    })();

    // Calibrated targets
    const importanceFactor = importance / 3;
    const confidenceFactor = (6 - confidence) / 3;
    const scoreFactor = target_score / 80;
    const stressMultiplier = (importanceFactor + confidenceFactor + scoreFactor) / 3;

    const baseHours =
      daysUntilTarget <= 2 ? 2 :
      daysUntilTarget <= 5 ? 4 :
      daysUntilTarget <= 7 ? 6 :
      daysUntilTarget <= 14 ? 10 :
      daysUntilTarget <= 30 ? 18 :
      daysUntilTarget <= 60 ? 35 : 55;
    const studyHours = Math.round(Math.min(baseHours * stressMultiplier, baseHours * 1.8));

    const baseQuizzes =
      daysUntilTarget <= 3 ? 2 :
      daysUntilTarget <= 7 ? 4 :
      daysUntilTarget <= 14 ? 6 :
      daysUntilTarget <= 30 ? 10 : 15;
    const quizCount = Math.round(Math.min(baseQuizzes * stressMultiplier, baseQuizzes * 1.8));

    const baseFlash =
      daysUntilTarget <= 3 ? 30 :
      daysUntilTarget <= 7 ? 60 :
      daysUntilTarget <= 14 ? 100 :
      daysUntilTarget <= 30 ? 180 : 280;
    const flashcardReviews = Math.round(Math.min(baseFlash * stressMultiplier, baseFlash * 1.8));

    const baseSess =
      daysUntilTarget <= 3 ? 3 :
      daysUntilTarget <= 7 ? 6 :
      daysUntilTarget <= 14 ? 10 :
      daysUntilTarget <= 30 ? 16 : 25;
    const studySessions = Math.round(Math.min(baseSess * stressMultiplier, baseSess * 1.8));

    const quizScoreTarget = Math.round(Math.min(target_score - 5, 95));
    const baseXP = Math.min(Math.round(50 + (daysUntilTarget / 60) * 350 * stressMultiplier), 500);

    const targets = {
      studyHours, quizCount, flashcardReviews, studySessions, quizScoreTarget,
      baseXP,
      stressLevel: stressMultiplier > 1.2 ? "high" : stressMultiplier > 0.8 ? "medium" : "low",
    };
    const hasUserSubGoals = user_sub_goals && user_sub_goals.length > 0;

    const importanceLabel = ["", "Low", "Moderate", "Important", "Very High", "Critical"][importance] || "Moderate";
    const confidenceLabel = ["", "Very Low", "Low", "Moderate", "Confident", "Very Confident"][confidence] || "Moderate";

    const contextBlock = `
**AcedIt Goal Context:**
- Subject: ${subject_name || subject_code || "General"}
- Assessment: ${assessment_type || "Assessment"}
- Target Score: ${target_score}%
- Deadline: ${target_date} (${daysUntilTarget} days away)
- Importance: ${importanceLabel} (${importance}/5)
- Confidence: ${confidenceLabel} (${confidence}/5) — ${confidence <= 2 ? "LOW confidence = needs MORE practice" : confidence >= 4 ? "HIGH confidence = fewer reps needed" : "moderate practice needed"}
- Stress Level: ${targets.stressLevel} (based on importance × confidence × target score)

**CALIBRATED ACEDIT TARGETS (use these exact numbers as targets):**
- Study Hours in AcedIt: ${targets.studyHours} hours (tracked via Pomodoro/Study sessions)
- Quiz attempts in AcedIt: ${targets.quizCount} quizzes completed
- Quiz Score Target: ${targets.quizScoreTarget}% average on AcedIt quizzes
- Flashcard Reviews in AcedIt: ${targets.flashcardReviews} reviews (Spaced Repetition)
- Study Sessions in AcedIt: ${targets.studySessions} sessions logged

**WHY THESE NUMBERS:**
${importance >= 4 ? `- High importance (${importance}/5) → increased targets` : importance <= 2 ? `- Low importance (${importance}/5) → reduced targets` : "- Moderate importance → standard targets"}
${confidence <= 2 ? `- Low confidence (${confidence}/5) → significantly more practice needed` : confidence >= 4 ? `- High confidence (${confidence}/5) → targets reduced` : "- Moderate confidence → standard practice"}
${target_score >= 90 ? `- High target score (${target_score}%) → near-perfect quiz scores required` : target_score <= 70 ? `- Lower target score (${target_score}%) → relaxed accuracy requirement` : ""}
`;

    const toolExamples = `
**ACEDIT TOOL EXAMPLES — Use these title patterns (always name the tool + specific content):**
- Pomodoro: "Use Pomodoro timer to study [topic] for X hours" → study_hours
- Flashcards: "Create and review flashcards for all key [topic] definitions" → flashcard_reviews
- Spaced Repetition: "Use Spaced Repetition to review [topic] flashcards" → flashcard_reviews
- Quizzes: "Complete X AcedIt quizzes on [topic] and score above X%" → quiz_count or quiz_score
- Active Recall: "Log X Active Recall sessions on [topic] in AcedIt" → study_sessions
- Blurting: "Complete X Blurting sessions on [topic] in AcedIt" → study_sessions
- Exam Mode: "Do X Exam Mode timed practice sessions on [topic]" → study_sessions
`;

    const noManualRule = `
ABSOLUTE RULE: NEVER use type "manual". Every single sub-goal MUST be one of: study_hours, quiz_score, quiz_count, flashcard_reviews, study_sessions.
These are all auto-tracked in AcedIt. There are no manual checkboxes.
ALWAYS include at least one item using Active Recall, Blurting, OR Exam Mode (these are study_sessions type).
`;

    const aiPrompt = hasUserSubGoals
      ? `You are an expert AcedIt study planner for VCE students. Generate action items for EVERY user sub-goal listed below.

CRITICAL: You MUST generate EXACTLY ${user_sub_goals.length} items in sub_goals_hierarchy — one entry for EACH numbered sub-goal below. Missing any sub-goal is a critical error.

Generate action items for each user sub-goal tracked automatically in AcedIt.

${contextBlock}
${toolExamples}
${noManualRule}

**USER'S SUB-GOALS:**
${user_sub_goals.map((sg, i) => `${i + 1}. ${sg}`).join("\n")}

For EACH user sub-goal, create 3-5 action items. ALL must be AcedIt-tracked types.

**AVAILABLE TYPES (no "manual"):**
- "study_hours" — Hours via AcedIt Pomodoro/Study sessions
- "quiz_score" — Average quiz % on AcedIt
- "quiz_count" — Number of AcedIt quizzes completed
- "flashcard_reviews" — Spaced Repetition reviews in AcedIt
- "study_sessions" — Sessions in AcedIt (Active Recall, Blurting, Exam Mode count here)

**RULES:**
1. Title = "[AcedIt Tool] + [specific content]"
2. Textbook/content study → study_hours (Pomodoro timer)
3. Memorisation/definitions → flashcard_reviews
4. Practice testing → quiz_count or quiz_score
5. Active Recall, Blurting, Exam Mode → study_sessions
6. subject_filter: ALWAYS "${subject_name || subject_code}"
7. XP: study_hours ~${targets.baseXP}XP, flashcards ~${Math.round(targets.baseXP * 0.3)}XP, quiz ~${Math.round(targets.baseXP * 0.7)}XP, sessions ~${Math.round(targets.baseXP * 0.6)}XP`
      : `You are an expert AcedIt study planner for VCE students. Generate 5-6 sub-goals all tracked automatically in AcedIt.

${contextBlock}
${toolExamples}
${noManualRule}

Goal title: "${title}"
Goal description: "${description}"

**AVAILABLE TYPES (no "manual"):**
- "study_hours" — Hours via AcedIt Pomodoro/Study sessions
- "quiz_score" — Average quiz % on AcedIt
- "quiz_count" — Quizzes completed on AcedIt
- "flashcard_reviews" — Spaced Repetition reviews in AcedIt
- "study_sessions" — Sessions in AcedIt (Active Recall, Blurting, Exam Mode)

RULES:
1. ALWAYS name the AcedIt tool in the title
2. Mix ALL types — never default to only study_hours
3. MUST include Active Recall, Blurting, OR Exam Mode (study_sessions type)
4. subject_filter: ALWAYS "${subject_name || subject_code}"

Structure for ${daysUntilTarget} days:
1. "Use Pomodoro timer to study [topic] content" → study_hours, target: ${targets.studyHours}
2. "Create and review flashcards for [key concepts]" → flashcard_reviews, target: ${targets.flashcardReviews}
3. "Log X Active Recall or Blurting sessions on [topic]" → study_sessions, target: ${Math.round(targets.studySessions * 0.5)}
4. "Complete AcedIt quizzes and score above ${targets.quizScoreTarget}%" → quiz_score, target: ${targets.quizScoreTarget}
5. "Take ${targets.quizCount} AcedIt practice quizzes" → quiz_count, target: ${targets.quizCount}
6. "Complete X Exam Mode timed sessions" → study_sessions, target: ${Math.round(targets.studySessions * 0.5)}`;

    const schema = hasUserSubGoals
      ? {
          type: "object",
          properties: {
            sub_goals_hierarchy: {
              type: "array",
              minItems: user_sub_goals.length,
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  ai_sub_goals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        xp_reward: { type: "number" },
                        steps: { type: "array", items: { type: "string" } },
                        type: {
                          type: "string",
                          enum: ["study_hours", "quiz_score", "quiz_count", "flashcard_reviews", "study_sessions"],
                        },
                        target: { type: "number" },
                        subject_filter: { type: "string" },
                        navigation: { type: "string", enum: ["Study", "Quizzes", "AITools"] },
                      },
                      required: ["title", "xp_reward", "steps", "type", "target", "navigation"],
                    },
                    minItems: 3,
                    maxItems: 5,
                  },
                },
                required: ["title", "ai_sub_goals"],
              },
            },
            total_xp_reward: { type: "number" },
            difficulty_level: { type: "string", enum: ["easy", "medium", "hard", "very_hard"] },
            tips: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 6 },
          },
          required: ["sub_goals_hierarchy", "total_xp_reward", "difficulty_level", "tips"],
        }
      : {
          type: "object",
          properties: {
            difficulty_level: { type: "string", enum: ["easy", "medium", "hard", "very_hard"] },
            sub_goals: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  xp_reward: { type: "number" },
                  steps: { type: "array", items: { type: "string" } },
                  type: {
                    type: "string",
                    enum: ["study_hours", "quiz_score", "quiz_count", "flashcard_reviews", "study_sessions"],
                  },
                  target: { type: "number" },
                  subject_filter: { type: "string" },
                  navigation: { type: "string", enum: ["Study", "Quizzes", "AITools"] },
                },
                required: ["title", "xp_reward", "steps", "type", "target", "navigation"],
              },
              minItems: 4,
              maxItems: 6,
            },
            total_xp_reward: { type: "number" },
            tips: { type: "array", items: { type: "string" } },
          },
          required: ["difficulty_level", "sub_goals", "total_xp_reward", "tips"],
        };

    const aiResponse = await callInvokeAI({ prompt: aiPrompt, response_json_schema: schema });

    let processedData;
    if (hasUserSubGoals) {
      processedData = {
        sub_goals_hierarchy: aiResponse.sub_goals_hierarchy,
        total_xp_reward: aiResponse.total_xp_reward,
        difficulty_level: aiResponse.difficulty_level,
        tips: aiResponse.tips,
        calibrated_targets: targets,
      };
    } else {
      const subGoalsWithIds = (aiResponse.sub_goals || []).map((sg, i) => ({
        id: `${Date.now()}_${i}`,
        title: sg.title,
        completed: false,
        xp_reward: sg.xp_reward,
        steps: sg.steps || [],
        type: sg.type,
        target: sg.target,
        current_progress: 0,
        subject_filter: sg.subject_filter || subject_name || subject_code,
        navigation: sg.navigation,
      }));
      processedData = {
        sub_goals: subGoalsWithIds,
        total_xp_reward: aiResponse.total_xp_reward,
        difficulty_level: aiResponse.difficulty_level,
        tips: aiResponse.tips,
        calibrated_targets: targets,
      };
    }

    return res.json(processedData);
  } catch (err) {
    console.error("[generateGoalWithAI] error:", err);
    return res.status(500).json({ error: err?.message || "Failed to generate goal with AI" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Competitions + Wagers cluster — Phase 3b ports (5 functions)
// ════════════════════════════════════════════════════════════════════════════

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ─── createGoalCompetition ─────────────────────────────────────────────────
// Create a study-hours competition seeded from an existing goal. Caps invites
// at 9 friends (10 participants total including creator).
app.post("/local-ai/fn/createGoalCompetition", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const { goal_id, invite_emails = [] } = req.body || {};
    if (!goal_id) return res.status(400).json({ error: "goal_id required" });

    const userEmail = user.email;

    const { data: goal, error: goalErr } = await supabaseAdmin
      .from("goals").select("*").eq("id", goal_id).maybeSingle();
    if (goalErr) throw goalErr;
    if (!goal || goal.created_by !== userEmail) {
      return res.status(404).json({ error: "Goal not found or not yours" });
    }

    // Reject if there's already an active/pending competition for this goal
    const { data: existingComps } = await supabaseAdmin
      .from("goal_competitions")
      .select("id, status")
      .eq("goal_id", goal_id)
      .eq("creator_email", userEmail);
    const activeComp = (existingComps || []).find(
      (c) => c.status === "active" || c.status === "pending",
    );
    if (activeComp) {
      return res.status(409).json({
        error: "A competition for this goal already exists",
        competition_id: activeComp.id,
      });
    }

    const { data: profileRows } = await supabaseAdmin
      .from("user_profiles").select("*").eq("created_by", userEmail).limit(1);
    const profile = profileRows?.[0];

    // Resolve subject from goal or user_subjects
    let subjectName = goal.subject_code || null;
    let subjectCode = goal.subject_code || null;
    if (goal.subject_code) {
      try {
        const { data: subjects } = await supabaseAdmin
          .from("user_subjects").select("*").eq("created_by", userEmail);
        const matched = (subjects || []).find((s) => s.subject_code === goal.subject_code);
        if (matched) {
          subjectName = matched.subject_name;
          subjectCode = matched.subject_code;
        }
      } catch (_) {}
    }

    const now = new Date().toISOString();
    const userFullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "";
    const subGoals = goal.sub_goals || [];

    const creator = {
      email: userEmail,
      name: userFullName,
      username: profile?.username || "",
      status: "accepted",
      joined_at: now,
      xp_earned: 0,
      study_minutes: 0,
      sub_goals_completed: subGoals.filter((sg) => sg.completed).length,
      sub_goals_total: subGoals.length,
      progress_percent: goal.progress || 0,
      bonus_xp_awarded: 0,
      last_activity: now,
    };

    const uniqueEmails = [...new Set(invite_emails.map((e) => e.toLowerCase()))]
      .filter((e) => e !== userEmail);
    if (uniqueEmails.length > 9) {
      return res.status(400).json({ error: "Maximum 9 friends can be invited" });
    }

    // Look up usernames for invitees via user_profiles (service-role bypasses RLS).
    // Falls back to email-prefix as name when no profile exists.
    const invitedParticipants = await Promise.all(uniqueEmails.map(async (email) => {
      let name = email.split("@")[0];
      let username = "";
      try {
        const { data: invitedRows } = await supabaseAdmin
          .from("user_profiles").select("username, full_name")
          .eq("created_by", email).limit(1);
        if (invitedRows?.[0]) {
          username = invitedRows[0].username || "";
          if (invitedRows[0].full_name) name = invitedRows[0].full_name;
        }
      } catch (_) {}
      return {
        email, name, username,
        status: "invited",
        xp_earned: 0,
        study_minutes: 0,
        sub_goals_completed: 0,
        sub_goals_total: subGoals.length,
        progress_percent: 0,
        bonus_xp_awarded: 0,
      };
    }));

    const { data: created, error: createErr } = await supabaseAdmin
      .from("goal_competitions")
      .insert({
        created_by: userEmail,
        goal_id,
        goal_title: goal.title,
        goal_description: goal.description || "",
        goal_category: goal.category || "academic",
        goal_target_date: goal.target_date || null,
        subject_name: subjectName,
        subject_code: subjectCode,
        competition_start_date: now,
        creator_email: userEmail,
        creator_name: userFullName,
        status: "active",
        participants: [creator, ...invitedParticipants],
        invite_code: generateInviteCode(),
        max_participants: 10,
        progress_bets: [],
      })
      .select()
      .single();
    if (createErr) throw createErr;

    return res.json({ success: true, competition: created });
  } catch (err) {
    console.error("[createGoalCompetition] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// ─── joinGoalCompetition ───────────────────────────────────────────────────
// Accept invite by competition_id or join via invite_code.
app.post("/local-ai/fn/joinGoalCompetition", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const { competition_id, invite_code, use_own_setup } = req.body || {};
    const userEmail = user.email;

    let comp;
    if (competition_id) {
      const { data } = await supabaseAdmin
        .from("goal_competitions").select("*").eq("id", competition_id).maybeSingle();
      comp = data;
    } else if (invite_code) {
      const { data } = await supabaseAdmin
        .from("goal_competitions").select("*")
        .eq("invite_code", String(invite_code).toUpperCase())
        .maybeSingle();
      comp = data;
    }

    if (!comp) return res.status(404).json({ error: "Competition not found" });
    if (comp.status !== "active" && comp.status !== "pending") {
      return res.status(400).json({ error: "Competition is not open" });
    }

    const participants = comp.participants || [];
    const existing = participants.find((p) => p.email === userEmail);
    if (existing && existing.status === "accepted") {
      return res.status(409).json({ error: "Already joined", competition: comp });
    }

    const { data: profileRows } = await supabaseAdmin
      .from("user_profiles").select("*").eq("created_by", userEmail).limit(1);
    const profile = profileRows?.[0];

    const subGoalCount = participants[0]?.sub_goals_total || 0;
    const useOwnSetup = use_own_setup === true;
    const userFullName = user.user_metadata?.full_name || userEmail?.split("@")[0] || "";
    const now = new Date().toISOString();

    const updatedParticipants = existing
      ? participants.map((p) =>
          p.email === userEmail
            ? { ...p, status: "accepted", joined_at: now, username: profile?.username || p.username, use_own_setup: useOwnSetup }
            : p,
        )
      : [
          ...participants,
          {
            email: userEmail,
            name: userFullName,
            username: profile?.username || "",
            status: "accepted",
            joined_at: now,
            xp_earned: 0,
            study_minutes: 0,
            sub_goals_completed: 0,
            sub_goals_total: subGoalCount,
            progress_percent: 0,
            bonus_xp_awarded: 0,
            last_activity: now,
            use_own_setup: useOwnSetup,
          },
        ];

    if (updatedParticipants.length > (comp.max_participants || 10)) {
      return res.status(400).json({ error: "Competition is full" });
    }

    const { error: updErr } = await supabaseAdmin
      .from("goal_competitions")
      .update({ participants: updatedParticipants })
      .eq("id", comp.id);
    if (updErr) throw updErr;

    return res.json({ success: true, competition_id: comp.id });
  } catch (err) {
    console.error("[joinGoalCompetition] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// ─── updateCompetitionProgress ─────────────────────────────────────────────
// Sync current user's accumulated study minutes (since competition_start_date)
// for the competition's subject, into the participants[].study_minutes field.
app.post("/local-ai/fn/updateCompetitionProgress", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const { competition_id } = req.body || {};
    if (!competition_id) return res.status(400).json({ error: "competition_id required" });

    const userEmail = user.email;

    const { data: comp, error: fetchErr } = await supabaseAdmin
      .from("goal_competitions").select("*").eq("id", competition_id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!comp) return res.status(404).json({ error: "Competition not found" });

    const participants = comp.participants || [];
    const me = participants.find((p) => p.email === userEmail);
    if (!me) return res.status(403).json({ error: "You are not in this competition" });

    const startDate = comp.competition_start_date
      ? new Date(comp.competition_start_date)
      : new Date(comp.created_date);
    const subjectFilter = comp.subject_name || comp.subject_code || null;

    const matchesSubject = (record) => {
      if (!subjectFilter) return true;
      const f = subjectFilter.toLowerCase();
      return (
        (record.subject || "").toLowerCase().includes(f) ||
        (record.subject_name || "").toLowerCase().includes(f)
      );
    };
    const afterStart = (record) => {
      const d = record.created_date ? new Date(record.created_date) : null;
      return d ? d >= startDate : false;
    };

    const [{ data: techs }, { data: sess }] = await Promise.all([
      supabaseAdmin.from("study_techniques").select("*").eq("created_by", userEmail),
      supabaseAdmin.from("study_sessions").select("*").eq("created_by", userEmail),
    ]);

    const techMinutes = (techs || [])
      .filter(afterStart).filter(matchesSubject)
      .reduce((sum, s) => sum + (s.session_duration || 0), 0);
    const sessMinutes = (sess || [])
      .filter(afterStart).filter(matchesSubject)
      .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const totalMinutes = techMinutes + sessMinutes;

    const now = new Date().toISOString();
    const updatedParticipants = participants.map((p) =>
      p.email === userEmail
        ? { ...p, study_minutes: totalMinutes, last_hours_sync: now, last_activity: now }
        : p,
    );

    const { error: updErr } = await supabaseAdmin
      .from("goal_competitions")
      .update({ participants: updatedParticipants })
      .eq("id", competition_id);
    if (updErr) throw updErr;

    return res.json({
      success: true,
      study_minutes: totalMinutes,
      study_hours: (totalMinutes / 60).toFixed(1),
      subject: subjectFilter,
      since: startDate.toISOString(),
    });
  } catch (err) {
    console.error("[updateCompetitionProgress] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// ─── settleHoursCompetition ────────────────────────────────────────────────
// Award bonus XP to participants based on final ranking by study minutes.
// XP rates: 1st=75/hr, 2nd=50/hr, 3rd=30/hr, 4th+=15/hr. Creator-only call.
app.post("/local-ai/fn/settleHoursCompetition", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const { competition_id } = req.body || {};
    if (!competition_id) return res.status(400).json({ error: "competition_id required" });

    const authHeader = req.headers.authorization || "";
    const userEmail = user.email;
    const XP_RATES = [75, 50, 30, 15];

    const { data: comp, error: fetchErr } = await supabaseAdmin
      .from("goal_competitions").select("*").eq("id", competition_id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!comp) return res.status(404).json({ error: "Competition not found" });
    if (comp.creator_email !== userEmail) {
      return res.status(403).json({ error: "Only the creator can settle" });
    }
    if (comp.status === "completed") {
      return res.status(400).json({ error: "Already settled" });
    }

    const participants = comp.participants || [];
    const accepted = participants
      .filter((p) => p.status === "accepted" || p.status === "completed")
      .sort((a, b) => (b.study_minutes || 0) - (a.study_minutes || 0));

    const results = [];
    for (let i = 0; i < accepted.length; i++) {
      const p = accepted[i];
      const rank = i + 1;
      const xpRate = XP_RATES[Math.min(i, XP_RATES.length - 1)];
      const hours = (p.study_minutes || 0) / 60;
      const bonusXP = Math.round(hours * xpRate);
      results.push({ email: p.email, name: p.name, rank, hours, xpRate, bonusXP });

      if (bonusXP > 0) {
        try {
          await callLocalFn(
            "awardXP",
            {
              source: "competition_bonus",
              event_key: `hours_comp_${competition_id}_${p.email}`,
              flat_xp: bonusXP,
            },
            authHeader,
          );
        } catch (e) {
          console.error(`[settleHoursCompetition] XP award error for ${p.email}:`, e?.message);
        }
      }
    }

    const winner = results[0];
    const updatedParticipants = participants.map((p) => {
      const r = results.find((x) => x.email === p.email);
      if (!r) return p;
      return { ...p, final_rank: r.rank, bonus_xp_awarded: r.bonusXP, status: "completed" };
    });

    const { error: updErr } = await supabaseAdmin
      .from("goal_competitions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        winner_email: winner?.email || "",
        winner_name: winner?.name || "",
        participants: updatedParticipants,
      })
      .eq("id", competition_id);
    if (updErr) throw updErr;

    return res.json({ success: true, results, winner });
  } catch (err) {
    console.error("[settleHoursCompetition] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// ─── resolveScoreWager ─────────────────────────────────────────────────────
// User enters their actual assessment score; settle the wager based on
// |predicted - actual|: exact (≤3) → 3× wager, close (≤10) → 1.5× wager,
// wrong → lose wagered XP. Caps at 500 wagered XP per call.
app.post("/local-ai/fn/resolveScoreWager", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const { wager_id, actual_score } = req.body || {};
    if (!wager_id || actual_score === undefined || actual_score === null) {
      return res.status(400).json({ error: "wager_id and actual_score required" });
    }
    if (actual_score < 0 || actual_score > 100) {
      return res.status(400).json({ error: "actual_score must be 0-100" });
    }

    const userEmail = user.email;
    const authHeader = req.headers.authorization || "";

    const { data: wager, error: wagerErr } = await supabaseAdmin
      .from("score_wagers").select("*")
      .eq("id", wager_id).eq("created_by", userEmail).maybeSingle();
    if (wagerErr) throw wagerErr;
    if (!wager) return res.status(404).json({ error: "Wager not found" });
    if (wager.status !== "active") {
      return res.status(400).json({ error: "Wager already resolved" });
    }

    const diff = Math.abs((wager.predicted_score || 0) - actual_score);
    let accuracy;
    if (diff <= 3) accuracy = "exact";
    else if (diff <= 10) accuracy = "close";
    else accuracy = "wrong";

    const wageredXP = wager.wagered_xp || 0;
    let xpOutcome;
    if (accuracy === "exact") xpOutcome = Math.round(wageredXP * 3);
    else if (accuracy === "close") xpOutcome = Math.round(wageredXP * 1.5);
    else xpOutcome = -wageredXP;

    const { data: profileRows } = await supabaseAdmin
      .from("user_profiles").select("*").eq("created_by", userEmail).limit(1);
    const profile = profileRows?.[0];
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    if (accuracy === "wrong") {
      // Direct deduction: floor at 0, mirror to leaderboard.
      const newXP = Math.max(0, (profile.total_xp || 0) + xpOutcome);
      const newSeasonXP = Math.max(0, (profile.season_xp || 0) + xpOutcome);
      await supabaseAdmin
        .from("user_profiles")
        .update({ total_xp: newXP, season_xp: newSeasonXP })
        .eq("id", profile.id);
      try {
        const { data: lbRows } = await supabaseAdmin
          .from("leaderboards").select("id").eq("user_email", userEmail).limit(1);
        if (lbRows?.[0]) {
          await supabaseAdmin
            .from("leaderboards")
            .update({
              total_xp: newXP,
              season_xp: newSeasonXP,
              last_updated: new Date().toISOString(),
            })
            .eq("id", lbRows[0].id);
        }
      } catch (e) {
        console.warn("[resolveScoreWager] leaderboard update failed:", e?.message);
      }
    } else {
      // Win path: route through awardXP so events + caps + leaderboard mirror are uniform.
      try {
        await callLocalFn(
          "awardXP",
          {
            source: "wager",
            event_key: `wager_${wager_id}`,
            wagered_xp: wageredXP,
            wager_accuracy: accuracy,
          },
          authHeader,
        );
      } catch (e) {
        console.error("[resolveScoreWager] awardXP error:", e?.message);
      }
    }

    await supabaseAdmin
      .from("score_wagers")
      .update({
        actual_score,
        accuracy,
        xp_outcome: xpOutcome,
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", wager_id);

    // Mirror score onto SubjectAssessment if the wager is linked to one.
    try {
      if (wager.assessment_id) {
        await supabaseAdmin
          .from("subject_assessments")
          .update({ actual_score, is_completed: true })
          .eq("id", wager.assessment_id)
          .eq("created_by", userEmail);
      }
    } catch (_) {}

    return res.json({
      success: true,
      accuracy,
      xp_outcome: xpOutcome,
      predicted: wager.predicted_score,
      actual: actual_score,
      diff,
      message:
        accuracy === "exact"
          ? `Perfect prediction. You earn ${xpOutcome} XP (3x your wager)`
          : accuracy === "close"
          ? `Close enough. You earn ${xpOutcome} XP (1.5x your wager)`
          : `Prediction missed. You lose ${wageredXP} XP`,
    });
  } catch (err) {
    console.error("[resolveScoreWager] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Support cluster — Phase 3b ports (1 function)
// ════════════════════════════════════════════════════════════════════════════

// ─── sendSupportTicket ─────────────────────────────────────────────────────
// Saves the ticket to support_tickets, then fires two Resend emails: admin
// notification to ADMIN_EMAIL and confirmation back to the user. Email
// failures are logged but never fail the request — the ticket is the source
// of truth.
// ════════════════════════════════════════════════════════════════════════════
// Weekly Leagues — read endpoints for the Ranked page
// ════════════════════════════════════════════════════════════════════════════

// GET /local-ai/fn/getLeagueStanding
// Returns the user's current league membership + the full group leaderboard
// (up to 30 rows). Auto-creates the membership on first call.
app.post("/local-ai/fn/getLeagueStanding", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const profile = await loadUserProfile(user.email);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const mem = await ensureCurrentLeagueMembership(user.email, profile);
    if (!mem) return res.status(500).json({ error: "Could not place in league" });

    // Pull all members of my group + the user_profile data we want to show.
    const { data: groupMembers, error: gmErr } = await supabaseAdmin
      .from('league_memberships')
      .select('id, user_email, weekly_xp, is_anonymous, joined_at')
      .eq('league_group_id', mem.league_group_id)
      .order('weekly_xp', { ascending: false });
    if (gmErr) throw gmErr;

    // Hydrate username + streak per member (fast lookup).
    const emails = (groupMembers || []).map(m => m.user_email);
    let profiles = [];
    if (emails.length) {
      const { data: pData } = await supabaseAdmin
        .from('user_profiles')
        .select('created_by, username, full_name, streak_days, total_xp')
        .in('created_by', emails);
      profiles = pData || [];
    }
    const byEmail = Object.fromEntries(profiles.map(p => [p.created_by, p]));

    const rows = (groupMembers || []).map((m, i) => {
      const p = byEmail[m.user_email] || {};
      const isMe = m.user_email === user.email;
      const displayName = m.is_anonymous && !isMe
        ? `Anon #${(m.id || '').slice(-4)}`
        : (p.username || p.full_name || (m.user_email?.split('@')[0]) || 'Student');
      return {
        position:        i + 1,
        user_email:      isMe ? user.email : null,   // never leak others' emails
        is_me:           isMe,
        display_name:    displayName,
        weekly_xp:       m.weekly_xp ?? 0,
        streak_days:     p.streak_days ?? 0,
        total_xp:        p.total_xp ?? 0,
        is_anonymous:    m.is_anonymous,
      };
    });

    // League_group meta
    const { data: groupRow } = await supabaseAdmin
      .from('league_groups')
      .select('id, tier, week_start, member_count')
      .eq('id', mem.league_group_id)
      .maybeSingle();

    // Compute reset time = next Monday 00:00 UTC
    const weekStart = new Date(`${groupRow?.week_start || mem.week_start}T00:00:00Z`);
    const resetsAt = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    return res.json({
      success: true,
      group: {
        id:           groupRow?.id || mem.league_group_id,
        tier:         groupRow?.tier || mem.tier,
        week_start:   groupRow?.week_start || mem.week_start,
        resets_at:    resetsAt.toISOString(),
        member_count: groupRow?.member_count || rows.length,
        promote_count: LEAGUE_PROMOTE_COUNT,
        demote_count:  LEAGUE_DEMOTE_COUNT,
        group_size:    LEAGUE_GROUP_SIZE,
      },
      me: {
        user_email:   user.email,
        position:     rows.find(r => r.is_me)?.position || null,
        weekly_xp:    mem.weekly_xp ?? 0,
        tier:         mem.tier,
        is_anonymous: mem.is_anonymous,
        lifetime_promotes: profile.league_lifetime_promotes ?? 0,
        lifetime_demotes:  profile.league_lifetime_demotes ?? 0,
      },
      rows,
    });
  } catch (err) {
    console.error("[getLeagueStanding] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// POST /local-ai/fn/setLeagueAnonymity { is_anonymous: boolean }
// Toggle the user's anonymity on the league leaderboard. Affects both the
// current membership row AND the user_profile default for future weeks.
app.post("/local-ai/fn/setLeagueAnonymity", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const { is_anonymous } = req.body || {};
    const anon = !!is_anonymous;
    const weekStart = currentWeekStartUTC();

    await supabaseAdmin
      .from('league_memberships')
      .update({ is_anonymous: anon, updated_at: new Date().toISOString() })
      .eq('user_email', user.email)
      .eq('week_start', weekStart);

    await supabaseAdmin
      .from('user_profiles')
      .update({ league_anonymous_default: anon })
      .eq('created_by', user.email);

    return res.json({ success: true, is_anonymous: anon });
  } catch (err) {
    console.error("[setLeagueAnonymity] error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

app.post("/local-ai/fn/sendSupportTicket", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

  try {
    const { issueType, location, description, screenshotUrl } = req.body || {};
    if (!issueType || !location || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let userProfile = null;
    try {
      const { data } = await supabaseAdmin
        .from("user_profiles").select("*")
        .eq("created_by", user.email).limit(1);
      userProfile = data?.[0] || null;
    } catch (_) {}

    const userFullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Unknown";

    const { data: ticket, error: insertErr } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        created_by: user.email,
        subject: `${issueType} - ${location}`,
        body: description,
        category: "bug",
        status: "open",
        extra: {
          issue_type: issueType,
          location,
          screenshot_url: screenshotUrl || null,
          user_email: user.email,
          user_name: userFullName,
          username: userProfile?.username || null,
          subscription_tier: userProfile?.subscription_tier || "free",
          submitted_at_local: new Date().toISOString(),
        },
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    const ticketShort = ticket.id.slice(0, 8);
    const emailResults = { admin: null, user: null };

    // If the user uploaded a screenshot, the frontend got back a `local-file://`
    // URL that points into our in-memory fileStore. Pull the bytes out so we
    // can attach them to the admin email (the URL itself isn't fetchable from
    // outside the server).
    let screenshotAttachment = null;
    if (screenshotUrl && typeof screenshotUrl === "string" && screenshotUrl.startsWith("local-file://")) {
      const fid = screenshotUrl.slice("local-file://".length);
      const fileEntry = fileStore.get(fid);
      if (fileEntry) {
        screenshotAttachment = {
          filename: fileEntry.originalName || `screenshot-${ticketShort}.png`,
          content: fileEntry.buffer.toString("base64"),
        };
      }
    }

    if (resend) {
      const descHtml = escapeHtml(description).replace(/\n/g, "<br>");
      const userFirst = escapeHtml((userFullName || "").split(" ")[0] || "there");
      const username = escapeHtml(userProfile?.username || "—");
      const tier = escapeHtml(userProfile?.subscription_tier || "free");
      const fromName = escapeHtml(userFullName);
      const fromEmail = escapeHtml(user.email);
      const issueEsc = escapeHtml(issueType);
      const locEsc = escapeHtml(location);

      // Email layout uses tables + inline styles for cross-client safety
      // (Outlook, Apple Mail, Gmail). No external CSS, no flexbox.
      const adminHtml = `
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f4f4f5;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
          <tr><td align="center">
            <table cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
              <tr><td style="background:#58CC02;padding:20px 24px">
                <div style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;opacity:0.9">New support ticket</div>
                <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:4px">${issueEsc} · ${locEsc}</div>
              </td></tr>
              <tr><td style="padding:24px">
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:14px;color:#27272a">
                  <tr><td style="padding:6px 0;color:#71717a;width:110px">From</td><td style="padding:6px 0">${fromName} &lt;${fromEmail}&gt;</td></tr>
                  <tr><td style="padding:6px 0;color:#71717a">Username</td><td style="padding:6px 0">${username}</td></tr>
                  <tr><td style="padding:6px 0;color:#71717a">Tier</td><td style="padding:6px 0">${tier}</td></tr>
                  <tr><td style="padding:6px 0;color:#71717a">Submitted</td><td style="padding:6px 0">${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</td></tr>
                </table>
                <div style="margin-top:20px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px">Description</div>
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:8px">
                  <tr>
                    <td style="width:4px;background:#58CC02;border-radius:2px"></td>
                    <td style="padding:12px 16px;background:#fafafa;border-radius:0 6px 6px 0;font-size:14px;line-height:1.6;color:#27272a">${descHtml}</td>
                  </tr>
                </table>
                ${screenshotAttachment ? `<div style="margin-top:20px;padding:12px 16px;background:#fef9c3;border-radius:6px;font-size:13px;color:#713f12">Screenshot attached to this email.</div>` : (screenshotUrl ? `<div style="margin-top:20px;padding:12px 16px;background:#fee2e2;border-radius:6px;font-size:13px;color:#7f1d1d">User uploaded a screenshot but the server couldn't retrieve it (likely the file expired from memory). Ticket ID below to look up manually.</div>` : "")}
              </td></tr>
              <tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a">
                <div>Ticket ID: <code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f4f4f5;padding:2px 6px;border-radius:4px">${ticket.id}</code></div>
                <div style="margin-top:6px">Reply directly to this email to respond to the user.</div>
              </td></tr>
            </table>
          </td></tr>
        </table>`;

      try {
        const sendArgs = {
          from: SUPPORT_FROM,
          to: ADMIN_EMAIL,
          replyTo: user.email,
          subject: `[AcedIt #${ticketShort}] ${issueType} - ${location}`,
          html: adminHtml,
        };
        if (screenshotAttachment) sendArgs.attachments = [screenshotAttachment];
        const r = await resend.emails.send(sendArgs);
        emailResults.admin = { ok: !r.error, id: r.data?.id, error: r.error?.message || null };
      } catch (e) {
        emailResults.admin = { ok: false, error: e?.message || String(e) };
      }

      const userHtml = `
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f4f4f5;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
          <tr><td align="center">
            <table cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
              <tr><td style="padding:32px 28px 8px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:#58CC02;letter-spacing:-0.5px">AcedIt</div>
              </td></tr>
              <tr><td style="padding:8px 28px 24px">
                <p style="margin:0 0 12px;font-size:16px;color:#18181b">Hey ${userFirst},</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#27272a">Got your message — thanks for letting us know. We'll take a look and get back to you when we can.</p>
                <div style="margin-top:8px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px">What you sent</div>
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:8px">
                  <tr>
                    <td style="width:4px;background:#58CC02;border-radius:2px"></td>
                    <td style="padding:12px 16px;background:#fafafa;border-radius:0 6px 6px 0;font-size:14px;line-height:1.6;color:#27272a">
                      <div style="font-weight:600;margin-bottom:6px">${issueEsc} · ${locEsc}</div>
                      ${descHtml}
                    </td>
                  </tr>
                </table>
              </td></tr>
              <tr><td style="padding:16px 28px 24px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:13px;color:#71717a;text-align:center">
                Ticket reference: <code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#ffffff;padding:2px 6px;border-radius:4px;border:1px solid #e4e4e7">#${ticketShort}</code>
              </td></tr>
            </table>
          </td></tr>
        </table>`;

      try {
        const r = await resend.emails.send({
          from: SUPPORT_FROM,
          to: user.email,
          replyTo: ADMIN_EMAIL,
          subject: `We got your message — AcedIt support #${ticketShort}`,
          html: userHtml,
        });
        emailResults.user = { ok: !r.error, id: r.data?.id, error: r.error?.message || null };
      } catch (e) {
        emailResults.user = { ok: false, error: e?.message || String(e) };
      }

      console.log(
        `[sendSupportTicket] ticket=${ticketShort} admin_email=${emailResults.admin?.ok ? "ok" : "fail"} user_email=${emailResults.user?.ok ? "ok" : "fail"} screenshot_attached=${!!screenshotAttachment}` +
        (emailResults.admin?.error ? ` admin_err="${emailResults.admin.error}"` : "") +
        (emailResults.user?.error ? ` user_err="${emailResults.user.error}"` : ""),
      );
    } else {
      console.warn(`[sendSupportTicket] ticket=${ticketShort} saved but RESEND_API_KEY not set — no emails sent.`);
    }

    return res.json({
      success: true,
      message: "Support ticket submitted successfully",
      ticket_id: ticket.id,
      emailStatus: {
        admin: emailResults.admin,
        user: emailResults.user,
        allSent: !!(emailResults.admin?.ok && emailResults.user?.ok),
      },
    });
  } catch (err) {
    console.error("[sendSupportTicket] error:", err);
    return res.status(500).json({ error: err?.message || "Failed to submit support ticket" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Stripe cluster — Phase 3b ports (4 functions)
// ════════════════════════════════════════════════════════════════════════════

// ─── stripeCheckout ────────────────────────────────────────────────────────
// Creates (or reuses) a Stripe customer for the user, then creates a checkout
// session for a price (priceId). Returns { checkoutUrl } for the frontend to
// redirect to.
app.post("/local-ai/fn/stripeCheckout", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

  try {
    const { priceId, successUrl, cancelUrl, trial_days } = req.body || {};
    if (!priceId) return res.status(400).json({ error: "Missing priceId" });

    const userEmail = user.email;
    const userFullName = user.user_metadata?.full_name || userEmail?.split("@")[0] || "";

    // Get or create Stripe customer for this email.
    const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
    const customer = existing.data[0]
      ? existing.data[0]
      : await stripe.customers.create({
          email: userEmail,
          name: userFullName,
          metadata: { user_id: user.id, user_email: userEmail },
        });

    const sessionParams = {
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { user_id: user.id, user_email: userEmail },
      allow_promotion_codes: true,
    };
    if (typeof trial_days === "number" && trial_days > 0) {
      sessionParams.subscription_data = { trial_period_days: trial_days };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("[stripeCheckout] error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Checkout failed" });
  }
});

// ─── stripePortal ──────────────────────────────────────────────────────────
// Creates a Stripe Billing Portal session so the user can manage their
// subscription (cancel, update card, etc.).
app.post("/local-ai/fn/stripePortal", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

  try {
    const { returnUrl } = req.body || {};
    const userEmail = user.email;

    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length === 0) {
      return res.status(404).json({ error: "No Stripe customer found. Please subscribe first." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: returnUrl,
    });
    return res.json({ portalUrl: session.url });
  } catch (err) {
    console.error("[stripePortal] error:", err?.message || err);
    return res.status(500).json({
      error: err?.message || "Failed to create portal session",
      details: err?.type || "stripe_error",
    });
  }
});

// ─── verifySubscription ────────────────────────────────────────────────────
// After the user completes Stripe Checkout, the success page calls this with
// the sessionId. Server verifies payment and upgrades the profile to premium.
// Belt-and-braces with the webhook, which also fires on completion.
app.post("/local-ai/fn/verifySubscription", async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ success: false, error: "Unauthorized" });
  if (!stripe) return res.status(500).json({ success: false, error: "Stripe not configured" });
  if (!supabaseAdmin) return res.status(500).json({ success: false, error: "Supabase admin not configured" });

  try {
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ success: false, error: "No sessionId provided" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.json({ success: false, error: "Payment not completed", payment_status: session.payment_status });
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    // Use exactly 30 days from now as expiry (matches Base44 behaviour).
    const subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const updatePayload = {
      subscription_tier: "premium",
      subscription_active: true,
      subscription_expires_at: subscriptionEndDate.toISOString(),
      user_role: "premium_user",
      ai_credits: 999999,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: session.customer,
    };

    const { data: existingRows } = await supabaseAdmin
      .from("user_profiles").select("id").eq("created_by", user.email).limit(1);

    if (existingRows?.[0]) {
      await supabaseAdmin
        .from("user_profiles")
        .update(updatePayload)
        .eq("id", existingRows[0].id);
    } else {
      await supabaseAdmin
        .from("user_profiles")
        .insert({ ...updatePayload, created_by: user.email });
    }

    return res.json({
      success: true,
      tier: "premium",
      expires_at: subscriptionEndDate.toISOString(),
    });
  } catch (err) {
    console.error("[verifySubscription] error:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "Verification failed" });
  }
});

// ─── stripe-webhook ────────────────────────────────────────────────────────
// Stripe → us. Fires on checkout completion, subscription updates, and
// cancellations. Must verify signature using the raw request body, hence the
// special `express.raw` middleware mounted above for this path.
//
// IMPORTANT: this endpoint does NOT use authenticateRequest — Stripe is the
// caller, not a logged-in user. Trust comes from the signature check.
app.post("/local-ai/fn/stripe-webhook", async (req, res) => {
  if (!stripe) return res.status(500).send("Stripe not configured");
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set");
    return res.status(500).send("Webhook secret not configured");
  }
  if (!supabaseAdmin) return res.status(500).send("Supabase admin not configured");

  const signature = req.headers["stripe-signature"];
  if (!signature) return res.status(400).send("Missing Stripe signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err?.message);
    return res.status(400).send("Invalid webhook signature");
  }

  console.log(`[stripe-webhook] received: ${event.type}`);

  async function findProfileByEmail(email) {
    const { data } = await supabaseAdmin
      .from("user_profiles").select("id").eq("created_by", email).limit(1);
    return data?.[0] || null;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userEmail = session?.metadata?.user_email;
      if (!userEmail) {
        console.error("[stripe-webhook] no user_email in session metadata");
        return res.status(400).send("Missing user email");
      }

      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const subscriptionEndDate = new Date(subscription.current_period_end * 1000);

      // Idempotency: if already processed this exact subscription as premium, no-op.
      const profile = await findProfileByEmail(userEmail);
      if (profile) {
        const { data: full } = await supabaseAdmin
          .from("user_profiles")
          .select("stripe_subscription_id, subscription_tier")
          .eq("id", profile.id).single();
        if (full?.stripe_subscription_id === subscription.id && full?.subscription_tier === "premium") {
          return res.json({ success: true, message: "Already processed" });
        }
      }

      const payload = {
        subscription_tier: "premium",
        subscription_active: true,
        user_role: "premium_user",
        ai_credits: 999999,
        subscription_expires_at: subscriptionEndDate.toISOString(),
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer,
      };

      if (profile) {
        await supabaseAdmin.from("user_profiles").update(payload).eq("id", profile.id);
        console.log(`[stripe-webhook] upgraded ${userEmail} to premium`);
      } else {
        await supabaseAdmin.from("user_profiles").insert({ ...payload, created_by: userEmail });
        console.log(`[stripe-webhook] created premium profile for ${userEmail}`);
      }
      return res.json({ success: true, upgraded: userEmail });
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const customer = await stripe.customers.retrieve(subscription.customer);
      const userEmail = customer?.email;
      if (!userEmail) return res.status(400).send("Missing customer email");

      const profile = await findProfileByEmail(userEmail);
      if (profile) {
        const isActive = subscription.status === "active";
        await supabaseAdmin.from("user_profiles").update({
          subscription_tier: isActive ? "premium" : "free",
          subscription_active: isActive,
          user_role: isActive ? "premium_user" : "free_user",
          ai_credits: isActive ? 999999 : 500,
          subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq("id", profile.id);
        console.log(`[stripe-webhook] subscription update for ${userEmail}: ${subscription.status}`);
      }
      return res.json({ success: true });
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customer = await stripe.customers.retrieve(subscription.customer);
      const userEmail = customer?.email;
      if (!userEmail) return res.status(200).send("OK");

      const profile = await findProfileByEmail(userEmail);
      if (profile) {
        await supabaseAdmin.from("user_profiles").update({
          subscription_tier: "free",
          subscription_active: false,
          user_role: "free_user",
          ai_credits: 500,
          subscription_expires_at: null,
        }).eq("id", profile.id);
        console.log(`[stripe-webhook] downgraded ${userEmail} to free`);
      }
      return res.json({ success: true });
    }

    // Other events: acknowledge so Stripe doesn't retry forever.
    return res.json({ success: true, ignored: event.type });
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return res.status(500).json({ error: err?.message || "Handler error" });
  }
});

// ─── Static file serving (production) ─────────────────────────────────────
// In production we serve the Vite-built React app from the same Node service.
// Locally `npm run dev` uses Vite's dev server on :5173 and proxies API calls
// to this server on :3001 — `dist/` doesn't exist there and that's fine.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist");

if (existsSync(distDir)) {
  console.log(`[local-ai] serving static build from ${distDir}`);
  app.use(express.static(distDir, { maxAge: "1h", index: false }));
  // SPA fallback — every non-API request returns index.html so react-router
  // takes over on the client. Express 5 requires a named splat ("*splat") and
  // no longer accepts the bare "*". Anything starting with /local-ai/ or /api/
  // is already matched above by the API handlers, so it won't reach here.
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/local-ai/") || req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(join(distDir, "index.html"));
  });
} else {
  console.log(`[local-ai] no dist/ directory — running API-only (dev mode)`);
}

app.listen(PORT, () => {
  console.log(`[local-ai] listening on http://localhost:${PORT} (model: ${MODEL})`);
});
