-- NIM-ARCADE — remove the wallet-signature login path for the metrics dapp
-- HOW TO APPLY: Supabase dashboard → SQL Editor → paste this whole file → Run.
--
-- Superseded by email+password auth (see supabase/functions/bootstrap-admin-account)
-- — the admin's phone wallet and computer wallet are different addresses, so
-- wallet-based login couldn't work across devices for one person.
-- admin_players itself is untouched (still the allowlist the admin_* RPCs
-- check); only the wallet-key allowlist it depended on goes away.
drop table if exists public.admin_wallet_keys;
