-- 0037: The special lines — four more QUESTIONS, still one object.
--
-- ── What this fixes, which is a board nobody can read ─────────────────────
-- 0036 shipped minting at two markets per member per week over the whole
-- roster. That is ~264 questions a week for ~132 accounts, most of whom have
-- not opened the app since the migration. Meanwhile ~30 active students take
-- maybe 110 positions between them in a week, so the board averaged UNDER HALF
-- A TRADER PER MARKET and most questions ended the week untouched.
--
-- The failure is structural rather than cosmetic: supply scaled with signups
-- and demand scaled with actives, so the floor got WORSE as the app grew. A
-- market site has to do the opposite — more people must mean more traders per
-- question, not more questions. The target is roughly fifteen markets, which
-- is about seven traders each and a price that means something.
--
-- Getting there is three cuts, and only the third needs SQL:
--   · mint solo markets only about students who have studied recently
--     (which also closes the farm described below),
--   · one solo question per person instead of two — streak and hours about
--     the same person are the same question asked twice,
--   · and stand several solo markets down in favour of one line the whole
--     room can argue about. That is what these kinds are for.
--
-- ── The farm 0036 left open ───────────────────────────────────────────────
-- A student with fewer than MARKET_MIN_OBS observed weeks gets prior 0.5, so
-- "Will <dormant since May> study 5+ days this week?" priced at 50¢ and
-- resolved NO with near-certainty. Taking NO at 97% paid +125 on a 500 stake,
-- risk-free, across ~200 such markets. The activity gate in server.mjs is the
-- fix; it is recorded here because this migration is what makes that gate
-- possible to ship without stranding the kinds it mints instead.
--
-- ── Four kinds, and why that is not seven nouns again ─────────────────────
-- `kind` picks a glyph and a sentence. It does not pick a card, a gesture, a
-- settlement path or a mental model — every one of these renders through
-- MarketCard, prices through priceOf, pays through payoutFor and resolves in
-- settleDueMarkets. That is the line between a variant and a feature, and it
-- is the line the Compete rebuild was about.
--
--   versus    two students' logs side by side. Stands where two solo markets
--             stood, and is more interesting than either: a rivalry has two
--             people the room knows and a real argument in it.
--   cohort    the whole board's week as one question. Best value per row on
--             the floor — one market, thirty people with a genuine view, and
--             nobody needs to know the subject to hold an opinion.
--   longshot  a deliberately unlikely question, where the long price is the
--             draw. Safe to offer because the payout is scored on your edge
--             against the price and never on the odds, so agreeing that
--             something is unlikely pays exactly nothing.
--   prep      whether somebody starts work before an assessment on their own
--             planner. Resolves off the study log, so it needs no mark
--             reported and publishes no mark — see the note in server.mjs
--             about why the planner mints this and not a SAC mark line.
--
-- Idempotent: safe to run twice, and safe to run before or after 0036.

-- ── The kind constraint ───────────────────────────────────────────────────
-- Dropped and recreated rather than altered, because a check constraint
-- cannot be extended in place. Named explicitly so a re-run finds it: the
-- inline `check (...)` in 0036 got Postgres's generated name, which differs
-- between a fresh apply and one where 0036 ran first.
do $$
declare
    c text;
begin
    if to_regclass('public.markets') is null then
        raise notice '0037: public.markets does not exist yet — run 0036 first.';
        return;
    end if;

    for c in
        select con.conname
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace nsp on nsp.oid = rel.relnamespace
        where nsp.nspname = 'public'
          and rel.relname = 'markets'
          and con.contype = 'c'
          and pg_get_constraintdef(con.oid) ilike '%kind%'
    loop
        execute format('alter table public.markets drop constraint %I', c);
    end loop;

    alter table public.markets
        add constraint markets_kind_check
        check (kind in ('streak','hours','quiz','callout','battle','sac',
                        'versus','cohort','longshot','prep'));
end $$;

-- ── Board-wide markets are about nobody ───────────────────────────────────
-- `subject_email` is NOT NULL and load-bearing (it is who sorts first, and for
-- a self-resolving kind it is exactly who may not hold). A cohort or longshot
-- line is about the room rather than a person, so it carries the sentinel
-- '@board' — which is not a valid address, therefore can never collide with a
-- student, and never equals the caller so `subject_is_me` stays false without
-- a special case anywhere in the app.
comment on column public.markets.subject_email is
    'Who the market is about. The sentinel ''@board'' means the whole room '
    '(cohort and longshot lines), which is nobody, so it is never the caller.';

-- ── The dedupe index has to cover the sentinel too ────────────────────────
-- (kind, subject_email, period, ref) already does: two board-wide lines of the
-- same kind in one week differ by `ref`, which is what keeps "any 15h week"
-- and "half the board at 5 days" from colliding on '@board'. Recreated only if
-- 0036's version is missing, so this stays safe to run standalone.
create unique index if not exists markets_dedupe_idx
    on public.markets (kind, subject_email, (meta->>'period'), (meta->>'ref'))
    where status = 'open';

-- ── Finding this week's board is the hot query ────────────────────────────
-- getMarkets reads open markets on every load and the sweep reads them again.
-- Without this it is a sequential scan that grows with every settled week.
create index if not exists markets_open_idx
    on public.markets (status, closes_at)
    where status = 'open';

-- ── Positions are read per market, never as a whole table ─────────────────
-- 0036's getMarkets fetched `market_positions` with a flat limit and no market
-- filter, which silently truncates once the table passes it — and truncated
-- positions means a WRONG PRICE on every card below the cut, with nothing
-- reporting a problem. The server now filters by the markets it is returning;
-- this is the index that makes that cheap.
create index if not exists market_positions_market_idx
    on public.market_positions (market_id);
