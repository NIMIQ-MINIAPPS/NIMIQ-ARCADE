-- NIM-ARCADE — delete the two test rows created while verifying the
-- previous session's changes against a real Supabase-backed dev server.
--
-- HOW TO APPLY: Supabase dashboard → SQL Editor → paste and run.
-- One-off cleanup, not meant to be re-run.
--
-- Scoped tightly to display_name AND the mock SDK's fixed dev address
-- (see MockNimiqSDK in src/lib/nimiq.ts) so this can't accidentally catch
-- a real player who happened to pick the same nickname.

select id, display_name, nimiq_address, created_at
from public.players
where display_name in ('TestPlayer', 'ContrastCheck', 'QAJumpTest')
  and nimiq_address = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';

-- Review the preview above, then run:
delete from public.players
where display_name in ('TestPlayer', 'ContrastCheck', 'QAJumpTest')
  and nimiq_address = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
