-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0012 — persist student self-marked quiz answers.
--
-- After completing a quiz, students can self-mark questions they LEFT BLANK
-- (the signal they did the work on paper). The raw `score` field stays as the
-- AI-marked-only score so XP / goals / leaderboards can't be inflated. We add
-- two new fields used purely for the user's honest reflection + AI features:
--
--  • self_marked_marks   — jsonb map of { "<questionIndex>": <marks> }
--  • adjusted_score      — int 0–100, derived total including self-marks
--
-- AI features that need a true picture of student ability (Study Roadmap,
-- Analytics, Performance coach) read coalesce(adjusted_score, score). XP and
-- goals continue to read `score` unchanged.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.quiz_attempts
  add column if not exists self_marked_marks jsonb not null default '{}'::jsonb,
  add column if not exists adjusted_score    int;

comment on column public.quiz_attempts.self_marked_marks is 'Per-question marks the student claimed for paper-and-pen work (only on questions left blank). { qIndex: marks }.';
comment on column public.quiz_attempts.adjusted_score    is 'Score (0–100) including self-marked marks. Used by AI features for accurate ability picture; score field stays untouched for XP/goals integrity.';
