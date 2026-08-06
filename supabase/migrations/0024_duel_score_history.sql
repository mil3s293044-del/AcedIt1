-- ════════════════════════════════════════════════════════════════════════════
-- 0024 — score trail for duels
-- ════════════════════════════════════════════════════════════════════════════
-- Duel scores are computed fresh from xp_events on every read rather than
-- stored, so a duel had a current score and no past. That's enough to say who
-- is ahead and nothing else: no momentum, no swing, and no win-probability
-- line, which group battles get because migration-free score_history was added
-- to their participants jsonb.
--
-- One row per duel with a capped trail of both sides' scores. Shape:
--   [{ "t": "<iso>", "a": <challenger score>, "b": <opponent score> }, …]
-- Appended at most every few hours by loadMyArenaCore, capped at 40 points —
-- enough to draw the line across the longest duel window (1 week).

alter table public.study_duels
    add column if not exists score_history jsonb not null default '[]'::jsonb;
