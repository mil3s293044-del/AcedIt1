-- 0027: Back Yourself becomes quests.
--
-- The original bet was a metric and a number — "300 XP in 72 hours". That is a
-- wager on a counter, and a counter is the thing students already game: it
-- rewards grinding whatever is cheapest, which is the behaviour the rest of
-- the app is trying to move away from.
--
-- A quest names a specific act instead ("try a technique you've never used",
-- "plan your weekend before it starts"), so the promise is a decision rather
-- than a total. The catalogue lives in src/lib/quests.js and is shared with
-- the server, which verifies each one against records the app already keeps.
--
-- Numeric bets aren't deleted: three of the quests are metric-shaped, and every
-- existing row keeps working untouched.

alter table public.study_bets
    -- Which quest this is. Null on rows created before this migration, which
    -- the settlement engine still handles through the old metric path.
    add column if not exists quest_id text,
    -- Snapshot of the promise as the student saw it, so a later catalogue edit
    -- can't silently change the terms of a wager already in flight.
    add column if not exists quest_snapshot jsonb not null default '{}'::jsonb,
    -- Human-readable progress for the card: "2 of 3 subjects", "4/5 cards".
    add column if not exists progress_label text;

-- `metric` was NOT NULL with a four-value check, which a quest like
-- "plan your weekend" has no sensible answer for. Widen it rather than
-- inventing a fake metric per quest.
alter table public.study_bets alter column metric drop not null;
alter table public.study_bets drop constraint if exists study_bets_metric_check;

-- Same story for `target`: a quest's success condition isn't always a number.
alter table public.study_bets alter column target drop not null;
alter table public.study_bets drop constraint if exists study_bets_target_check;

create index if not exists study_bets_quest_idx
    on public.study_bets (created_by, quest_id, status);
