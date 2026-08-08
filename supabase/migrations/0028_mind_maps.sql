-- 0028: Mind maps, built as retrieval rather than as note-taking.
--
-- Karpicke & Blunt (2011, Science) put concept mapping head to head with
-- retrieval practice and mapping lost — on recall, on inference, and even when
-- the final test was itself a concept map. Students expected the opposite.
-- The follow-up (Blunt & Karpicke, 2014) found what rescues it: mapping done
-- *as a retrieval task*, closed book, works about as well as any other
-- retrieval format.
--
-- So `phase` isn't cosmetic. A map starts 'blind' — built from memory with the
-- notes shut — and only becomes 'checked' once the student has opened their
-- source and marked what they missed. `built_from_memory` records whether that
-- discipline was actually kept, because a map filled in with notes open is
-- note-taking with extra steps and shouldn't be counted as study.
--
-- `parent_map_id` chains rebuilds of the same map so the diff between this
-- week's attempt and last week's is a retention measurement, not just a
-- version history.

create table public.mind_maps (
    id                 uuid primary key default gen_random_uuid(),
    created_by         text not null,
    created_date       timestamptz not null default now(),
    updated_date       timestamptz not null default now(),

    title              text not null,
    subject_name       text,
    topic              text,

    -- blind    → being built from memory, source not yet opened
    -- checked  → source opened, gaps marked
    phase              text not null default 'blind'
                       check (phase in ('blind', 'checked')),
    built_from_memory  boolean not null default true,

    -- The tree: [{ id, parent, text, link, confidence }]
    nodes              jsonb not null default '[]'::jsonb,
    -- The handful of real graph edges a tree can't hold: [{ from, to, label }]
    cross_links        jsonb not null default '[]'::jsonb,

    -- What the student didn't have, recorded when they opened their notes.
    -- Kept rather than merged into nodes so "what I missed" survives the fix.
    gaps               jsonb not null default '[]'::jsonb,

    -- Rebuilt-from-memory chain, for the retention diff.
    parent_map_id      uuid references public.mind_maps(id) on delete set null,
    retention_score    int,

    minutes_spent      int not null default 0,
    extra              jsonb not null default '{}'::jsonb
);

create index mind_maps_owner_idx  on public.mind_maps (created_by, updated_date desc);
create index mind_maps_parent_idx on public.mind_maps (parent_map_id);

create trigger mind_maps_touch_updated before update on public.mind_maps
    for each row execute function public.touch_updated_date();

alter table public.mind_maps enable row level security;

create policy "mind_maps_select_own" on public.mind_maps
    for select using (created_by = auth.email());
create policy "mind_maps_insert_own" on public.mind_maps
    for insert with check (created_by = auth.email());
create policy "mind_maps_update_own" on public.mind_maps
    for update using (created_by = auth.email());
create policy "mind_maps_delete_own" on public.mind_maps
    for delete using (created_by = auth.email());
