-- NIM-ARCADE — delete test rows created while verifying changes against a
-- real Supabase-backed local dev server (mock SDK, but backend sync is real).
--
-- HOW TO APPLY: Supabase dashboard → SQL Editor → paste and run.
-- Safe to re-run any time — going forward, throwaway test nicknames used
-- during dev verification are always prefixed "QA" specifically so this one
-- query keeps catching them without needing an edit every session.
--
-- Scoped tightly to display_name AND the mock SDK's fixed dev address
-- (see MockNimiqSDK in src/lib/nimiq.ts) so this can't accidentally catch
-- a real player who happened to pick a similar nickname.

select id, display_name, nimiq_address, created_at
from public.players
where (display_name like 'QA%' or display_name in ('TestPlayer', 'ContrastCheck'))
  and nimiq_address = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';

-- Review the preview above, then run:
delete from public.players
where (display_name like 'QA%' or display_name in ('TestPlayer', 'ContrastCheck'))
  and nimiq_address = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
