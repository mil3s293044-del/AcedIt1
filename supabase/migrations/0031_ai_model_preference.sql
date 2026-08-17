-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0031 — let premium students choose how fast they spend the week.
--
-- The weekly ceiling is denominated in dollars, so the model a student's work
-- runs on decides how much work that dollar buys. Sonnet is $3/$15 per million
-- tokens and Haiku is $1/$5 — exactly a third — so a week that runs out on
-- Thursday in Standard reaches Sunday in Saver.
--
--   standard  the default. Best quality, ceiling arrives sooner.
--   saver     roughly 3x more work from the same ceiling, shorter answers.
--
-- Deliberately NOT auto-switched by the server. Quietly downgrading someone's
-- output to protect a budget they cannot see is how an app gets a reputation
-- for having "got worse", with no way for the student to find out why.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.user_profiles
  add column if not exists ai_model_preference text not null default 'standard';

-- Constrained rather than free text: this value picks a model id on the server,
-- and an unrecognised one there falls back to the dearest rate in the price
-- table, which would be a silent bill rather than a visible error.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_ai_model_preference_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_ai_model_preference_check
      check (ai_model_preference in ('standard', 'saver'));
  end if;
end $$;

comment on column public.user_profiles.ai_model_preference is
  'Which model tier this student''s AI work runs on: standard (Sonnet) or saver (Haiku, ~3x more per dollar).';
