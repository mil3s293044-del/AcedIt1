-- 0044 — student-written study guides stop being published.
--
-- WHAT WAS WRONG. /Guides was a page of posts: any signed-in student could
-- insert one (`study_guides_insert_own`) and every signed-in student could
-- read every one (`study_guides_select_all`), with an `is_featured` flag the
-- author set on their own post. Free text between students, published to the
-- whole site, with nothing checking a word of it — the thing migration 0034
-- refused for Compete and the group chat was taken out for in 0043.
--
-- WHAT REPLACES IT. Guides are built from what the app already knows
-- (src/lib/guides.js): the examiner notes the marker reads, VCAA's mark split,
-- and the cited science behind each technique. The page no longer reads this
-- table at all.
--
-- So nobody may write a new post or edit one, and nobody may read anybody
-- else's. The AUTHOR keeps read and delete on their own rows, because account
-- deletion (Settings → accountTables, "Study guides") reads them in order to
-- remove them, and a student is owed both.
--
-- Safe to run twice. Apply AFTER the deploy that ships the new /Guides: the
-- page before it reads every row, and would simply show an empty list.

drop policy if exists "study_guides_select_all" on public.study_guides;
drop policy if exists "study_guides_insert_own" on public.study_guides;
drop policy if exists "study_guides_update_own" on public.study_guides;
drop policy if exists "study_guides_select_own" on public.study_guides;

create policy "study_guides_select_own" on public.study_guides
    for select using (created_by = auth.email());

-- `study_guides_delete_own` (0003) stays as it was.
alter table public.study_guides enable row level security;
