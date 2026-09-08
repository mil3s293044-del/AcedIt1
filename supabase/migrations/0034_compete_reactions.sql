-- 0034: Reactions on the Compete feed.
--
-- The feed made Compete a place where things happen to other people. A feed
-- nobody can answer is a broadcast, and a broadcast is not social — one tap is
-- the smallest possible way to say "I saw that", and it is the difference
-- between a timeline and a log file.
--
-- ── NO FREE TEXT, DELIBERATELY ────────────────────────────────────────────
-- The reaction is one of a fixed set of glyphs the server validates. These are
-- 16-year-olds competing with each other and sometimes losing in front of the
-- group; a text box on that is a moderation problem this app has no way to
-- staff, and the fixed set gives all of the "somebody saw this" and none of it.
--
-- ── Keyed on an EVENT, not a row ──────────────────────────────────────────
-- Feed events are derived (a call-out's status change, an odds move, a battle
-- settling) and most of them have no row of their own. `event_key` is the id
-- competeFeed already computes — "callout:<uuid>:passed" — so a reaction
-- attaches to the moment rather than to the object, and the same call-out
-- passing later collects its own reactions instead of inheriting the ones left
-- when it was issued.

create table public.compete_reactions (
    id            uuid primary key default gen_random_uuid(),
    created_by    text not null,
    created_date  timestamptz not null default now(),

    -- The feed event this belongs to, as competeFeed spells it.
    event_key     text not null,

    -- Scope, so RLS can answer "may this person see this reaction" without
    -- parsing the event key. Exactly one is set, matching the call-out's own
    -- contest; a reaction is visible to the battle, like the event it is on.
    duel_id        uuid references public.study_duels(id) on delete cascade,
    competition_id uuid references public.goal_competitions(id) on delete cascade,

    emoji         text not null check (emoji in ('👀','🔥','😮','👏','🧊')),

    -- One reaction per person per event. Tapping the same glyph again removes
    -- it (the server deletes), and tapping a different one replaces it — so a
    -- feed cannot be brigaded by one account holding down a button.
    unique (created_by, event_key)
);

create index compete_reactions_event_idx on public.compete_reactions (event_key);
create index compete_reactions_comp_idx  on public.compete_reactions (competition_id)
    where competition_id is not null;
create index compete_reactions_duel_idx  on public.compete_reactions (duel_id)
    where duel_id is not null;

alter table public.compete_reactions enable row level security;

-- Readable by anyone in the contest it is scoped to. Written only through the
-- server, which is where the "are you in this battle" check lives — the same
-- posture callouts takes, and for the same reason: the client must not be able
-- to invent a scope for itself.
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
