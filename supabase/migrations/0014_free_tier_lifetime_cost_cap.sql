-- ─── 0014: lifetime AI cost ceiling for free-tier users ──────────────────
-- The free tier already has per-feature lifetime count caps (e.g. 5 quizzes
-- lifetime). But because quiz/flashcard gens read user-uploaded files, a
-- single user with massive notes could rack up surprisingly high compute
-- spend even within the count caps. This adds a $1.00 (100 cents) hard
-- ceiling per free user, lifetime — whichever they hit first (count cap or
-- cost cap) blocks them.
--
-- Premium users are unaffected — they keep the existing weekly $2.50 cap.

alter table public.user_profiles
    add column if not exists lifetime_ai_cost_cents integer not null default 0;

create index if not exists user_profiles_lifetime_cost_idx
    on public.user_profiles (lifetime_ai_cost_cents);
