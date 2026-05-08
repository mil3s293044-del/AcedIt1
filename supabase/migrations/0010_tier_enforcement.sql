-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0010 — tier enforcement counters
--
-- Adds the columns the new tier system needs:
--  • free_ai_quizzes_used / free_ai_flashcards_used
--      Lifetime counters for the free tier (cap = 3 each).
--  • daily_ai_counters
--      Per-day usage per feature, with the date stamp baked in so we know
--      when to reset. Stored as jsonb for flexibility — schema:
--        { date: 'YYYY-MM-DD',
--          quizzes: int, flashcards: int, tools: int, marker: int, goal: int }
--      Server reads this, resets it to today's date if stale, increments,
--      writes back.
--  • monthly_ai_cost_cents / monthly_cost_period_start
--      Rolling monthly $6 ceiling backstop. Server estimates dollar cost
--      from the Anthropic usage tokens and increments per call. period_start
--      tells us when the current calendar month started so we can reset.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.user_profiles
  add column if not exists free_ai_quizzes_used      int    not null default 0,
  add column if not exists free_ai_flashcards_used   int    not null default 0,
  add column if not exists daily_ai_counters         jsonb  not null default '{"date":null,"quizzes":0,"flashcards":0,"tools":0,"marker":0,"goal":0}'::jsonb,
  add column if not exists monthly_ai_cost_cents     int    not null default 0,
  add column if not exists monthly_cost_period_start date   not null default (date_trunc('month', now()))::date;

comment on column public.user_profiles.free_ai_quizzes_used      is 'Free-tier lifetime counter — AI quiz generations consumed (cap=3).';
comment on column public.user_profiles.free_ai_flashcards_used   is 'Free-tier lifetime counter — AI flashcard generations consumed (cap=3).';
comment on column public.user_profiles.daily_ai_counters         is 'Premium per-day usage per feature; resets each calendar day.';
comment on column public.user_profiles.monthly_ai_cost_cents     is 'Premium rolling monthly cost in cents — backstop ceiling at 600 (=$6).';
comment on column public.user_profiles.monthly_cost_period_start is 'First day of the current cost-tracking month; resets when month rolls over.';
