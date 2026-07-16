-- NIM-ARCADE — admin metrics RPCs, for the standalone metrics dapp
-- (separate frontend/repo, NOT part of the arcade app itself).
-- HOW TO APPLY: Supabase dashboard → SQL Editor → paste this whole file → Run.
--
-- Adds an admin allowlist table + three read-only, aggregate-only RPC
-- functions the metrics dapp calls. Every function is `security definer`
-- (needed to read across ALL players'/payouts' rows, which RLS otherwise
-- scopes to "your own row only" per schema.sql) but starts by checking the
-- caller is in admin_players — so the elevated read access never leaks to a
-- regular player who calls these RPCs directly from devtools. None of the
-- three return individual PII rows, tx hashes, or wallet addresses — only
-- counts, sums and dates.
--
-- admin_players.player_id references auth.users(id) directly — NOT
-- public.players(id) — on purpose: the metrics dapp authenticates its own
-- anonymous Supabase sessions via a Nimiq wallet signature (see
-- 013_admin_wallet_login.sql + supabase/functions/verify-admin-wallet), so
-- an admin identity here has no corresponding row in public.players and
-- shouldn't need one.

-- Safe to re-run: an earlier draft of this migration created admin_players
-- referencing public.players(id) instead of auth.users(id) directly, but it
-- was never populated (nobody was ever added as admin), so dropping and
-- recreating it here loses no data.
drop table if exists public.admin_players cascade;

create table public.admin_players (
  player_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_players enable row level security;
-- Deliberately zero policies — nobody can read/write this table through
-- PostgREST as anon/authenticated. Only the security definer functions below
-- (which run as the table owner, bypassing RLS) and the verify-admin-wallet
-- edge function (service_role) can touch it.

create or replace function public.is_admin() returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admin_players where player_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

-- ── admin_overview_metrics ───────────────────────────────────────────────────
-- One row of KPIs: growth, active-user snapshot, and NIM volume moved.
-- active_* reads last_active_date, a single "most recent day" snapshot per
-- player (there's no daily activity log table) — so this is "active as of
-- today" for each window, not a true historical DAU/WAU/MAU trend.
-- nim_entry_fees_est is an ESTIMATE (entry_fee_nim × participant count) —
-- entry-fee payments happen on-chain straight to the house wallet
-- (src/lib/houseWallet.ts) and are never written back to this database, so
-- there's no tx-hash-verified total to sum here.
create or replace function public.admin_overview_metrics()
returns table (
  total_players bigint,
  players_with_wallet bigint,
  new_players_today bigint,
  new_players_7d bigint,
  new_players_30d bigint,
  active_today bigint,
  active_7d bigint,
  active_30d bigint,
  total_games_played bigint,
  total_high_scores bigint,
  nim_paid_out numeric,
  nim_payouts_pending numeric,
  nim_entry_fees_est numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    (select count(*) from public.players),
    (select count(*) from public.players where nimiq_address is not null and nimiq_address <> ''),
    (select count(*) from public.players where created_at::date = current_date),
    (select count(*) from public.players where created_at::date >= current_date - 6),
    (select count(*) from public.players where created_at::date >= current_date - 29),
    (select count(*) from public.players where last_active_date = current_date),
    (select count(*) from public.players where last_active_date >= current_date - 6),
    (select count(*) from public.players where last_active_date >= current_date - 29),
    (select coalesce(sum(games_played), 0) from public.players),
    (select count(*) from public.high_scores),
    (select coalesce(sum(amount_nim), 0) from public.payouts where status = 'sent'),
    (select coalesce(sum(amount_nim), 0) from public.payouts where status in ('pending', 'processing')),
    (
      (select coalesce(sum(r.entry_fee_nim), 0)
       from public.room_players rp join public.rooms r on r.id = rp.room_id)
      +
      (select coalesce(sum(t.entry_fee_nim), 0)
       from public.tournament_entries te join public.tournaments t on t.id = te.tournament_id)
    );
end;
$$;

grant execute on function public.admin_overview_metrics() to authenticated;

-- ── admin_top_games ──────────────────────────────────────────────────────────
-- Ranked by distinct players with a recorded score for that game — the
-- closest "reach" proxy available. There's no per-session play log (only
-- "current high score per player per game" in high_scores), so this counts
-- unique players who've played each game at least once, not total play count.
create or replace function public.admin_top_games(p_limit int default 10)
returns table (game_id text, unique_players bigint, avg_score numeric, top_score bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select h.game_id, count(distinct h.player_id), avg(h.score)::numeric, max(h.score)
  from public.high_scores h
  group by h.game_id
  order by count(distinct h.player_id) desc
  limit p_limit;
end;
$$;

grant execute on function public.admin_top_games(int) to authenticated;

-- ── admin_growth ─────────────────────────────────────────────────────────────
-- Daily new-signups over the last p_days days — a real historical trend,
-- unlike active_*, because players.created_at is a fixed timestamp per row.
create or replace function public.admin_growth(p_days int default 30)
returns table (day date, new_players bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  with days as (
    select generate_series(
      (current_date - (p_days - 1))::timestamp,
      current_date::timestamp,
      interval '1 day'
    )::date as day
  ),
  signups as (
    select created_at::date as day, count(*) as n
    from public.players
    where created_at::date >= current_date - (p_days - 1)
    group by 1
  )
  select d.day, coalesce(s.n, 0)
  from days d
  left join signups s on s.day = d.day
  order by d.day;
end;
$$;

grant execute on function public.admin_growth(int) to authenticated;

-- ── admin_volume_growth ──────────────────────────────────────────────────────
-- Daily NIM actually paid OUT to players (status = 'sent') over the last
-- p_days days — separate chart from signups on purpose (never combine two
-- differently-scaled measures on one dual-axis chart).
create or replace function public.admin_volume_growth(p_days int default 30)
returns table (day date, nim_paid_out numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  with days as (
    select generate_series(
      (current_date - (p_days - 1))::timestamp,
      current_date::timestamp,
      interval '1 day'
    )::date as day
  ),
  volume as (
    select created_at::date as day, sum(amount_nim) as n
    from public.payouts
    where status = 'sent' and created_at::date >= current_date - (p_days - 1)
    group by 1
  )
  select d.day, coalesce(v.n, 0)
  from days d
  left join volume v on v.day = d.day
  order by d.day;
end;
$$;

grant execute on function public.admin_volume_growth(int) to authenticated;
