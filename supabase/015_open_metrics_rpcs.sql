-- NIM-ARCADE — remove the admin gate from the metrics dapp's RPCs
-- HOW TO APPLY: Supabase dashboard → SQL Editor → paste this whole file → Run.
--
-- The metrics dapp has no login at all now — it's reachable only by URL
-- (private GitHub repo, unlisted Vercel deployment), not by any in-app
-- credential. So there's no session identity left to gate on; the four
-- admin_* RPCs are redefined here without the is_admin() check. They still
-- return ONLY aggregate counts/sums/dates, never individual player rows,
-- wallet addresses, or tx hashes — see 012_admin_metrics.sql for why that
-- matters here. Still `security definer` (needed to read across all
-- players'/payouts' rows, bypassing RLS) and still only granted to
-- `authenticated` — a caller needs *some* Supabase session (the dapp
-- establishes one anonymously, invisibly, on load), just not an admin one.
--
-- admin_players / is_admin() / admin_wallet_keys and the account-based login
-- they supported are all unused now (superseded twice: first by
-- email+password, now by no login at all) — dropped for real, not left as
-- dead code.

drop function if exists public.admin_overview_metrics();
drop function if exists public.admin_top_games(int);
drop function if exists public.admin_growth(int);
drop function if exists public.admin_volume_growth(int);
drop function if exists public.is_admin();
drop table if exists public.admin_players;

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
language sql
security definer
set search_path = public
stable
as $$
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
$$;

grant execute on function public.admin_overview_metrics() to authenticated;

create or replace function public.admin_top_games(p_limit int default 10)
returns table (game_id text, unique_players bigint, avg_score numeric, top_score bigint)
language sql
security definer
set search_path = public
stable
as $$
  select h.game_id, count(distinct h.player_id), avg(h.score)::numeric, max(h.score)
  from public.high_scores h
  group by h.game_id
  order by count(distinct h.player_id) desc
  limit p_limit;
$$;

grant execute on function public.admin_top_games(int) to authenticated;

create or replace function public.admin_growth(p_days int default 30)
returns table (day date, new_players bigint)
language sql
security definer
set search_path = public
stable
as $$
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
$$;

grant execute on function public.admin_growth(int) to authenticated;

create or replace function public.admin_volume_growth(p_days int default 30)
returns table (day date, nim_paid_out numeric)
language sql
security definer
set search_path = public
stable
as $$
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
$$;

grant execute on function public.admin_volume_growth(int) to authenticated;
