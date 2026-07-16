-- NIM-ARCADE — one-off cleanup of unclaimed/incomplete player rows
--
-- HOW TO APPLY: Supabase dashboard → SQL Editor → paste and run.
-- This is a destructive, one-time cleanup — not a schema change, so it isn't
-- meant to be re-run. Run the preview SELECT first and eyeball the count
-- before running the DELETE.
--
-- Criteria (both must be true to be KEPT): display_name was actually changed
-- from the default 'Player', AND nimiq_address is set (a wallet was
-- connected at least once). Everything else — default-named rows, and named
-- rows that never connected a wallet — gets purged. All of high_scores,
-- rooms/room_players hosted or joined, tournament_entries, and payouts
-- cascade-delete with the player per the FKs in schema.sql, so this is a
-- full account purge, not just the players row.
--
-- Note: this does not touch auth.users — the underlying anonymous auth
-- session for a deleted player is left orphaned (no PII in it, and without
-- the matching device_identifier client-side it can't be revived into a
-- populated account), which is intentional; deleting from auth.users should
-- go through the Supabase admin API, not raw SQL, and wasn't asked for here.

-- ── 1. Preview — run this first, check the count before deleting ───────────
select count(*) as rows_to_delete
from public.players
where display_name = 'Player'
   or nimiq_address is null
   or nimiq_address = '';

-- ── 2. Delete — only run once you've reviewed the count above ──────────────
delete from public.players
where display_name = 'Player'
   or nimiq_address is null
   or nimiq_address = '';
