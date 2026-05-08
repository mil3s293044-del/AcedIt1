-- ════════════════════════════════════════════════════════════════════════════
-- Phase 3b-1 — Tier 1 tables (top-10 highest-traffic entities).
--
-- Tables added by this migration:
--   1. quizzes              — user-owned
--   2. quiz_attempts        — user-owned (FK quizzes)
--   3. goals                — user-owned
--   4. study_sessions       — user-owned
--   5. flashcards           — user-owned (SM-2 spaced-repetition fields)
--   6. friendships          — multi-user RLS (requester OR recipient)
--   7. leaderboards         — public-read; per-user write
--   8. ai_saved_results     — user-owned
--   9. study_techniques     — user-owned
--  10. user_subjects        — user-owned
--
-- Pattern reference (all user-owned tables):
--   • id            uuid pk default gen_random_uuid()
--   • created_by    text not null   ← matches Base44's email-based ownership
--   • created_date  timestamptz default now()
--   • updated_date  timestamptz default now() with touch trigger (from 0001)
--   • extra         jsonb default '{}'  ← catch-all for fields I missed
--   • RLS: select/update/delete using (created_by = auth.email());
--          insert with check (created_by = auth.email())
--
-- Patterns deviating from the standard:
--   • friendships  — requester OR recipient can read/update; only requester deletes
--   • leaderboards — anyone authenticated can SELECT; user can only write own row
--                    (uses user_email column instead of created_by)
--
-- Field inference: based on grep of every `.create(...)` and `.update(...)` call
-- site in src/. Conservative — anything not seen explicitly lives in `extra`.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. quizzes ────────────────────────────────────────────────────────────
create table public.quizzes (
    id              uuid primary key default gen_random_uuid(),
    created_by      text not null,
    created_date    timestamptz not null default now(),
    updated_date    timestamptz not null default now(),

    title           text not null,
    subject         text,
    subject_code    text,
    questions       jsonb not null default '[]'::jsonb,
    difficulty      text default 'intermediate',
    category        text default 'subject_content',
    source_file_url text,

    extra           jsonb not null default '{}'::jsonb
);
create index quizzes_created_by_idx on public.quizzes (created_by);
create index quizzes_subject_idx on public.quizzes (created_by, subject);
create trigger quizzes_touch_updated before update on public.quizzes
    for each row execute function public.touch_updated_date();

alter table public.quizzes enable row level security;
create policy "quizzes_select_own"  on public.quizzes for select using (created_by = auth.email());
create policy "quizzes_insert_own"  on public.quizzes for insert with check (created_by = auth.email());
create policy "quizzes_update_own"  on public.quizzes for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "quizzes_delete_own"  on public.quizzes for delete using (created_by = auth.email());


-- ─── 2. quiz_attempts ──────────────────────────────────────────────────────
create table public.quiz_attempts (
    id                 uuid primary key default gen_random_uuid(),
    created_by         text not null,
    created_date       timestamptz not null default now(),
    updated_date       timestamptz not null default now(),

    quiz_id            uuid references public.quizzes(id) on delete set null,
    quiz_title         text,
    quiz_category      text,
    score              numeric,
    questions_total    int,
    questions_correct  int,
    time_taken         int,                 -- seconds
    xp_earned          int,
    user_answers       jsonb not null default '[]'::jsonb,
    date               date,

    extra              jsonb not null default '{}'::jsonb
);
create index quiz_attempts_created_by_idx on public.quiz_attempts (created_by);
create index quiz_attempts_quiz_id_idx    on public.quiz_attempts (quiz_id);
create index quiz_attempts_date_idx       on public.quiz_attempts (created_by, date desc);
create trigger quiz_attempts_touch_updated before update on public.quiz_attempts
    for each row execute function public.touch_updated_date();

alter table public.quiz_attempts enable row level security;
create policy "quiz_attempts_select_own" on public.quiz_attempts for select using (created_by = auth.email());
create policy "quiz_attempts_insert_own" on public.quiz_attempts for insert with check (created_by = auth.email());
create policy "quiz_attempts_update_own" on public.quiz_attempts for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "quiz_attempts_delete_own" on public.quiz_attempts for delete using (created_by = auth.email());


-- ─── 3. goals ──────────────────────────────────────────────────────────────
create table public.goals (
    id                  uuid primary key default gen_random_uuid(),
    created_by          text not null,
    created_date        timestamptz not null default now(),
    updated_date        timestamptz not null default now(),

    title               text not null,
    description         text,
    target_date         date,
    category            text,
    subject_code        text,
    priority            text check (priority in ('low','medium','high')) default 'medium',
    milestone_type      text,
    success_criteria    text,
    sub_goals           jsonb not null default '[]'::jsonb,
    tips                jsonb not null default '[]'::jsonb,
    total_xp_reward     int default 0,
    difficulty_level    text default 'medium',
    is_ai_generated     boolean not null default false,
    progress            numeric not null default 0,
    is_completed        boolean not null default false,
    completed_at        timestamptz,
    tracking_start_date timestamptz,

    extra               jsonb not null default '{}'::jsonb
);
create index goals_created_by_idx       on public.goals (created_by);
create index goals_completed_idx        on public.goals (created_by, is_completed);
create index goals_subject_code_idx     on public.goals (created_by, subject_code);
create trigger goals_touch_updated before update on public.goals
    for each row execute function public.touch_updated_date();

alter table public.goals enable row level security;
create policy "goals_select_own" on public.goals for select using (created_by = auth.email());
create policy "goals_insert_own" on public.goals for insert with check (created_by = auth.email());
create policy "goals_update_own" on public.goals for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "goals_delete_own" on public.goals for delete using (created_by = auth.email());


-- ─── 4. study_sessions ─────────────────────────────────────────────────────
create table public.study_sessions (
    id                  uuid primary key default gen_random_uuid(),
    created_by          text not null,
    created_date        timestamptz not null default now(),
    updated_date        timestamptz not null default now(),

    subject             text,
    duration_minutes    int,
    technique           text,
    date                date,
    productivity_rating int,
    notes               text,
    -- Leaderboard reads `session_duration` separately; some sessions store both
    session_duration    int,

    extra               jsonb not null default '{}'::jsonb
);
create index study_sessions_created_by_idx on public.study_sessions (created_by);
create index study_sessions_date_idx       on public.study_sessions (created_by, date desc);
create trigger study_sessions_touch_updated before update on public.study_sessions
    for each row execute function public.touch_updated_date();

alter table public.study_sessions enable row level security;
create policy "study_sessions_select_own" on public.study_sessions for select using (created_by = auth.email());
create policy "study_sessions_insert_own" on public.study_sessions for insert with check (created_by = auth.email());
create policy "study_sessions_update_own" on public.study_sessions for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "study_sessions_delete_own" on public.study_sessions for delete using (created_by = auth.email());


-- ─── 5. flashcards (with SM-2 spaced-repetition state) ────────────────────
create table public.flashcards (
    id                    uuid primary key default gen_random_uuid(),
    created_by            text not null,
    created_date          timestamptz not null default now(),
    updated_date          timestamptz not null default now(),

    subject_name          text,
    topic                 text,
    unit                  text,
    question              text not null,
    answer                text not null,

    -- Deck linkage. Stored as text because Base44 used arbitrary strings;
    -- once everything is on Supabase we can FK it to a flashcard_decks table.
    deck_id               text,
    is_active             boolean not null default true,

    -- SM-2 algorithm state
    repetitions           int not null default 0,
    easiness_factor       numeric not null default 2.5,
    interval_days         int not null default 0,
    next_review_date      date,
    last_reviewed_date    date,
    total_reviews         int not null default 0,
    last_quality          int,

    -- Per-quality counters (used for mastery score)
    review_count_again    int not null default 0,
    review_count_hard     int not null default 0,
    review_count_good     int not null default 0,
    review_count_easy     int not null default 0,
    consecutive_good      int not null default 0,
    consecutive_easy      int not null default 0,
    session_skip_count    int not null default 0,
    is_weak_spot          boolean not null default false,

    extra                 jsonb not null default '{}'::jsonb
);
create index flashcards_created_by_idx       on public.flashcards (created_by);
create index flashcards_deck_idx             on public.flashcards (created_by, deck_id);
create index flashcards_next_review_idx      on public.flashcards (created_by, next_review_date);
create index flashcards_subject_idx          on public.flashcards (created_by, subject_name);
create trigger flashcards_touch_updated before update on public.flashcards
    for each row execute function public.touch_updated_date();

alter table public.flashcards enable row level security;
create policy "flashcards_select_own" on public.flashcards for select using (created_by = auth.email());
create policy "flashcards_insert_own" on public.flashcards for insert with check (created_by = auth.email());
create policy "flashcards_update_own" on public.flashcards for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "flashcards_delete_own" on public.flashcards for delete using (created_by = auth.email());


-- ─── 6. friendships (multi-user RLS) ───────────────────────────────────────
-- Both requester and recipient need to see + update the row. Only the requester
-- can create it; either party can update status (accept/decline); only the
-- requester can delete (= cancel a sent request).
create table public.friendships (
    id                   uuid primary key default gen_random_uuid(),
    created_by           text not null,           -- always = requester_email; kept for adapter compat
    created_date         timestamptz not null default now(),
    updated_date         timestamptz not null default now(),

    requester_email      text not null,
    requester_name       text,
    requester_username   text,
    recipient_email      text not null,
    recipient_name       text,
    recipient_username   text,
    status               text not null default 'pending'
                          check (status in ('pending','accepted','declined','blocked')),

    extra                jsonb not null default '{}'::jsonb,

    -- Prevent duplicate friendship rows in either direction
    unique (requester_email, recipient_email)
);
create index friendships_requester_idx on public.friendships (requester_email);
create index friendships_recipient_idx on public.friendships (recipient_email);
create index friendships_status_idx    on public.friendships (status);
create trigger friendships_touch_updated before update on public.friendships
    for each row execute function public.touch_updated_date();

alter table public.friendships enable row level security;
create policy "friendships_select_either" on public.friendships
    for select using (requester_email = auth.email() or recipient_email = auth.email());
create policy "friendships_insert_as_requester" on public.friendships
    for insert with check (requester_email = auth.email() and created_by = auth.email());
create policy "friendships_update_either" on public.friendships
    for update using (requester_email = auth.email() or recipient_email = auth.email())
              with check (requester_email = auth.email() or recipient_email = auth.email());
create policy "friendships_delete_as_requester" on public.friendships
    for delete using (requester_email = auth.email());


-- ─── 7. leaderboards (public-read, write-own) ─────────────────────────────
-- Anyone signed in can SELECT (so the rankings page can show everyone). Each
-- user can insert/update only their OWN row, identified by user_email. There
-- is at most one row per user (unique constraint).
create table public.leaderboards (
    id                uuid primary key default gen_random_uuid(),
    created_by        text not null,    -- always = user_email
    created_date      timestamptz not null default now(),
    updated_date      timestamptz not null default now(),

    user_email        text not null unique,
    user_name         text,
    username          text,
    total_xp          bigint not null default 0,
    season_xp         bigint not null default 0,
    level             int not null default 1,
    streak_days       int not null default 0,
    total_study_time  int not null default 0,    -- minutes
    total_sessions    int not null default 0,
    is_anonymous      boolean not null default false,
    last_updated      timestamptz not null default now(),

    extra             jsonb not null default '{}'::jsonb
);
create index leaderboards_total_xp_idx     on public.leaderboards (total_xp desc);
create index leaderboards_streak_days_idx  on public.leaderboards (streak_days desc);
create index leaderboards_study_time_idx   on public.leaderboards (total_study_time desc);
create trigger leaderboards_touch_updated before update on public.leaderboards
    for each row execute function public.touch_updated_date();

alter table public.leaderboards enable row level security;
-- Anyone authenticated can read all rows (rankings are public among signed-in users)
create policy "leaderboards_select_all" on public.leaderboards
    for select using (auth.uid() is not null);
create policy "leaderboards_insert_own" on public.leaderboards
    for insert with check (user_email = auth.email() and created_by = auth.email());
create policy "leaderboards_update_own" on public.leaderboards
    for update using (user_email = auth.email()) with check (user_email = auth.email());
create policy "leaderboards_delete_own" on public.leaderboards
    for delete using (user_email = auth.email());


-- ─── 8. ai_saved_results ──────────────────────────────────────────────────
create table public.ai_saved_results (
    id            uuid primary key default gen_random_uuid(),
    created_by    text not null,
    created_date  timestamptz not null default now(),
    updated_date  timestamptz not null default now(),

    tool_type     text not null,        -- 'concept_explainer','english_mentor','note_summarizer',etc.
    title         text,
    subject_name  text,
    topic         text,
    content       text,                  -- AI output, may be very long
    input_data    jsonb not null default '{}'::jsonb,
    date_created  date,

    extra         jsonb not null default '{}'::jsonb
);
create index ai_saved_results_created_by_idx on public.ai_saved_results (created_by);
create index ai_saved_results_tool_idx       on public.ai_saved_results (created_by, tool_type, date_created desc);
create trigger ai_saved_results_touch_updated before update on public.ai_saved_results
    for each row execute function public.touch_updated_date();

alter table public.ai_saved_results enable row level security;
create policy "ai_saved_results_select_own" on public.ai_saved_results for select using (created_by = auth.email());
create policy "ai_saved_results_insert_own" on public.ai_saved_results for insert with check (created_by = auth.email());
create policy "ai_saved_results_update_own" on public.ai_saved_results for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "ai_saved_results_delete_own" on public.ai_saved_results for delete using (created_by = auth.email());


-- ─── 9. study_techniques (per-technique session log) ──────────────────────
create table public.study_techniques (
    id               uuid primary key default gen_random_uuid(),
    created_by       text not null,
    created_date     timestamptz not null default now(),
    updated_date     timestamptz not null default now(),

    technique_name   text not null,         -- 'spaced_repetition','active_recall',etc.
    session_duration int,                    -- minutes
    subject          text,
    topic            text,
    date             date,
    notes            text,

    extra            jsonb not null default '{}'::jsonb
);
create index study_techniques_created_by_idx on public.study_techniques (created_by);
create index study_techniques_date_idx       on public.study_techniques (created_by, date desc);
create trigger study_techniques_touch_updated before update on public.study_techniques
    for each row execute function public.touch_updated_date();

alter table public.study_techniques enable row level security;
create policy "study_techniques_select_own" on public.study_techniques for select using (created_by = auth.email());
create policy "study_techniques_insert_own" on public.study_techniques for insert with check (created_by = auth.email());
create policy "study_techniques_update_own" on public.study_techniques for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "study_techniques_delete_own" on public.study_techniques for delete using (created_by = auth.email());


-- ─── 10. user_subjects ────────────────────────────────────────────────────
create table public.user_subjects (
    id                          uuid primary key default gen_random_uuid(),
    created_by                  text not null,
    created_date                timestamptz not null default now(),
    updated_date                timestamptz not null default now(),

    subject_name                text not null,
    subject_code                text,
    color                       text default '#6B7280',
    is_active                   boolean not null default true,
    difficulty_ratings          jsonb not null default '[]'::jsonb,
    avg_difficulty_rating       numeric,
    suggested_quiz_difficulty   text,
    goal_study_score            int,

    extra                       jsonb not null default '{}'::jsonb,

    -- Same user shouldn't have two rows for the same subject_name
    unique (created_by, subject_name)
);
create index user_subjects_created_by_idx on public.user_subjects (created_by);
create index user_subjects_active_idx     on public.user_subjects (created_by, is_active);
create trigger user_subjects_touch_updated before update on public.user_subjects
    for each row execute function public.touch_updated_date();

alter table public.user_subjects enable row level security;
create policy "user_subjects_select_own" on public.user_subjects for select using (created_by = auth.email());
create policy "user_subjects_insert_own" on public.user_subjects for insert with check (created_by = auth.email());
create policy "user_subjects_update_own" on public.user_subjects for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "user_subjects_delete_own" on public.user_subjects for delete using (created_by = auth.email());
