-- 0022_mock_atar.sql
-- Mock ATAR: a deliberately-not-serious engagement score. Each active subject
-- gets a mock study score (0-50) computed server-side from quiz accuracy,
-- study minutes, practice volume and streak; those aggregate into a mock
-- ATAR shown on the Ranked page and on the public XP/hours leaderboards.
-- Explicitly disclaimed in the UI as a game, not a prediction.
--
-- Lives on `leaderboards` (public-readable via leaderboards_select_all) so
-- ranking rows can show it without touching user_profiles RLS.

alter table public.leaderboards
  add column if not exists mock_atar  numeric(4, 2),
  add column if not exists mock_scores jsonb not null default '{}'::jsonb;
