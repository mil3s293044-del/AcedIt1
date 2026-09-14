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
