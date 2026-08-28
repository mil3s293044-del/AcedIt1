-- ═══════════════════════════════════════════════════════════════════════════
-- AcedIt — feature reach. How many students have EVER done each thing.
-- Read-only. Paste into Supabase -> SQL Editor -> Run. Same question as
-- scripts/featureReach.mjs, minus the clone, the npm install and the
-- service-role key: for a one-off look, the dashboard is the shorter road.
--
-- Verified against Postgres 16 with seeded data, including the zero rows.
--
-- Population = students with any XP event in the last 28 days. Change the
-- interval below to widen it, or swap `active` for `everyone` at the bottom
-- to score against all signups instead.
-- ═══════════════════════════════════════════════════════════════════════════
with active as (
    select distinct coalesce(user_email, created_by) as email
    from xp_events
    where created_date >= now() - interval '28 days'
      and coalesce(user_email, created_by) is not null
),
pop as (select count(*)::numeric as n from active),

-- Every feature that leaves a row, and the row it leaves. A feature can have
-- more than one kind of evidence; they union and are counted distinctly.
evidence as (
    select 'Study'  as section, 'Pomodoro'          as feature, created_by as email from study_techniques where technique_name = 'pomodoro'
    union all select 'Study', 'Pomodoro',           coalesce(user_email, created_by) from xp_events where source in ('study_session','focus_session')
    union all select 'Study', 'Spaced repetition',  created_by from study_techniques where technique_name = 'spaced_repetition'
    union all select 'Study', 'Spaced repetition',  coalesce(user_email, created_by) from xp_events where source = 'flashcard'
    union all select 'Study', 'Active recall',      created_by from study_techniques where technique_name = 'active_recall'
    union all select 'Study', 'Active recall',      coalesce(user_email, created_by) from xp_events where source = 'active_recall'
    union all select 'Study', 'Blurting',           created_by from study_techniques where technique_name = 'blurting'
    union all select 'Study', 'Blurting',           coalesce(user_email, created_by) from xp_events where source = 'blurting'
    union all select 'Study', 'Revision Mode',      coalesce(user_email, created_by) from xp_events where source = 'mini_test'
    union all select 'Study', 'Mind maps',          created_by from mind_maps
    union all select 'Study', '  rebuilt a map',    created_by from mind_maps where phase is distinct from 'blind'
    union all select 'Study', 'Made flashcards',    created_by from flashcards
    union all select 'Study', '  reviewed any',     created_by from flashcards where coalesce(total_reviews,0) > 0

    union all select 'Test',  'Made a quiz',        created_by from quizzes
    union all select 'Test',  'Sat a quiz',         created_by from quiz_attempts
    union all select 'Test',  'Sat a quiz',         coalesce(user_email, created_by) from xp_events where source = 'quiz'

    union all select 'Plan',  'Set a goal',         created_by from goals
    union all select 'Plan',  'Planned a block',    created_by from study_plans
    union all select 'Plan',  'Added a SAC/exam',   created_by from subject_assessments

    union all select 'AI',    'Any AI tool',        created_by from ai_saved_results
    union all select 'AI',    '  ' || tool_type,    created_by from ai_saved_results

    union all select 'Social','Added a friend',     created_by from friendships
    union all select 'Social','Competition',        created_by from goal_competitions
    union all select 'Social','Wager',              created_by from score_wagers
    union all select 'Social','Study group',        created_by from study_groups
),

-- Every feature listed explicitly, so the ones NOBODY has touched still get a
-- row. They are the whole point: a feature missing from the results and a
-- feature at zero look identical, and only one of them is a finding.
catalogue(ord, section, feature) as (values
    ( 1,'Study', 'Pomodoro'),            ( 2,'Study', 'Spaced repetition'),
    ( 3,'Study', 'Active recall'),       ( 4,'Study', 'Blurting'),
    ( 5,'Study', 'Revision Mode'),       ( 6,'Study', 'Mind maps'),
    ( 7,'Study', '  rebuilt a map'),     ( 8,'Study', 'Made flashcards'),
    ( 9,'Study', '  reviewed any'),
    (10,'Test',  'Made a quiz'),         (11,'Test',  'Sat a quiz'),
    (12,'Plan',  'Set a goal'),          (13,'Plan',  'Planned a block'),
    (14,'Plan',  'Added a SAC/exam'),
    (15,'AI',    'Any AI tool'),
    (16,'AI',    '  concept_explainer'), (17,'AI',    '  math_tutor'),
    (18,'AI',    '  english_mentor'),    (19,'AI',    '  essay_planner'),
    (20,'AI',    '  exam_questions'),    (21,'AI',    '  teaching_assistant'),
    (22,'AI',    '  note_summariser'),   (23,'AI',    '  line_memoriser'),
    (24,'Social','Added a friend'),      (25,'Social','Competition'),
    (26,'Social','Wager'),               (27,'Social','Study group')
),
tally as (
    select e.feature, count(distinct e.email) as students
    from evidence e
    join active a on a.email = e.email
    group by 1
)
select
    c.section,
    c.feature,
    coalesce(t.students, 0) as students,
    (select n::int from pop) as population,
    round(100 * coalesce(t.students,0) / nullif((select n from pop), 0)) as pct,
    repeat('#', greatest(0, round(20 * coalesce(t.students,0) / nullif((select n from pop),0))::int)) as bar
from catalogue c
left join tally t on t.feature = c.feature
order by c.ord;
