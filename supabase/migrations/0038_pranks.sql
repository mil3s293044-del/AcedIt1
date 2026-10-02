-- 0038 — pranks: a small, bounded, named social action.
--
-- WHY A TABLE AT ALL. A prank is delivered to somebody ELSE, and everything the
-- cred store writes lives in the sender's own `user_profiles.extra`, which the
-- recipient cannot read. `compete_reactions` was the obvious table to reuse —
-- migration 0034's — and it is keyed to a competition or a duel, so a prank
-- would have had to invent a meaning for a column it does not have.
--
-- WHAT BOUNDS IT, because migration 0034 ruled out unmoderated student-to-
-- student content on Compete in its own words and this is student-to-student
-- content. Four bounds, and the first two are the ones that matter:
--
--   1. A FIXED VOCABULARY. There is no free text anywhere in this table. The
--      `kind` is one of a handful the client knows how to draw, and anything
--      else renders nothing. Nobody can say anything to anybody.
--   2. A RECEIVE CAP. A send cap alone stops one student spamming; it does
--      nothing about twelve students arriving at once. The weekly ceiling on
--      what a person RECEIVES is what makes a dogpile impossible.
--   3. FRIENDS ONLY, mutual and accepted. The difference between a classmate
--      you know and a stranger on a public board choosing a target.
--   4. THE SENDER IS NAMED on the thing itself, always. There is no anonymous
--      prank, which is most of why this stays playful.
--
-- `week_start` is denormalised so the weekly counts are an indexed count rather
-- than a scan with date arithmetic in the predicate.

create table if not exists public.pranks (
    id            uuid primary key default gen_random_uuid(),
    created_by    text not null,              -- the sender, always shown
    target_email  text not null,
    kind          text not null,              -- a fixed vocabulary; see pranks.js
    week_start    date not null,
    created_date  timestamptz not null default now(),
    seen_at       timestamptz,
    extra         jsonb not null default '{}'::jsonb
);

-- The two counts the caps are enforced on, and the inbox read.
create index if not exists pranks_target_week_idx on public.pranks (target_email, week_start);
create index if not exists pranks_sender_week_idx on public.pranks (created_by, week_start);
create index if not exists pranks_inbox_idx on public.pranks (target_email, seen_at);

alter table public.pranks enable row level security;

-- A student may READ what was sent to them and what they sent. Nothing else:
-- who pranked whom across the school is not anybody's business, and a client
-- that could read it would be a list of who is targeting whom.
drop policy if exists pranks_read_own on public.pranks;
create policy pranks_read_own on public.pranks
    for select using (
        target_email = auth.jwt() ->> 'email'
        or created_by = auth.jwt() ->> 'email'
    );

-- WRITES GO THROUGH THE SERVICE ROLE ONLY. Every bound above — the caps, the
-- friendship, the opt-out, the charge — is checked in `sendPrank`, and a client
-- that could insert directly would walk past all four.
