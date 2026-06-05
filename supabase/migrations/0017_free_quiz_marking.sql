-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0017 — free-tier AI quiz marking counter
--
-- Gives free users a lifetime allowance of AI quiz marks (cap = 5), to
-- complement the existing 5 lifetime AI quiz generations. Adds the counter
-- column the tier system reads/increments.
--
-- Also adds free_ai_tools_used defensively — the tier code has always
-- referenced it (free AI-tools / chat counter) but no earlier migration
-- created it. `if not exists` makes this a no-op if it's already present.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.user_profiles
  add column if not exists free_ai_quiz_marks_used int not null default 0,
  add column if not exists free_ai_tools_used      int not null default 0;

comment on column public.user_profiles.free_ai_quiz_marks_used is 'Free-tier lifetime counter — AI quiz markings consumed (cap=5).';
comment on column public.user_profiles.free_ai_tools_used      is 'Free-tier lifetime counter — AI study tool / chat uses consumed (cap=5).';
