-- 0033 — one weekly stack of chips, replacing eleven per-feature daily caps.
--
-- The app had two limits, sized separately, that contradicted each other:
-- per-feature daily counters and a weekly dollar ceiling. Priced against the
-- real cost table, maxing every daily cap for a week came to 4.5x what the
-- dollar ceiling permitted, so a heavy student hit the money wall on day two
-- having been told all week they had three quizzes a day, and a light student
-- could not do a big Saturday session on 15% of their budget.
--
-- Chips are one pool, spent however the student likes, at published prices.
--
--   weekly_chips_spent   the user-facing ledger and the gate. Prices are
--                        fixed and rounded up from measured cost, so a full
--                        stack always costs us LESS than the ceiling.
--
-- weekly_ai_cost_micros is untouched and keeps doing its job: recording what
-- calls actually cost, and backstopping the chip gate. If a price in
-- src/lib/chips.js is ever set below its real cost, the micro ceiling still
-- catches it. Belt and braces on the one thing that must not fail.
--
-- Nullable-with-default rather than backfilled: chipsSpent() derives a chip
-- count from the existing micro ledger for any row still sitting at zero, so
-- students mid-week keep the spend they have already made instead of being
-- handed a fresh stack the day this deploys.

alter table public.user_profiles
    add column if not exists weekly_chips_spent int not null default 0;

-- Burst protection, which is the one useful job the daily caps were doing.
-- A rolling window rather than a per-feature count: {"since": iso, "chips": n}.
-- Stored as jsonb so the shape can change without another migration.
alter table public.user_profiles
    add column if not exists ai_burst jsonb not null default '{}'::jsonb;

comment on column public.user_profiles.weekly_chips_spent is
    'Chips spent this week against the 1000-chip stack. Reset by the same weekly_cost_period_start rollover as weekly_ai_cost_micros. See src/lib/chips.js.';
comment on column public.user_profiles.ai_burst is
    'Rolling burst window for rate limiting: {"since": iso8601, "chips": int}. Replaces the per-feature daily caps as anti-abuse.';
