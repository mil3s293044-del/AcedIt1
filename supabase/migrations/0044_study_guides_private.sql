-- 0044 — student-written study guides stop being published.
--
-- WHAT WAS WRONG. /Guides was a page of posts: any signed-in student could
-- insert one (`study_guides_insert_own`) and every signed-in student could
-- read every one (`study_guides_select_all`), with an `is_featured` flag the
-- author set on their own post. Free text between students, published to the
-- whole site, with nothing checking a word of it — the thing migration 0034
-- refused for Compete and the group chat was taken out for in 0043.
--
-- WHAT REPLACES IT. Nothing. The page was briefly rebuilt from what the app
-- already knows and has since been retired altogether (/Guides now redirects
-- to /Help). Nothing in the app reads this table any more.
--
-- So nobody may write a new post or edit one, and nobody may read anybody
-- else's. The AUTHOR keeps read and delete on their own rows, because account
-- deletion (Settings → accountTables, "Study guides") reads them in order to
-- remove them, and a student is owed both.
--
-- Safe to run twice. Apply any time after the deploy that took the
-- student-written page down; until it runs, the posts are still readable
-- through the API by any signed-in student.

drop policy if exists "study_guides_select_all" on public.study_guides;
drop policy if exists "study_guides_insert_own" on public.study_guides;
drop policy if exists "study_guides_update_own" on public.study_guides;
drop policy if exists "study_guides_select_own" on public.study_guides;

create policy "study_guides_select_own" on public.study_guides
    for select using (created_by = auth.email());

-- `study_guides_delete_own` (0003) stays as it was.
alter table public.study_guides enable row level security;
