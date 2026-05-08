-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0011 — switch the cost ceiling from monthly to weekly.
--
-- Pricing changed from $9.99/month subscription to $5/week, and the AI cost
-- ceiling shrinks from $6/month to $2.50/week. We add NEW columns rather than
-- renaming the existing monthly_* ones so old code that still references them
-- doesn't blow up mid-deploy. The monthly columns are now unused but harmless.
--
--  • weekly_ai_cost_cents       — rolling weekly cost in cents, cap = 250 (=$2.50)
--  • weekly_cost_period_start   — first day (Monday) of the current week
--                                 ISO week starts Monday everywhere we operate.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.user_profiles
  add column if not exists weekly_ai_cost_cents     int  not null default 0,
  add column if not exists weekly_cost_period_start date not null
      -- date_trunc('week', ...) returns the Monday at 00:00 in Postgres ISO weeks
      default (date_trunc('week', now()))::date;

comment on column public.user_profiles.weekly_ai_cost_cents     is 'Premium rolling weekly cost in cents — backstop ceiling at 250 (=$2.50).';
comment on column public.user_profiles.weekly_cost_period_start is 'Monday of the current cost-tracking week; resets when the week rolls over.';
