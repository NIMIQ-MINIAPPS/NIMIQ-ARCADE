-- NIM-ARCADE — real per-game play counts + launch-date-bounded trend charts
-- HOW TO APPLY: Supabase dashboard → SQL Editor → paste this whole file → Run.
--
-- ── times_played ─────────────────────────────────────────────────────────────
-- high_scores previously only ever recorded a player's BEST score per game
-- ("keep the max" upsert) — there was no way to know how many times a game
-- was actually played, only how many distinct players had ever played it at
-- least once. Adds a counter that increments on every single game session,
-- record-breaking or not, so "most played games" can reflect real play
-- volume instead of just reach.
alter table public.high_scores add column if not exists times_played bigint not null default 0;

-- Backfill: can't reconstruct true historical play counts (only the best
-- score survived), so existing rows get a floor of 1 — every row here
-- represents at least one real play.
update public.high_scores set times_played = 1 where times_played = 0;

create or replace function public.upsert_high_score(p_game_id text, p_score bigint)
returns public.high_scores
language plpgsql
security invoker
as $$
declare
  result public.high_scores;
begin
  insert into public.high_scores (player_id, game_id, score, times_played)
  values (auth.uid(), p_game_id, p_score, 1)
  on conflict (player_id, game_id) do update set
    score = greatest(public.high_scores.score, excluded.score),
    times_played = public.high_scores.times_played + 1,
    updated_at = now()
  returning * into result;
  return result;
end;
$$;

grant execute on function public.upsert_high_score(text, bigint) to authenticated;

-- ── admin_top_games ──────────────────────────────────────────────────────────
-- Now ranked by total plays (sum of times_played), not distinct players —
-- "count every time someone plays," per the metrics dapp's actual ask.
-- unique_players is kept as a secondary figure, not the ranking key anymore.
drop function if exists public.admin_top_games(int);

create or replace function public.admin_top_games(p_limit int default 10)
returns table (game_id text, total_plays bigint, unique_players bigint, avg_score numeric, top_score bigint)
language sql
security definer
set search_path = public
stable
as $$
  select h.game_id, sum(h.times_played), count(distinct h.player_id), avg(h.score)::numeric, max(h.score)
  from public.high_scores h
  group by h.game_id
  order by sum(h.times_played) desc
  limit p_limit;
$$;

grant execute on function public.admin_top_games(int) to authenticated;

-- ── admin_growth / admin_volume_growth ──────────────────────────────────────
-- Previously a rolling "last 30 days" window, which mostly showed empty
-- pre-launch days. Pinned to the arcade's actual launch date instead, so the
-- whole visible range is real signal.
drop function if exists public.admin_growth(int);
drop function if exists public.admin_volume_growth(int);

create or replace function public.admin_growth()
returns table (day date, new_players bigint)
language sql
security definer
set search_path = public
stable
as $$
  with days as (
    select generate_series('2026-07-15'::date::timestamp, current_date::timestamp, interval '1 day')::date as day
  ),
  signups as (
    select created_at::date as day, count(*) as n
    from public.players
    where created_at::date >= '2026-07-15'
    group by 1
  )
  select d.day, coalesce(s.n, 0)
  from days d
  left join signups s on s.day = d.day
  order by d.day;
$$;

grant execute on function public.admin_growth() to authenticated;

create or replace function public.admin_volume_growth()
returns table (day date, nim_paid_out numeric)
language sql
security definer
set search_path = public
stable
as $$
  with days as (
    select generate_series('2026-07-15'::date::timestamp, current_date::timestamp, interval '1 day')::date as day
  ),
  volume as (
    select created_at::date as day, sum(amount_nim) as n
    from public.payouts
    where status = 'sent' and created_at::date >= '2026-07-15'
    group by 1
  )
  select d.day, coalesce(v.n, 0)
  from days d
  left join volume v on v.day = d.day
  order by d.day;
$$;

grant execute on function public.admin_volume_growth() to authenticated;
