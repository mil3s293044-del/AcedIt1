-- ════════════════════════════════════════════════════════════════════════════
-- AcedIt — everything still to apply, in one script.
--
-- Covers migrations 0022 through 0035. Paste the whole thing into the Supabase
-- SQL editor and run it once.
--
-- SAFE TO RUN TWICE. Every statement is guarded, so if some of these were
-- already applied it will skip them rather than erroring. If you're unsure
-- what's already been run, just run the lot.
--
-- Verified by applying migrations 0001-0021 to a clean Postgres 16, then
-- running this file twice — second pass clean, and the expected columns,
-- tables, indexes and policies all present afterwards.
--
-- Nothing here drops or rewrites existing data. There are two UPDATEs, both
-- backfills: one touches rows where xp_amount is null, the other copies the
-- existing AI-spend cents into the new micro-dollar columns (0030) and is
-- guarded so a second run cannot clobber spend recorded since the first.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 0022a — AcedIt ATAR ─────────────────────────────────────────────────────
-- The score the whole Ranked page is standardised around. Without this the
-- page degrades to a "one migration to run" notice.
alter table public.user_profiles
    add column if not exists acedit_atar     numeric,
    add column if not exists atar_components jsonb,
    add column if not exists atar_updated_at timestamptz;

alter table public.leaderboards
    add column if not exists acedit_atar     numeric;

create index if not exists leaderboards_acedit_atar_idx
    on public.leaderboards (acedit_atar desc nulls last);

comment on column public.user_profiles.acedit_atar is
    'AcedIt ATAR: trailing-28-day study-quality score (0-99.95). App-native — not a VCAA prediction.';

-- ── 0022b — Mock ATAR ───────────────────────────────────────────────────────
-- Separate feature that happened to get the same number. Both are additive.
alter table public.leaderboards
    add column if not exists mock_atar   numeric(4, 2),
    add column if not exists mock_scores jsonb not null default '{}'::jsonb;

-- ── 0023 — XP events amount fix ─────────────────────────────────────────────
alter table public.xp_events alter column xp_amount drop not null;
alter table public.xp_events alter column xp_amount set default 0;

update public.xp_events
   set xp_amount = coalesce(xp_awarded, 0)
 where xp_amount is null;

create index if not exists xp_events_user_email_date_idx
    on public.xp_events (user_email, created_date desc);

-- ── 0024 — Duel score history ───────────────────────────────────────────────
alter table public.study_duels
    add column if not exists score_history jsonb not null default '[]'::jsonb;

-- ── 0025 — Call-outs ────────────────────────────────────────────────────────
-- Forcing a competitor to sit a timed quiz on their own study material.
-- Answers live in `questions` and are never sent to any client.
create table if not exists public.callouts (
    id                uuid primary key default gen_random_uuid(),
    created_by        text not null,                 -- = caller_email
    created_date      timestamptz not null default now(),

    -- What it's attached to. Exactly one of these is set.
    duel_id           uuid references public.study_duels(id) on delete cascade,
    competition_id    uuid references public.goal_competitions(id) on delete cascade,

    caller_email      text not null,
    caller_name       text not null default '',
    target_email      text not null,
    target_name       text not null default '',

    -- The window the material and the XP at stake are drawn from.
    window_start      timestamptz not null,

    -- pending  → target hasn't opened it yet (clock not running)
    -- active   → target opened it; `started_at` set, timer running
    -- passed / failed / expired / voided
    status            text not null default 'pending'
                      check (status in ('pending','active','passed','failed','expired','voided')),

    -- [{ q, options: [..], correct: int, source: 'flashcard'|'quiz', ref }]
    questions         jsonb not null default '[]'::jsonb,
    seconds_allowed   int not null default 300,
    pass_mark         numeric not null default 0.75,

    -- Deadline for opening it at all. Missing this forfeits.
    respond_by        timestamptz not null,
    started_at        timestamptz,
    submitted_at      timestamptz,

    -- Outcome
    score             numeric,                       -- 0..1
    answers           jsonb not null default '[]'::jsonb,
    xp_moved          int not null default 0,
    settle_note       text,

    extra             jsonb not null default '{}'::jsonb
);

create index if not exists callouts_target_idx on public.callouts (target_email, status, created_date desc);
create index if not exists callouts_caller_idx on public.callouts (caller_email, created_date desc);
create index if not exists callouts_duel_idx   on public.callouts (duel_id);
create index if not exists callouts_comp_idx   on public.callouts (competition_id);

alter table public.callouts enable row level security;

drop policy if exists "callouts_select_involved" on public.callouts;
create policy "callouts_select_involved" on public.callouts
    for select using (auth.email() = caller_email or auth.email() = target_email);

-- ── 0026 — Self-checks, immunity, and the record ────────────────────────────
alter table public.callouts
    add column if not exists kind text not null default 'callout',
    -- Set when a self-check passes: nobody may call this student out until it
    -- expires. Also set on a passed call-out — surviving one should buy the
    -- same peace as volunteering for one.
    add column if not exists immunity_until timestamptz,
    -- Which contest metric the stake was scoped to.
    add column if not exists metric text;

-- Added separately so a re-run doesn't trip over an existing constraint.
alter table public.callouts drop constraint if exists callouts_kind_check;
alter table public.callouts
    add constraint callouts_kind_check check (kind in ('callout', 'self_check'));

-- The 0025 versions of these didn't know about `kind`, so they're replaced
-- rather than added to: a self-check and a call-out must be able to coexist.
drop index if exists callouts_one_open_per_target_duel;
drop index if exists callouts_one_open_per_target_comp;
drop index if exists callouts_one_per_caller_duel;
drop index if exists callouts_one_per_caller_comp;

create unique index if not exists callouts_one_open_per_target_duel
    on public.callouts (duel_id, target_email)
    where duel_id is not null and kind = 'callout' and status in ('pending','active');
create unique index if not exists callouts_one_open_per_target_comp
    on public.callouts (competition_id, target_email)
    where competition_id is not null and kind = 'callout' and status in ('pending','active');
create unique index if not exists callouts_one_per_caller_duel
    on public.callouts (duel_id, caller_email)
    where duel_id is not null and kind = 'callout' and status in ('pending','active');
create unique index if not exists callouts_one_per_caller_comp
    on public.callouts (competition_id, caller_email)
    where competition_id is not null and kind = 'callout' and status in ('pending','active');
create unique index if not exists callouts_one_open_self_check_duel
    on public.callouts (duel_id, target_email)
    where duel_id is not null and kind = 'self_check' and status in ('pending','active');
create unique index if not exists callouts_one_open_self_check_comp
    on public.callouts (competition_id, target_email)
    where competition_id is not null and kind = 'self_check' and status in ('pending','active');

create index if not exists callouts_immunity_idx
    on public.callouts (target_email, immunity_until)
    where immunity_until is not null;

-- ── 0027 — Study quests ─────────────────────────────────────────────────────
alter table public.study_bets
    -- Which quest this is. Null on rows created before this migration, which
    -- the settlement engine still handles through the old metric path.
    add column if not exists quest_id text,
    -- Snapshot of the promise as the student saw it, so a later catalogue edit
    -- can't silently change the terms of a wager already in flight.
    add column if not exists quest_snapshot jsonb not null default '{}'::jsonb,
    -- Human-readable progress for the card: "2 of 3 subjects", "4/5 cards".
    add column if not exists progress_label text;

alter table public.study_bets alter column metric drop not null;
alter table public.study_bets drop constraint if exists study_bets_metric_check;
alter table public.study_bets alter column target drop not null;
alter table public.study_bets drop constraint if exists study_bets_target_check;

create index if not exists study_bets_quest_idx
    on public.study_bets (created_by, quest_id, status);

-- ── 0028 — Mind maps ────────────────────────────────────────────────────────
-- Karpicke & Blunt (2011, Science) put concept mapping head to head with
-- retrieval practice and mapping lost. The follow-up (Blunt & Karpicke, 2014)
-- found what rescues it: mapping done as a retrieval task, closed book. So
-- `phase` isn't cosmetic — a map starts 'blind' and only becomes 'checked'
-- once the student has opened their source and marked what they missed.
create table if not exists public.mind_maps (
    id                 uuid primary key default gen_random_uuid(),
    created_by         text not null,
    created_date       timestamptz not null default now(),
    updated_date       timestamptz not null default now(),

    title              text not null,
    subject_name       text,
    topic              text,

    phase              text not null default 'blind'
                       check (phase in ('blind', 'checked')),
    built_from_memory  boolean not null default true,

    -- The tree: [{ id, parent, text, link, confidence, type, x, y, note }]
    nodes              jsonb not null default '[]'::jsonb,
    -- The any-to-any edges a tree can't hold: [{ id, from, to, label }]
    cross_links        jsonb not null default '[]'::jsonb,
    -- What the student didn't have, recorded when they opened their notes.
    gaps               jsonb not null default '[]'::jsonb,

    -- Rebuilt-from-memory chain, for the retention diff.
    parent_map_id      uuid references public.mind_maps(id) on delete set null,
    retention_score    int,

    minutes_spent      int not null default 0,
    extra              jsonb not null default '{}'::jsonb
);

create index if not exists mind_maps_owner_idx  on public.mind_maps (created_by, updated_date desc);
create index if not exists mind_maps_parent_idx on public.mind_maps (parent_map_id);

drop trigger if exists mind_maps_touch_updated on public.mind_maps;
create trigger mind_maps_touch_updated before update on public.mind_maps
    for each row execute function public.touch_updated_date();

alter table public.mind_maps enable row level security;

drop policy if exists "mind_maps_select_own" on public.mind_maps;
create policy "mind_maps_select_own" on public.mind_maps
    for select using (created_by = auth.email());
drop policy if exists "mind_maps_insert_own" on public.mind_maps;
create policy "mind_maps_insert_own" on public.mind_maps
    for insert with check (created_by = auth.email());
drop policy if exists "mind_maps_update_own" on public.mind_maps;
create policy "mind_maps_update_own" on public.mind_maps
    for update using (created_by = auth.email());
drop policy if exists "mind_maps_delete_own" on public.mind_maps;
create policy "mind_maps_delete_own" on public.mind_maps
    for delete using (created_by = auth.email());

-- ── 0029 — Mind maps become a per-subject brain ─────────────────────────────
-- One root map per subject, and any node can be opened as a map of its own.
-- `drill_from_*` is deliberately NOT `parent_map_id` — that already means
-- "the map I rebuilt this from" for the retention diff, and collapsing two
-- different relationships into one column would make both unreliable.
alter table public.mind_maps
    add column if not exists is_subject_root    boolean not null default false,
    add column if not exists drill_from_map_id  uuid references public.mind_maps(id) on delete set null,
    add column if not exists drill_from_node_id text;

-- One root per subject per student, enforced here rather than in the client:
-- a double-click on a slow connection is otherwise enough to create two roots
-- that can never be merged.
create unique index if not exists mind_maps_subject_root_unique
    on public.mind_maps (created_by, subject_name)
    where is_subject_root and subject_name is not null;

create index if not exists mind_maps_drill_idx
    on public.mind_maps (drill_from_map_id, drill_from_node_id);

create index if not exists mind_maps_subject_idx
    on public.mind_maps (created_by, subject_name, updated_date desc);

-- ── 0030 — AI spend tracked in micro-dollars ────────────────────────────────
-- The weekly ceiling was leaking. Spend was stored as an integer number of
-- cents and every estimate rounded to the nearest cent, so anything under half
-- a cent recorded as zero. A typical Ace chat turn costs $0.0007 — it recorded
-- nothing, every time, and the only thing bounding the busiest AI feature in
-- the app was its daily message counter.
--
-- A micro-dollar is one millionth of a dollar, fine enough that the cheapest
-- call we can make still registers in the hundreds.
--
--   weekly_ai_cost_micros    premium rolling weekly spend; ceiling 1,950,000
--                            (= $1.95 USD, about $3.00 AUD)
--   lifetime_ai_cost_micros  free-tier lifetime spend; ceiling 1,000,000 ($1.00)
--
-- The cents columns stay and are still written by the server, so rolling back
-- to the previous release keeps a working (if coarse) ceiling rather than none.
alter table public.user_profiles
    add column if not exists weekly_ai_cost_micros   bigint not null default 0,
    add column if not exists lifetime_ai_cost_micros bigint not null default 0;

-- Backfill so nobody's accrued spend resets on deploy. Guarded on BOTH columns
-- being zero, so re-running this script cannot overwrite spend the new server
-- has already recorded. Understates real history — the cents figure was itself
-- missing every sub-half-cent call — but never overstates it.
update public.user_profiles
   set weekly_ai_cost_micros   = coalesce(weekly_ai_cost_cents, 0)   * 10000,
       lifetime_ai_cost_micros = coalesce(lifetime_ai_cost_cents, 0) * 10000
 where weekly_ai_cost_micros = 0
   and lifetime_ai_cost_micros = 0;

create index if not exists user_profiles_lifetime_micros_idx
    on public.user_profiles (lifetime_ai_cost_micros);

-- ── 0031 — students choose how fast they spend the week ─────────────────────
-- The weekly ceiling is denominated in dollars, so the model a student's work
-- runs on decides how much work that ceiling contains. Sonnet is $3/$15 per
-- million tokens and Haiku is $1/$5 — exactly a third — so a week that runs
-- out on Thursday in Standard reaches Sunday in Saver.
--
--   standard  the default. Best quality, ceiling arrives sooner.
--   saver     roughly 3x more work from the same ceiling, shorter answers.
--
-- Never switched automatically by the server. Quietly downgrading someone's
-- output to protect a budget they cannot see is how an app gets a reputation
-- for having "got worse", with no way for the student to find out why.
alter table public.user_profiles
    add column if not exists ai_model_preference text not null default 'standard';

-- Constrained rather than free text: this value picks a model id on the server,
-- and an unrecognised one there bills at the dearest rate in the price table,
-- which would be a silent bill rather than a visible error.
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

-- ────────────────────────────────────────────────────────────────────────────
-- 0032 — let a student put a card away without destroying it
-- ────────────────────────────────────────────────────────────────────────────
-- The review queue had exactly one exit: is_active = false, which is deletion.
-- So somebody who genuinely knows the definition of osmosis could either keep
-- being asked forever, or lose the card. Neither is what they meant, and the
-- result was a due count that only ever climbed until students stopped
-- reading it.
--
--   retired_at     "I know this." Out of the queue indefinitely, reversible,
--                  and timestamped so the audit screen can say when they
--                  decided that.
--   snoozed_until  "Not today." Clears a pile without claiming knowledge they
--                  do not have, which is what keeps the scheduler's data
--                  honest. Lateness is measured from the later of this and
--                  next_review_date, so a deliberate deferral never reads as
--                  a lapse.
--
-- Both nullable with no default, so every existing row behaves exactly as it
-- does today and there is nothing to backfill.
alter table public.flashcards
    add column if not exists retired_at    timestamptz,
    add column if not exists snoozed_until date;

-- The due query runs per user on every dashboard load. A partial index keeps
-- it off the retired pile entirely, which is the part that only ever grows.
create index if not exists flashcards_due_queue_idx
    on public.flashcards (created_by, next_review_date)
    where is_active and retired_at is null;

create index if not exists flashcards_retired_idx
    on public.flashcards (created_by, retired_at)
    where retired_at is not null;

-- ────────────────────────────────────────────────────────────────────────────
-- 0033 — one weekly stack of chips, replacing eleven per-feature daily caps
-- ────────────────────────────────────────────────────────────────────────────
-- The app had two limits, sized separately, that contradicted each other:
-- per-feature daily counters and a weekly dollar ceiling. Priced against the
-- real cost table, maxing every daily cap for a week came to 4.5x what the
-- dollar ceiling permitted. So a heavy student hit the money wall on day two
-- having been told all week they had three quizzes a day, and a light student
-- could not do a big Saturday session on 15% of their budget.
--
-- Chips are one pool, spent however the student likes, at published prices
-- that are rounded UP from measured cost — so a full stack always costs us
-- less than the ceiling, never more.
--
-- weekly_ai_cost_micros is untouched and keeps recording what calls actually
-- cost, backstopping the chip gate. If a price in src/lib/chips.js were ever
-- set below its real cost, the micro ceiling still catches it.
--
-- Not backfilled on purpose: the app derives a chip count from the existing
-- micro ledger for any row still at zero, so students mid-week keep the spend
-- they have already made rather than being handed a fresh stack on deploy day.
alter table public.user_profiles
    add column if not exists weekly_chips_spent int not null default 0;

-- Burst protection, the one useful job the daily caps were doing. A rolling
-- window rather than per-feature counts: {"since": iso, "chips": n}.
alter table public.user_profiles
    add column if not exists ai_burst jsonb not null default '{}'::jsonb;

-- ── 0034 — reactions on the Compete feed ────────────────────────────────────
-- Compete now opens on a feed of what people did to each other, and a feed
-- nobody can answer is a broadcast. One tap is the smallest possible answer.
--
-- NO FREE TEXT, and that is the design rather than a first cut: these are
-- sixteen-year-olds losing in front of their group sometimes, and a text box on
-- that is a moderation problem the app cannot staff. The glyph is checked here
-- as well as on the server.
--
-- Keyed on the feed EVENT ("callout:<uuid>:passed"), not on a row — most feed
-- events are derived and have no row of their own, and keying on the moment
-- means a call-out passing later collects its own reactions rather than
-- inheriting the ones left when it was issued.
--
-- Without this the feature is simply absent: getReactions answers
-- available:false on a missing table and the buttons never render.
create table if not exists public.compete_reactions (
    id            uuid primary key default gen_random_uuid(),
    created_by    text not null,
    created_date  timestamptz not null default now(),
    event_key     text not null,
    duel_id        uuid references public.study_duels(id) on delete cascade,
    competition_id uuid references public.goal_competitions(id) on delete cascade,
    emoji         text not null check (emoji in ('👀','🔥','😮','👏','🧊')),
    -- One reaction per person per event, so a feed cannot be brigaded by one
    -- account holding down a button.
    unique (created_by, event_key)
);

create index if not exists compete_reactions_event_idx on public.compete_reactions (event_key);
create index if not exists compete_reactions_comp_idx  on public.compete_reactions (competition_id)
    where competition_id is not null;
create index if not exists compete_reactions_duel_idx  on public.compete_reactions (duel_id)
    where duel_id is not null;

alter table public.compete_reactions enable row level security;

-- Readable by anyone in the contest it is scoped to, and by nobody else. There
-- is deliberately NO insert policy: writes go through server.mjs under the
-- service role, which is where the "are you in this battle" check lives. The
-- client must not be able to invent a scope for itself.
drop policy if exists "compete_reactions readable by participants" on public.compete_reactions;
create policy "compete_reactions readable by participants"
    on public.compete_reactions for select
    using (
        (competition_id is not null and exists (
            select 1 from public.goal_competitions c
            where c.id = compete_reactions.competition_id
              and c.participants @> jsonb_build_array(jsonb_build_object('email', auth.jwt() ->> 'email'))
        ))
        or (duel_id is not null and exists (
            select 1 from public.study_duels d
            where d.id = compete_reactions.duel_id
              and (d.challenger_email = auth.jwt() ->> 'email'
                or d.opponent_email = auth.jwt() ->> 'email')
        ))
    );

-- ── 0035 — publish the compete tables to realtime ───────────────────────────
-- LiveContext polls every 45 seconds while a contest is running, which is what
-- ships and is fine. This makes a rival's score arrive when it changes instead
-- of up to 45 seconds later.
--
-- The push is a TRIGGER, not a data source: src/api/realtime.js throws the
-- changed row away and refetches through the normal reads, so this cannot
-- become a second channel where "what the client was told" stands in for what
-- the server knows. Realtime respects RLS, so a student is only notified about
-- rows they could already read; nothing here widens any policy.
--
-- Entirely optional. Without it the poll carries the whole job and the app
-- behaves identically, just a little later.
do $$
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;
end $$;

do $$
declare
    t text;
begin
    foreach t in array array['goal_competitions', 'study_duels', 'callouts']
    loop
        if to_regclass('public.' || t) is null then
            continue;
        end if;
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end $$;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- 0036: Markets — the one object Compete is rebuilt on.
--
-- Until this runs, /Competitions says "the floor isn't open yet" rather than
-- showing an empty board that looks like nobody is playing. Everything else in
-- the app is unaffected.
-- ════════════════════════════════════════════════════════════════════════════
-- 0036: Markets — the one object Compete is rebuilt on.
--
-- ── Why one table replaces seven ──────────────────────────────────────────
-- Compete carried seven nouns that all meant "a thing you can win": battles,
-- duels, call-outs, forecasts, progress bets, back-yourself bets and the
-- weekly league. Seven mental models to learn before a student could do
-- anything, which is why the page read as confusing however it was styled.
--
-- A market is a question, a price, a side and a resolution. A battle is a
-- market on who wins it; a call-out is a market with a clock; a SAC is a
-- market on a number; hours and streaks are markets on a study log. One row
-- shape, one card, one gesture, one settlement.
--
-- ── The price is a blend, not an order book ───────────────────────────────
-- Thirty active students cannot fill a two-sided book: every market would sit
-- empty and read as broken. The price is the house prior moved by staked
-- conviction (see priceOf in src/lib/market.js), so there is always a price,
-- it always moves toward conviction, and nobody needs a counterparty to take
-- a side. Nothing about the pricing lives in SQL — it is derived from the
-- positions on every read, so it cannot go stale or disagree with them.
--
-- ── Cred, not XP and not chips ────────────────────────────────────────────
-- XP drives level, rank and the ATAR, so staking it makes the rational play
-- "never bet" — a market where abstaining is optimal is not a market. And
-- `chips` is already the weekly AI budget (0033), so reusing it would conflate
-- "can I afford to ask Ace" with "can I afford a position". Cred is granted
-- weekly and capped; the grant is the Monday reason to come back.

-- ── markets ───────────────────────────────────────────────────────────────
create table if not exists public.markets (
    id              uuid primary key default gen_random_uuid(),
    kind            text not null
        check (kind in ('streak','hours','quiz','callout','battle','sac')),
    -- Who the market is ABOUT. Load-bearing: a market about you sorts first on
    -- the board, and for a self-resolving kind this is exactly the person who
    -- may not hold a position on it.
    subject_email   text not null,
    subject_name    text,
    -- Who opened it. For a call-out this is the caller, who also may not hold.
    created_by      text not null,
    caller_email    text,
    title           text not null,
    -- Where the answer will come from, in prose. A market that cannot say how
    -- it resolves is not a question anybody can judge as fair.
    resolves_note   text,

    -- The house's opening probability. It stays the anchor for the whole life
    -- of the market: the price blends prior and conviction rather than
    -- replacing one with the other, so the first small stake cannot become
    -- the price.
    prior           numeric not null default 0.5 check (prior >= 0 and prior <= 1),

    status          text not null default 'open'
        check (status in ('open','resolved','void')),
    -- Recomputed by the server on resolution and NEVER accepted from a client.
    outcome         boolean,
    resolution_note text,

    opens_at        timestamptz not null default now(),
    closes_at       timestamptz,
    resolved_at     timestamptz,

    -- Scope. A market lives in a contest room, never on the open site: open to
    -- everyone, two accounts could stage a question for a third to collect on.
    -- Null means the weekly league, which every student is already in.
    competition_id  uuid,
    duel_id         uuid,

    -- kind-specific: threshold, subject, quiz_id, callout_id, competitor emails.
    meta            jsonb not null default '{}'::jsonb,

    created_date    timestamptz not null default now(),
    updated_date    timestamptz not null default now()
);

-- Guarded like everything in PENDING_run_me.sql: that file's contract is that
-- the whole thing is safe to paste twice, and a bare `create` breaks it.
create index if not exists markets_status_idx   on public.markets (status, closes_at);
create index if not exists markets_subject_idx  on public.markets (subject_email);
create index if not exists markets_comp_idx     on public.markets (competition_id)
    where competition_id is not null;
-- One live market per question. Without this, a mint that runs twice — two
-- students opening the board in the same second — puts the same question on
-- the board twice with the stakes split between the copies.
create unique index if not exists markets_dedupe_idx
    on public.markets (kind, subject_email, (meta ->> 'period'), (meta ->> 'ref'))
    where status = 'open';

-- ── positions ─────────────────────────────────────────────────────────────
create table if not exists public.market_positions (
    id              uuid primary key default gen_random_uuid(),
    market_id       uuid not null references public.markets(id) on delete cascade,
    user_email      text not null,
    user_name       text,

    -- The probability stated, 0-1. A side plus a conviction collapses to this;
    -- the scoring rule only ever needs the one number.
    p               numeric not null check (p >= 0 and p <= 1),
    stake           integer not null check (stake > 0),

    -- THE PRICE AT ENTRY, frozen. The payout is scored against what the crowd
    -- believed when this position was taken, not against where the price
    -- finished — repricing at settlement would change the deal after the fact,
    -- which is the rule settleForecast already keeps about base rates.
    price_at_entry  numeric not null check (price_at_entry >= 0 and price_at_entry <= 1),

    payout          integer,
    settled_at      timestamptz,
    created_date    timestamptz not null default now(),

    -- ONE POSITION PER PERSON PER MARKET. Without it you could hold 5% and 95%
    -- on the same question and be paid for whichever landed, which is a way of
    -- buying a guaranteed return out of a proper rule.
    unique (market_id, user_email)
);

create index if not exists market_positions_market_idx on public.market_positions (market_id);
create index if not exists market_positions_user_idx   on public.market_positions (user_email, settled_at);

-- ── cred ──────────────────────────────────────────────────────────────────
-- On user_profiles rather than its own ledger table: the balance is read on
-- every board load and a join for one integer is not worth it. The weekly
-- grant is idempotent through `cred_granted_week` — a date, so a second call
-- in the same week is a no-op rather than a second grant.
alter table public.user_profiles
    add column if not exists cred_balance      integer not null default 0,
    add column if not exists cred_granted_week date,
    add column if not exists cred_lifetime_won integer not null default 0;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.markets          enable row level security;
alter table public.market_positions enable row level security;

-- Markets are readable by any signed-in student. The CONTEST scope is enforced
-- server-side on the write path, where the membership check lives — the same
-- posture callouts and reactions take, and for the same reason: the client
-- must never be able to invent a scope for itself. Reading a question nobody
-- can act on is harmless; writing a position into a room you are not in is not.
drop policy if exists "markets readable" on public.markets;
create policy "markets readable" on public.markets
    for select using (auth.role() = 'authenticated');

-- Positions are public ON PURPOSE. "8 backing yes, 3 backing no" with names is
-- the whole social spectacle — a market where nobody can see who is on which
-- side is a private bet, which is what the old wagering layer was.
drop policy if exists "positions readable" on public.market_positions;
create policy "positions readable" on public.market_positions
    for select using (auth.role() = 'authenticated');

-- Every write goes through the server under the service role: it escrows the
-- stake, freezes the price, enforces who may hold a side, and recomputes every
-- outcome from the study tables. None of that can be trusted to a client, and
-- there is no insert or update policy here precisely so none of it can be
-- attempted from one.

-- ── Realtime ──────────────────────────────────────────────────────────────
-- A faster trigger, never a second source of truth: src/api/realtime.js throws
-- the changed row away and refetches through the normal reads, so the push
-- path and the poll path cannot disagree about a price.
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'markets'
        ) then
            alter publication supabase_realtime add table public.markets;
        end if;
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'market_positions'
        ) then
            alter publication supabase_realtime add table public.market_positions;
        end if;
    end if;
end $$;
