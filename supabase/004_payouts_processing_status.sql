-- NIM-ARCADE — adds a 'processing' status to payouts (run after schema.sql)
-- Dashboard → SQL Editor → paste this whole file → Run.
--
-- Used by supabase/functions/process-payouts as an optimistic lock: it flips
-- a row from 'pending' to 'processing' before signing/broadcasting, so two
-- overlapping runs of the function can never send the same payout twice.

alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check
  check (status in ('pending', 'processing', 'sent', 'failed'));
