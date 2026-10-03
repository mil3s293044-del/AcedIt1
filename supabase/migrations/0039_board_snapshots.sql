-- 0039 — board_snapshots: where everybody stood when the week opened.
--
-- WHY A TABLE AND NOT A COLUMN. The board draws movement on EVERY row, not
-- just the viewer's, so the snapshot has to cover the whole field. Written per
-- student — `leaderboards.extra`, or `user_profiles.extra` — that is 300 rows
-- to write and 300 to read back, and PostgREST has no bulk update with
-- per-row values except an upsert, which `syncBoardRow` records being unable
-- to use here: an upsert sets every column it carries on conflict, so it would
-- quietly clear `is_anonymous` for anybody who had turned it on.
--
-- ONE ROW PER BOARD PER WEEK, holding `{ email: rank }`. One read, one insert,
-- three rows a week for the whole site. And it is the stronger design as well
-- as the cheaper one: every row's movement is measured against the SAME
-- snapshot, taken at one instant, so two students cannot be told their places
-- moved relative to different moments.
--
-- WRITTEN LAZILY, by whoever opens Ranked first in a given week — the same
-- posture as the league's settlement, the market sweep and the ATAR sweep,
-- which is the trade this codebase takes everywhere rather than introduce a
-- scheduler. The unique index is what makes that safe: two students opening
-- the board in the same second cannot write two snapshots for one week with
-- half the field in each.
--
-- AND A MISSING SNAPSHOT DRAWS NOTHING. There is no fallback to "assume they
-- were last" — inventing a position would print a student a promotion they did
-- not earn, which is the one error a movement column must never make. See
-- `movementMap` in src/lib/boardMovement.js.

create table if not exists public.board_snapshots (
    id            uuid primary key default gen_random_uuid(),
    week_start    date not null,
    board         text not null,              -- "atar" | "xp" | "time"
    ranks         jsonb not null default '{}'::jsonb,
    created_date  timestamptz not null default now()
);

-- THE DEDUPE, and the read. Unique so a concurrent second write is a 23505
-- the writer can ignore rather than a split snapshot.
create unique index if not exists board_snapshots_week_board_idx
    on public.board_snapshots (week_start, board);

alter table public.board_snapshots enable row level security;

-- NO POLICY, so the client cannot read or write it at all. `getRankedBoards`
-- sends the positions of the rows it is already sending and nothing else, so
-- the payload is no more revealing than the board itself — but the table holds
-- the WHOLE field, including students outside the viewer's scope, and a client
-- that could select it would have a list of everybody's standing regardless of
-- who they are allowed to see. READS AND WRITES GO THROUGH THE SERVICE ROLE.
