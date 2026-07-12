-- Makes payout processing event-driven instead of purely polling-based.
-- Applied directly against the live project via the Management API on
-- 2026-07-12. Previously process-payouts only ran on a 10-minute pg_cron
-- sweep — a player converting right after a tick had passed could wait up
-- to ~10 minutes, which read as "nothing is happening" even though it was
-- working.
--
-- This trigger fires net.http_post at the instant a new 'pending' payout
-- row is inserted, so conversions and room/tournament payouts get
-- processed within seconds instead of waiting for the next sweep. The
-- pg_cron job (jobid 1, 'process-payouts-job') stays in place as a
-- fallback in case the trigger's async pg_net call ever fails — its
-- interval was tightened from */10 to */2 minutes for the same reason.
--
-- The anon key below is hardcoded on purpose, not a leaked secret — anon
-- keys are meant to be public/client-exposed by design. It's only here to
-- satisfy the Edge Function's gateway-level JWT check; the function's
-- actual authorization logic uses SUPABASE_SERVICE_ROLE_KEY internally
-- (from its own environment), not whatever caller invoked it.

create extension if not exists pg_net;

create or replace function public.trigger_process_payouts()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform net.http_post(
    url := 'https://zetsrmdshvpbvsurmpnc.functions.supabase.co/process-payouts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpldHNybWRzaHZwYnZzdXJtcG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MjAxNjksImV4cCI6MjA5OTE5NjE2OX0.0cO7DF2mWhQlL7FQKtsfRWOV5zrdKXwCPbs2ZJbXdJo',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  return new;
end;
$$;

drop trigger if exists on_payout_pending on public.payouts;
create trigger on_payout_pending
  after insert on public.payouts
  for each row
  when (new.status = 'pending')
  execute function public.trigger_process_payouts();

select cron.alter_job(1, schedule := '*/2 * * * *');
