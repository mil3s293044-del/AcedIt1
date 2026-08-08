-- 0029: mind maps become a per-subject brain rather than a pile of documents.
--
-- Three things change.
--
-- 1. Each subject gets ONE root map. Everything else in that subject hangs off
--    it, so "open Biology" always lands somewhere rather than asking which of
--    fourteen maps you meant. The partial unique index enforces it at the
--    database rather than in the client, because a double-click on a slow
--    connection is otherwise enough to create two roots that can never be
--    merged.
--
-- 2. A node can be opened as its own map. `drill_from_map_id` +
--    `drill_from_node_id` record which node this map expands, which is what
--    makes the breadcrumb and the "has a sub-map" badge possible. This is
--    deliberately NOT `parent_map_id` — that already means "the map I rebuilt
--    this from" for the retention diff, and collapsing two different
--    relationships into one column would make both of them unreliable.
--
-- 3. Nodes gain type, free position and notes. Those live inside the existing
--    `nodes` jsonb, so no column is needed:
--       { id, parent, text, link, confidence, type, x, y, pinned, note }
--    `type` ('idea' | 'cause' | 'effect' | 'step' | 'term' | 'example' |
--    'evidence' | 'question') is what makes the export into flashcards and
--    recall sessions structural rather than a guess — a term with a note is a
--    definition card, a question node is a recall prompt.
--
--    `cross_links` already holds the any-to-any edges the student draws by
--    hand, so it carries the graph: [{ id, from, to, label }].

alter table public.mind_maps
    add column if not exists is_subject_root   boolean not null default false,
    add column if not exists drill_from_map_id uuid references public.mind_maps(id) on delete set null,
    add column if not exists drill_from_node_id text;

-- One root per subject per student. Null subjects are exempt: a map with no
-- subject can't be a subject root, and NULL wouldn't group in a unique index
-- anyway.
create unique index if not exists mind_maps_subject_root_unique
    on public.mind_maps (created_by, subject_name)
    where is_subject_root and subject_name is not null;

create index if not exists mind_maps_drill_idx
    on public.mind_maps (drill_from_map_id, drill_from_node_id);

create index if not exists mind_maps_subject_idx
    on public.mind_maps (created_by, subject_name, updated_date desc);
