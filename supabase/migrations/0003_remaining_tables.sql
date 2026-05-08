-- ════════════════════════════════════════════════════════════════════════════
-- Phase 3b-2 — Remaining 29 tables, grouped by RLS pattern.
--
-- Layout:
--   PART A: user-owned (15 tables)        — same pattern as tier-1 user-owned
--   PART B: group/multi-user (8 tables)   — membership-based RLS
--   PART C: public-readable (3 tables)    — anyone can SELECT, service_role writes
--   PART D: server-only (3 tables)        — RLS on, no policies = client-locked-out
--
-- Field inference: top fields grepped from .create() / .update() call sites.
-- Anything not pinned down lives in `extra jsonb` (catch-all).
-- ════════════════════════════════════════════════════════════════════════════


-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ PART A — USER-OWNED (15 tables)                                        │
-- │ Same pattern as tier-1: created_by = auth.email() for all CRUD.        │
-- └────────────────────────────────────────────────────────────────────────┘

-- ─── 1. study_plans (calendar / planner events) ────────────────────────────
create table public.study_plans (
    id                 uuid primary key default gen_random_uuid(),
    created_by         text not null,
    created_date       timestamptz not null default now(),
    updated_date       timestamptz not null default now(),

    title              text not null,
    subject_name       text,
    subject_code       text,
    date               date,
    start_time         text,                              -- 'HH:MM'
    end_time           text,
    notes              text,
    is_completed       boolean not null default false,
    repeat_frequency   text default 'never',              -- never|daily|weekly|...
    repeat_end_date    date,
    series_id          text,                              -- groups recurring events
    study_type         text,                              -- lecture_review|assignment|other

    extra              jsonb not null default '{}'::jsonb
);
create index study_plans_created_by_idx on public.study_plans (created_by);
create index study_plans_date_idx       on public.study_plans (created_by, date);
create index study_plans_series_idx     on public.study_plans (series_id) where series_id is not null;
create trigger study_plans_touch_updated before update on public.study_plans
    for each row execute function public.touch_updated_date();
alter table public.study_plans enable row level security;
create policy "study_plans_select_own" on public.study_plans for select using (created_by = auth.email());
create policy "study_plans_insert_own" on public.study_plans for insert with check (created_by = auth.email());
create policy "study_plans_update_own" on public.study_plans for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "study_plans_delete_own" on public.study_plans for delete using (created_by = auth.email());


-- ─── 2. blurting_sessions ──────────────────────────────────────────────────
create table public.blurting_sessions (
    id                uuid primary key default gen_random_uuid(),
    created_by        text not null,
    created_date      timestamptz not null default now(),
    updated_date      timestamptz not null default now(),

    subject_name      text,
    topic             text,
    blurted_text      text,
    ai_feedback       text,                                -- JSON-stringified feedback
    session_duration  int,                                  -- minutes
    date              date,

    extra             jsonb not null default '{}'::jsonb
);
create index blurting_sessions_created_by_idx on public.blurting_sessions (created_by);
create index blurting_sessions_date_idx       on public.blurting_sessions (created_by, date desc);
create trigger blurting_sessions_touch_updated before update on public.blurting_sessions
    for each row execute function public.touch_updated_date();
alter table public.blurting_sessions enable row level security;
create policy "blurting_sessions_select_own" on public.blurting_sessions for select using (created_by = auth.email());
create policy "blurting_sessions_insert_own" on public.blurting_sessions for insert with check (created_by = auth.email());
create policy "blurting_sessions_update_own" on public.blurting_sessions for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "blurting_sessions_delete_own" on public.blurting_sessions for delete using (created_by = auth.email());


-- ─── 3. active_recall_sessions ─────────────────────────────────────────────
create table public.active_recall_sessions (
    id                uuid primary key default gen_random_uuid(),
    created_by        text not null,
    created_date      timestamptz not null default now(),
    updated_date      timestamptz not null default now(),

    subject_name      text,
    topic             text,
    questions         jsonb not null default '[]'::jsonb,
    answers           jsonb not null default '[]'::jsonb,
    ai_feedback       text,
    session_duration  int,
    date              date,

    extra             jsonb not null default '{}'::jsonb
);
create index active_recall_sessions_created_by_idx on public.active_recall_sessions (created_by);
create index active_recall_sessions_date_idx       on public.active_recall_sessions (created_by, date desc);
create trigger active_recall_sessions_touch_updated before update on public.active_recall_sessions
    for each row execute function public.touch_updated_date();
alter table public.active_recall_sessions enable row level security;
create policy "active_recall_sessions_select_own" on public.active_recall_sessions for select using (created_by = auth.email());
create policy "active_recall_sessions_insert_own" on public.active_recall_sessions for insert with check (created_by = auth.email());
create policy "active_recall_sessions_update_own" on public.active_recall_sessions for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "active_recall_sessions_delete_own" on public.active_recall_sessions for delete using (created_by = auth.email());


-- ─── 4. subject_assessments ────────────────────────────────────────────────
create table public.subject_assessments (
    id              uuid primary key default gen_random_uuid(),
    created_by      text not null,
    created_date    timestamptz not null default now(),
    updated_date    timestamptz not null default now(),

    title           text not null,
    subject_name    text,
    subject_code    text,
    assessment_type text,                                  -- exam|sac|test|...
    due_date        date,
    description     text,
    score           numeric,                                -- earned (filled later)
    out_of          numeric,
    is_completed    boolean not null default false,

    extra           jsonb not null default '{}'::jsonb
);
create index subject_assessments_created_by_idx on public.subject_assessments (created_by);
create index subject_assessments_subject_idx   on public.subject_assessments (created_by, subject_code);
create index subject_assessments_due_idx       on public.subject_assessments (created_by, due_date);
create trigger subject_assessments_touch_updated before update on public.subject_assessments
    for each row execute function public.touch_updated_date();
alter table public.subject_assessments enable row level security;
create policy "subject_assessments_select_own" on public.subject_assessments for select using (created_by = auth.email());
create policy "subject_assessments_insert_own" on public.subject_assessments for insert with check (created_by = auth.email());
create policy "subject_assessments_update_own" on public.subject_assessments for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "subject_assessments_delete_own" on public.subject_assessments for delete using (created_by = auth.email());


-- ─── 5. study_roadmaps ─────────────────────────────────────────────────────
create table public.study_roadmaps (
    id                  uuid primary key default gen_random_uuid(),
    created_by          text not null,
    created_date        timestamptz not null default now(),
    updated_date        timestamptz not null default now(),

    subject             text,
    topic               text,
    assessment_type     text,
    days_until          int,
    knowledge_level     text,
    weak_areas          jsonb not null default '[]'::jsonb,
    has_prior_data      boolean not null default false,
    intro               text,
    readiness_score     numeric,
    key_topics          jsonb not null default '[]'::jsonb,
    journey_map         jsonb not null default '[]'::jsonb,
    days                jsonb not null default '[]'::jsonb,
    confidence_ratings  jsonb not null default '[]'::jsonb,

    extra               jsonb not null default '{}'::jsonb
);
create index study_roadmaps_created_by_idx on public.study_roadmaps (created_by);
create trigger study_roadmaps_touch_updated before update on public.study_roadmaps
    for each row execute function public.touch_updated_date();
alter table public.study_roadmaps enable row level security;
create policy "study_roadmaps_select_own" on public.study_roadmaps for select using (created_by = auth.email());
create policy "study_roadmaps_insert_own" on public.study_roadmaps for insert with check (created_by = auth.email());
create policy "study_roadmaps_update_own" on public.study_roadmaps for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "study_roadmaps_delete_own" on public.study_roadmaps for delete using (created_by = auth.email());


-- ─── 6. study_guides ───────────────────────────────────────────────────────
create table public.study_guides (
    id                   uuid primary key default gen_random_uuid(),
    created_by           text not null,
    created_date         timestamptz not null default now(),
    updated_date         timestamptz not null default now(),

    title                text not null,
    category             text,                  -- 'study_techniques' etc
    subject              text,
    content              text,
    difficulty_level     text default 'beginner',
    estimated_read_time  int default 5,
    tags                 jsonb not null default '[]'::jsonb,
    is_featured          boolean not null default false,
    key_points           jsonb not null default '[]'::jsonb,

    extra                jsonb not null default '{}'::jsonb
);
create index study_guides_created_by_idx on public.study_guides (created_by);
create index study_guides_category_idx   on public.study_guides (category);
create trigger study_guides_touch_updated before update on public.study_guides
    for each row execute function public.touch_updated_date();
alter table public.study_guides enable row level security;
-- Guides are user-authored but readable by everyone (community resource)
create policy "study_guides_select_all"  on public.study_guides for select using (auth.uid() is not null);
create policy "study_guides_insert_own"  on public.study_guides for insert with check (created_by = auth.email());
create policy "study_guides_update_own"  on public.study_guides for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "study_guides_delete_own"  on public.study_guides for delete using (created_by = auth.email());


-- ─── 7. study_streaks ──────────────────────────────────────────────────────
create table public.study_streaks (
    id              uuid primary key default gen_random_uuid(),
    created_by      text not null,
    created_date    timestamptz not null default now(),
    updated_date    timestamptz not null default now(),

    current_streak  int not null default 0,
    longest_streak  int not null default 0,
    last_study_date date,

    extra           jsonb not null default '{}'::jsonb,

    unique (created_by)
);
create trigger study_streaks_touch_updated before update on public.study_streaks
    for each row execute function public.touch_updated_date();
alter table public.study_streaks enable row level security;
create policy "study_streaks_select_own" on public.study_streaks for select using (created_by = auth.email());
create policy "study_streaks_insert_own" on public.study_streaks for insert with check (created_by = auth.email());
create policy "study_streaks_update_own" on public.study_streaks for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "study_streaks_delete_own" on public.study_streaks for delete using (created_by = auth.email());


-- ─── 8. goal_challenges ────────────────────────────────────────────────────
create table public.goal_challenges (
    id              uuid primary key default gen_random_uuid(),
    created_by      text not null,
    created_date    timestamptz not null default now(),
    updated_date    timestamptz not null default now(),

    goal_id         uuid references public.goals(id) on delete cascade,
    title           text,
    description     text,
    challenge_type  text,
    progress        numeric not null default 0,
    is_completed    boolean not null default false,
    xp_reward       int default 0,

    extra           jsonb not null default '{}'::jsonb
);
create index goal_challenges_created_by_idx on public.goal_challenges (created_by);
create index goal_challenges_goal_idx       on public.goal_challenges (goal_id);
create trigger goal_challenges_touch_updated before update on public.goal_challenges
    for each row execute function public.touch_updated_date();
alter table public.goal_challenges enable row level security;
create policy "goal_challenges_select_own" on public.goal_challenges for select using (created_by = auth.email());
create policy "goal_challenges_insert_own" on public.goal_challenges for insert with check (created_by = auth.email());
create policy "goal_challenges_update_own" on public.goal_challenges for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "goal_challenges_delete_own" on public.goal_challenges for delete using (created_by = auth.email());


-- ─── 9. score_wagers ───────────────────────────────────────────────────────
-- A "wager" links bettor to a target user's quiz/competition outcome.
-- Both bettor and target need to see the row (to display + settle).
create table public.score_wagers (
    id                 uuid primary key default gen_random_uuid(),
    created_by         text not null,                      -- = bettor_email
    created_date       timestamptz not null default now(),
    updated_date       timestamptz not null default now(),

    bettor_email       text not null,
    target_email       text,                                -- whose outcome is being bet on
    target_quiz_id     uuid references public.quizzes(id) on delete set null,
    predicted_score    numeric,
    wager_xp           int,
    status             text not null default 'pending'
                        check (status in ('pending','won','lost','cancelled')),
    resolved_at        timestamptz,

    extra              jsonb not null default '{}'::jsonb
);
create index score_wagers_bettor_idx on public.score_wagers (bettor_email);
create index score_wagers_target_idx on public.score_wagers (target_email);
create trigger score_wagers_touch_updated before update on public.score_wagers
    for each row execute function public.touch_updated_date();
alter table public.score_wagers enable row level security;
create policy "score_wagers_select_either" on public.score_wagers
    for select using (bettor_email = auth.email() or target_email = auth.email());
create policy "score_wagers_insert_as_bettor" on public.score_wagers
    for insert with check (bettor_email = auth.email() and created_by = auth.email());
create policy "score_wagers_update_either" on public.score_wagers
    for update using (bettor_email = auth.email() or target_email = auth.email())
              with check (bettor_email = auth.email() or target_email = auth.email());
create policy "score_wagers_delete_as_bettor" on public.score_wagers
    for delete using (bettor_email = auth.email());


-- ─── 10. season_records ────────────────────────────────────────────────────
create table public.season_records (
    id            uuid primary key default gen_random_uuid(),
    created_by    text not null,
    created_date  timestamptz not null default now(),
    updated_date  timestamptz not null default now(),

    season_id     text not null,                            -- e.g. 'season_2026_01'
    season_xp     bigint not null default 0,
    final_rank    int,
    rewards_claimed boolean not null default false,

    extra         jsonb not null default '{}'::jsonb,

    unique (created_by, season_id)
);
create index season_records_created_by_idx on public.season_records (created_by);
create index season_records_season_idx     on public.season_records (season_id);
create trigger season_records_touch_updated before update on public.season_records
    for each row execute function public.touch_updated_date();
alter table public.season_records enable row level security;
create policy "season_records_select_own" on public.season_records for select using (created_by = auth.email());
create policy "season_records_insert_own" on public.season_records for insert with check (created_by = auth.email());
create policy "season_records_update_own" on public.season_records for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "season_records_delete_own" on public.season_records for delete using (created_by = auth.email());


-- ─── 11. past_paper_attempts ───────────────────────────────────────────────
create table public.past_paper_attempts (
    id                uuid primary key default gen_random_uuid(),
    created_by        text not null,
    created_date      timestamptz not null default now(),
    updated_date      timestamptz not null default now(),

    past_paper_id     uuid,                                 -- soft FK; past_papers added in PART C
    paper_title       text,
    subject           text,
    year              int,
    score             numeric,
    questions_total   int,
    questions_correct int,
    time_taken_secs   int,
    user_answers      jsonb not null default '[]'::jsonb,
    date              date,

    extra             jsonb not null default '{}'::jsonb
);
create index past_paper_attempts_created_by_idx on public.past_paper_attempts (created_by);
create index past_paper_attempts_paper_idx      on public.past_paper_attempts (past_paper_id);
create trigger past_paper_attempts_touch_updated before update on public.past_paper_attempts
    for each row execute function public.touch_updated_date();
alter table public.past_paper_attempts enable row level security;
create policy "past_paper_attempts_select_own" on public.past_paper_attempts for select using (created_by = auth.email());
create policy "past_paper_attempts_insert_own" on public.past_paper_attempts for insert with check (created_by = auth.email());
create policy "past_paper_attempts_update_own" on public.past_paper_attempts for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "past_paper_attempts_delete_own" on public.past_paper_attempts for delete using (created_by = auth.email());


-- ─── 12. university_courses ────────────────────────────────────────────────
-- Catalog rows are seeded, then each user can favourite/track. Open RLS for
-- read; only owner edits. Initial admin seed loads via service_role.
create table public.university_courses (
    id              uuid primary key default gen_random_uuid(),
    created_by      text not null default 'system',
    created_date    timestamptz not null default now(),
    updated_date    timestamptz not null default now(),

    name            text not null,
    university      text,
    field_of_study  text,
    atar_required   numeric,
    duration_years  numeric,
    location        text,
    description     text,

    extra           jsonb not null default '{}'::jsonb
);
create index university_courses_name_idx       on public.university_courses (name);
create index university_courses_field_idx      on public.university_courses (field_of_study);
create trigger university_courses_touch_updated before update on public.university_courses
    for each row execute function public.touch_updated_date();
alter table public.university_courses enable row level security;
-- Anyone signed in can browse the catalog
create policy "university_courses_select_all" on public.university_courses for select using (auth.uid() is not null);
create policy "university_courses_insert_own" on public.university_courses for insert with check (created_by = auth.email());
create policy "university_courses_update_own" on public.university_courses for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "university_courses_delete_own" on public.university_courses for delete using (created_by = auth.email());


-- ─── 13. daily_timetables ──────────────────────────────────────────────────
create table public.daily_timetables (
    id            uuid primary key default gen_random_uuid(),
    created_by    text not null,
    created_date  timestamptz not null default now(),
    updated_date  timestamptz not null default now(),

    date          date not null,
    activities    jsonb not null default '[]'::jsonb,

    extra         jsonb not null default '{}'::jsonb,

    unique (created_by, date)
);
create index daily_timetables_created_by_idx on public.daily_timetables (created_by);
create trigger daily_timetables_touch_updated before update on public.daily_timetables
    for each row execute function public.touch_updated_date();
alter table public.daily_timetables enable row level security;
create policy "daily_timetables_select_own" on public.daily_timetables for select using (created_by = auth.email());
create policy "daily_timetables_insert_own" on public.daily_timetables for insert with check (created_by = auth.email());
create policy "daily_timetables_update_own" on public.daily_timetables for update using (created_by = auth.email()) with check (created_by = auth.email());
create policy "daily_timetables_delete_own" on public.daily_timetables for delete using (created_by = auth.email());


-- ─── 14. xp_events (transaction log of XP awards) ──────────────────────────
create table public.xp_events (
    id            uuid primary key default gen_random_uuid(),
    created_by    text not null,
    created_date  timestamptz not null default now(),

    source        text not null,                            -- 'quiz'|'flashcard'|'goal'|...
    event_key     text,                                      -- idempotency key
    xp_amount     int not null,
    multiplier    numeric default 1,

    extra         jsonb not null default '{}'::jsonb,

    -- Same source+event_key shouldn't double-credit
    unique (created_by, event_key)
);
create index xp_events_created_by_idx on public.xp_events (created_by, created_date desc);
alter table public.xp_events enable row level security;
create policy "xp_events_select_own" on public.xp_events for select using (created_by = auth.email());
create policy "xp_events_insert_own" on public.xp_events for insert with check (created_by = auth.email());
-- No update/delete policies — XP log is append-only from the client's POV.


-- ─── 15. support_tickets ───────────────────────────────────────────────────
create table public.support_tickets (
    id            uuid primary key default gen_random_uuid(),
    created_by    text not null,
    created_date  timestamptz not null default now(),
    updated_date  timestamptz not null default now(),

    subject       text not null,
    body          text not null,
    category      text,
    status        text not null default 'open'
                   check (status in ('open','in_progress','resolved','closed')),
    admin_reply   text,

    extra         jsonb not null default '{}'::jsonb
);
create index support_tickets_created_by_idx on public.support_tickets (created_by);
create index support_tickets_status_idx     on public.support_tickets (status);
create trigger support_tickets_touch_updated before update on public.support_tickets
    for each row execute function public.touch_updated_date();
alter table public.support_tickets enable row level security;
-- Users see their own tickets only; admin reads all via service_role
create policy "support_tickets_select_own" on public.support_tickets for select using (created_by = auth.email());
create policy "support_tickets_insert_own" on public.support_tickets for insert with check (created_by = auth.email());
create policy "support_tickets_update_own" on public.support_tickets for update using (created_by = auth.email()) with check (created_by = auth.email());


-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ PART B — GROUP / MULTI-USER (8 tables)                                 │
-- │ Membership-based RLS via subqueries against study_groups / friendships.│
-- └────────────────────────────────────────────────────────────────────────┘

-- ─── 16. study_groups ──────────────────────────────────────────────────────
-- Owner + members can read; only owner can update group metadata or delete.
-- member_emails is a text[] for fast membership checks.
create table public.study_groups (
    id              uuid primary key default gen_random_uuid(),
    created_by      text not null,                          -- = owner_email
    created_date    timestamptz not null default now(),
    updated_date    timestamptz not null default now(),

    name            text not null,
    description     text,
    subject         text,
    is_private      boolean not null default false,
    join_code       text unique,

    owner_email     text not null,
    owner_name      text,
    member_emails   text[] not null default '{}',
    member_names    text[] not null default '{}',

    extra           jsonb not null default '{}'::jsonb
);
create index study_groups_owner_idx       on public.study_groups (owner_email);
create index study_groups_members_gin     on public.study_groups using gin (member_emails);
create index study_groups_join_code_idx   on public.study_groups (join_code);
create trigger study_groups_touch_updated before update on public.study_groups
    for each row execute function public.touch_updated_date();
alter table public.study_groups enable row level security;
create policy "study_groups_select_member" on public.study_groups
    for select using (owner_email = auth.email() or auth.email() = any(member_emails));
create policy "study_groups_insert_as_owner" on public.study_groups
    for insert with check (owner_email = auth.email() and created_by = auth.email());
-- Members can update (to add/remove themselves via join/leave); owner has full control
create policy "study_groups_update_member" on public.study_groups
    for update using (owner_email = auth.email() or auth.email() = any(member_emails))
              with check (owner_email = auth.email() or auth.email() = any(member_emails));
create policy "study_groups_delete_as_owner" on public.study_groups
    for delete using (owner_email = auth.email());


-- ─── Helper: check if current user is a member of a given group ───────────
create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists(
        select 1 from public.study_groups
        where id = gid
          and (owner_email = auth.email() or auth.email() = any(member_emails))
    );
$$;


-- ─── 17. group_messages ────────────────────────────────────────────────────
create table public.group_messages (
    id           uuid primary key default gen_random_uuid(),
    created_by   text not null,                             -- = sender_email
    created_date timestamptz not null default now(),

    group_id     uuid not null references public.study_groups(id) on delete cascade,
    sender_email text not null,
    sender_name  text,
    message      text not null,
    message_type text not null default 'user',              -- user|system
    timestamp    timestamptz not null default now(),

    extra        jsonb not null default '{}'::jsonb
);
create index group_messages_group_idx on public.group_messages (group_id, timestamp desc);
alter table public.group_messages enable row level security;
create policy "group_messages_select_member" on public.group_messages
    for select using (public.is_group_member(group_id));
create policy "group_messages_insert_member" on public.group_messages
    for insert with check (public.is_group_member(group_id) and (sender_email = auth.email() or sender_email = 'system'));
-- No update/delete from client — chat history is immutable


-- ─── 18. group_shared_resources ────────────────────────────────────────────
create table public.group_shared_resources (
    id              uuid primary key default gen_random_uuid(),
    created_by      text not null,
    created_date    timestamptz not null default now(),
    updated_date    timestamptz not null default now(),

    group_id        uuid not null references public.study_groups(id) on delete cascade,
    resource_type   text not null,                          -- flashcard_deck|quiz|note|...
    title           text,
    description     text,
    shared_by_email text not null,
    shared_by_name  text,
    resource_data   jsonb not null default '{}'::jsonb,
    subject_name    text,
    topic           text,
    tags            jsonb not null default '[]'::jsonb,

    extra           jsonb not null default '{}'::jsonb
);
create index group_shared_resources_group_idx on public.group_shared_resources (group_id);
create trigger group_shared_resources_touch_updated before update on public.group_shared_resources
    for each row execute function public.touch_updated_date();
alter table public.group_shared_resources enable row level security;
create policy "group_shared_resources_select_member" on public.group_shared_resources
    for select using (public.is_group_member(group_id));
create policy "group_shared_resources_insert_member" on public.group_shared_resources
    for insert with check (public.is_group_member(group_id) and shared_by_email = auth.email() and created_by = auth.email());
create policy "group_shared_resources_update_sharer" on public.group_shared_resources
    for update using (shared_by_email = auth.email()) with check (shared_by_email = auth.email());
create policy "group_shared_resources_delete_sharer" on public.group_shared_resources
    for delete using (shared_by_email = auth.email());


-- ─── 19. group_flashcard_decks ─────────────────────────────────────────────
create table public.group_flashcard_decks (
    id            uuid primary key default gen_random_uuid(),
    created_by    text not null,
    created_date  timestamptz not null default now(),
    updated_date  timestamptz not null default now(),

    group_id      uuid not null references public.study_groups(id) on delete cascade,
    name          text not null,
    subject_name  text,
    topic         text,
    cards         jsonb not null default '[]'::jsonb,

    extra         jsonb not null default '{}'::jsonb
);
create index group_flashcard_decks_group_idx on public.group_flashcard_decks (group_id);
create trigger group_flashcard_decks_touch_updated before update on public.group_flashcard_decks
    for each row execute function public.touch_updated_date();
alter table public.group_flashcard_decks enable row level security;
create policy "group_flashcard_decks_select_member" on public.group_flashcard_decks
    for select using (public.is_group_member(group_id));
create policy "group_flashcard_decks_insert_member" on public.group_flashcard_decks
    for insert with check (public.is_group_member(group_id) and created_by = auth.email());
create policy "group_flashcard_decks_update_member" on public.group_flashcard_decks
    for update using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy "group_flashcard_decks_delete_owner" on public.group_flashcard_decks
    for delete using (created_by = auth.email());


-- ─── 20. shared_quizzes ────────────────────────────────────────────────────
create table public.shared_quizzes (
    id                 uuid primary key default gen_random_uuid(),
    created_by         text not null,                       -- = shared_by_email
    created_date       timestamptz not null default now(),
    updated_date       timestamptz not null default now(),

    quiz_id            uuid references public.quizzes(id) on delete set null,
    quiz_title         text,
    quiz_data          jsonb not null default '{}'::jsonb,
    shared_by_email    text not null,
    shared_by_name     text,
    shared_with_email  text not null,
    shared_with_name   text,
    message            text,
    status             text not null default 'pending'
                        check (status in ('pending','accepted','declined')),

    extra              jsonb not null default '{}'::jsonb
);
create index shared_quizzes_recipient_idx on public.shared_quizzes (shared_with_email);
create index shared_quizzes_sender_idx    on public.shared_quizzes (shared_by_email);
create trigger shared_quizzes_touch_updated before update on public.shared_quizzes
    for each row execute function public.touch_updated_date();
alter table public.shared_quizzes enable row level security;
create policy "shared_quizzes_select_either" on public.shared_quizzes
    for select using (shared_by_email = auth.email() or shared_with_email = auth.email());
create policy "shared_quizzes_insert_as_sender" on public.shared_quizzes
    for insert with check (shared_by_email = auth.email() and created_by = auth.email());
-- Recipient updates status to accept/decline; sender can update too
create policy "shared_quizzes_update_either" on public.shared_quizzes
    for update using (shared_by_email = auth.email() or shared_with_email = auth.email())
              with check (shared_by_email = auth.email() or shared_with_email = auth.email());
create policy "shared_quizzes_delete_as_sender" on public.shared_quizzes
    for delete using (shared_by_email = auth.email());


-- ─── 21. shared_flashcards ─────────────────────────────────────────────────
create table public.shared_flashcards (
    id                 uuid primary key default gen_random_uuid(),
    created_by         text not null,
    created_date       timestamptz not null default now(),
    updated_date       timestamptz not null default now(),

    deck_id            text,
    deck_name          text,
    flashcard_data     jsonb not null default '[]'::jsonb,
    shared_by_email    text not null,
    shared_by_name     text,
    shared_with_email  text not null,
    shared_with_name   text,
    message            text,
    status             text not null default 'pending'
                        check (status in ('pending','accepted','declined')),

    extra              jsonb not null default '{}'::jsonb
);
create index shared_flashcards_recipient_idx on public.shared_flashcards (shared_with_email);
create index shared_flashcards_sender_idx    on public.shared_flashcards (shared_by_email);
create trigger shared_flashcards_touch_updated before update on public.shared_flashcards
    for each row execute function public.touch_updated_date();
alter table public.shared_flashcards enable row level security;
create policy "shared_flashcards_select_either" on public.shared_flashcards
    for select using (shared_by_email = auth.email() or shared_with_email = auth.email());
create policy "shared_flashcards_insert_as_sender" on public.shared_flashcards
    for insert with check (shared_by_email = auth.email() and created_by = auth.email());
create policy "shared_flashcards_update_either" on public.shared_flashcards
    for update using (shared_by_email = auth.email() or shared_with_email = auth.email())
              with check (shared_by_email = auth.email() or shared_with_email = auth.email());
create policy "shared_flashcards_delete_as_sender" on public.shared_flashcards
    for delete using (shared_by_email = auth.email());


-- ─── 22. shared_ai_results ─────────────────────────────────────────────────
create table public.shared_ai_results (
    id                 uuid primary key default gen_random_uuid(),
    created_by         text not null,
    created_date       timestamptz not null default now(),
    updated_date       timestamptz not null default now(),

    ai_result_id       uuid references public.ai_saved_results(id) on delete set null,
    title              text,
    tool_type          text,
    content            text,
    shared_by_email    text not null,
    shared_by_name     text,
    shared_with_email  text not null,
    shared_with_name   text,
    message            text,
    status             text not null default 'pending'
                        check (status in ('pending','accepted','declined')),

    extra              jsonb not null default '{}'::jsonb
);
create index shared_ai_results_recipient_idx on public.shared_ai_results (shared_with_email);
create index shared_ai_results_sender_idx    on public.shared_ai_results (shared_by_email);
create trigger shared_ai_results_touch_updated before update on public.shared_ai_results
    for each row execute function public.touch_updated_date();
alter table public.shared_ai_results enable row level security;
create policy "shared_ai_results_select_either" on public.shared_ai_results
    for select using (shared_by_email = auth.email() or shared_with_email = auth.email());
create policy "shared_ai_results_insert_as_sender" on public.shared_ai_results
    for insert with check (shared_by_email = auth.email() and created_by = auth.email());
create policy "shared_ai_results_update_either" on public.shared_ai_results
    for update using (shared_by_email = auth.email() or shared_with_email = auth.email())
              with check (shared_by_email = auth.email() or shared_with_email = auth.email());
create policy "shared_ai_results_delete_as_sender" on public.shared_ai_results
    for delete using (shared_by_email = auth.email());


-- ─── 23. goal_competitions ─────────────────────────────────────────────────
-- Multi-participant goal competition. Participants list is in participant_emails[].
create table public.goal_competitions (
    id                 uuid primary key default gen_random_uuid(),
    created_by         text not null,                       -- = creator email
    created_date       timestamptz not null default now(),
    updated_date       timestamptz not null default now(),

    title              text not null,
    description        text,
    competition_type   text,                                  -- xp|hours|streak|...
    target_value       numeric,
    start_date         date,
    end_date           date,
    status             text not null default 'active'
                        check (status in ('active','completed','cancelled')),
    participant_emails text[] not null default '{}',
    participant_names  text[] not null default '{}',
    progress_by_user   jsonb not null default '{}'::jsonb,
    winner_email       text,

    extra              jsonb not null default '{}'::jsonb
);
create index goal_competitions_participants_gin on public.goal_competitions using gin (participant_emails);
create index goal_competitions_creator_idx      on public.goal_competitions (created_by);
create trigger goal_competitions_touch_updated before update on public.goal_competitions
    for each row execute function public.touch_updated_date();
alter table public.goal_competitions enable row level security;
create policy "goal_competitions_select_participant" on public.goal_competitions
    for select using (created_by = auth.email() or auth.email() = any(participant_emails));
create policy "goal_competitions_insert_as_creator" on public.goal_competitions
    for insert with check (created_by = auth.email());
create policy "goal_competitions_update_participant" on public.goal_competitions
    for update using (created_by = auth.email() or auth.email() = any(participant_emails))
              with check (created_by = auth.email() or auth.email() = any(participant_emails));
create policy "goal_competitions_delete_as_creator" on public.goal_competitions
    for delete using (created_by = auth.email());


-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ PART C — PUBLIC-READABLE (3 tables)                                    │
-- │ Anyone authenticated can SELECT. Writes happen via service_role.       │
-- └────────────────────────────────────────────────────────────────────────┘

-- ─── 24. vce_subjects (curriculum reference data) ─────────────────────────
create table public.vce_subjects (
    id              uuid primary key default gen_random_uuid(),
    created_by      text not null default 'system',
    created_date    timestamptz not null default now(),
    updated_date    timestamptz not null default now(),

    code            text not null unique,                    -- 'MATHS_METHODS_3_4'
    name            text not null,
    short_name      text,
    field           text,                                     -- 'Mathematics'
    scaling_mean    numeric,
    scaling_factor  numeric,
    sac_pct         int,
    exam_pct        int,
    description     text,

    extra           jsonb not null default '{}'::jsonb
);
create index vce_subjects_field_idx on public.vce_subjects (field);
create trigger vce_subjects_touch_updated before update on public.vce_subjects
    for each row execute function public.touch_updated_date();
alter table public.vce_subjects enable row level security;
create policy "vce_subjects_select_all" on public.vce_subjects for select using (auth.uid() is not null);
-- No insert/update/delete policies for clients — service_role only


-- ─── 25. school_profiles ───────────────────────────────────────────────────
create table public.school_profiles (
    id            uuid primary key default gen_random_uuid(),
    created_by    text not null default 'system',
    created_date  timestamptz not null default now(),
    updated_date  timestamptz not null default now(),

    name          text not null,
    state         text,                                       -- VIC, NSW, etc.
    suburb        text,
    type          text,                                       -- public|private|catholic
    logo_url      text,

    extra         jsonb not null default '{}'::jsonb
);
create index school_profiles_name_idx  on public.school_profiles (name);
create index school_profiles_state_idx on public.school_profiles (state);
create trigger school_profiles_touch_updated before update on public.school_profiles
    for each row execute function public.touch_updated_date();
alter table public.school_profiles enable row level security;
create policy "school_profiles_select_all" on public.school_profiles for select using (auth.uid() is not null);
-- Inserts allowed for authenticated users — "register your school" flow
create policy "school_profiles_insert_authenticated" on public.school_profiles for insert with check (auth.uid() is not null);


-- ─── 26. past_papers (VCAA exam papers catalog) ───────────────────────────
create table public.past_papers (
    id              uuid primary key default gen_random_uuid(),
    created_by      text not null default 'system',
    created_date    timestamptz not null default now(),
    updated_date    timestamptz not null default now(),

    subject         text not null,
    year            int not null,
    paper_number    int,
    title           text,
    pdf_url         text,
    answers_url     text,
    questions       jsonb not null default '[]'::jsonb,

    extra           jsonb not null default '{}'::jsonb
);
create index past_papers_subject_idx on public.past_papers (subject, year desc);
create trigger past_papers_touch_updated before update on public.past_papers
    for each row execute function public.touch_updated_date();
alter table public.past_papers enable row level security;
create policy "past_papers_select_all" on public.past_papers for select using (auth.uid() is not null);


-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ PART D — SERVER-ONLY (3 tables)                                        │
-- │ RLS enabled, NO policies — clients can't read/write at all.            │
-- │ Server-side code uses service_role key (which bypasses RLS).           │
-- └────────────────────────────────────────────────────────────────────────┘

-- ─── 27. ip_call_logs (admin/audit) ────────────────────────────────────────
create table public.ip_call_logs (
    id            uuid primary key default gen_random_uuid(),
    created_date  timestamptz not null default now(),

    ip_address    text not null,
    user_email    text,
    endpoint      text,
    status_code   int,
    user_agent    text,

    extra         jsonb not null default '{}'::jsonb
);
create index ip_call_logs_ip_idx    on public.ip_call_logs (ip_address, created_date desc);
create index ip_call_logs_user_idx  on public.ip_call_logs (user_email, created_date desc);
alter table public.ip_call_logs enable row level security;
-- intentionally no policies — service_role only


-- ─── 28. blocked_ips (admin) ───────────────────────────────────────────────
create table public.blocked_ips (
    id            uuid primary key default gen_random_uuid(),
    created_date  timestamptz not null default now(),

    ip_address    text not null unique,
    reason        text,
    blocked_until timestamptz,

    extra         jsonb not null default '{}'::jsonb
);
create index blocked_ips_until_idx on public.blocked_ips (blocked_until);
alter table public.blocked_ips enable row level security;
-- intentionally no policies — service_role only


-- ─── 29. ai_rate_limits (managed by AI proxy) ─────────────────────────────
create table public.ai_rate_limits (
    id            uuid primary key default gen_random_uuid(),
    created_date  timestamptz not null default now(),
    updated_date  timestamptz not null default now(),

    user_email    text not null unique,
    is_frozen     boolean not null default false,
    freeze_reason text,
    daily_count   int not null default 0,
    window_start  timestamptz not null default now(),

    extra         jsonb not null default '{}'::jsonb
);
create trigger ai_rate_limits_touch_updated before update on public.ai_rate_limits
    for each row execute function public.touch_updated_date();
alter table public.ai_rate_limits enable row level security;
-- intentionally no policies — service_role only
