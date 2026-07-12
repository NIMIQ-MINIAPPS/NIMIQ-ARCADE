-- NIM-ARCADE — lifetime XP tracking, separate from the spendable balance
-- (run after schema.sql + 002_functions.sql)
-- Dashboard → SQL Editor → paste this whole file → Run.
--
-- `xp` stays exactly as it was: a spendable balance that request_xp_conversion
-- (002_functions.sql) decrements when converting to NIM — no change to that
-- function. `total_xp_earned` is new: it only ever goes up, mirrors every XP
-- gain, and is untouched by conversions. Leaderboard ranking and level now
-- read from `total_xp_earned` so converting XP to NIM never costs a player
-- their rank or their level.

alter table public.players add column if not exists total_xp_earned bigint not null default 0;

-- Backfill: every existing player's lifetime total starts at at least their
-- current spendable balance (can't reconstruct true historical total for
-- anyone who already converted before this column existed, but nobody has).
update public.players set total_xp_earned = xp where total_xp_earned < xp;

create index if not exists players_total_xp_idx on public.players (total_xp_earned desc);

-- Redefine merge_player_progress to also merge total_xp_earned (same
-- "keep the max" pattern as everything else it merges).
create or replace function public.merge_player_progress(
  p_xp bigint,
  p_level int,
  p_wins int,
  p_losses int,
  p_games_played int,
  p_daily_xp_earned int,
  p_last_active_date date,
  p_display_name text,
  p_avatar text,
  p_nimiq_address text,
  p_device_identifier text,
  p_total_xp_earned bigint default 0
) returns public.players
language plpgsql
security invoker
as $$
declare
  result public.players;
begin
  insert into public.players (
    id, xp, level, wins, losses, games_played, daily_xp_earned,
    last_active_date, display_name, avatar, nimiq_address, device_identifier,
    total_xp_earned
  )
  values (
    auth.uid(), p_xp, p_level, p_wins, p_losses, p_games_played, p_daily_xp_earned,
    p_last_active_date, coalesce(p_display_name, 'Player'), coalesce(p_avatar, '🎮'),
    p_nimiq_address, p_device_identifier, greatest(p_total_xp_earned, p_xp)
  )
  on conflict (id) do update set
    xp                = greatest(public.players.xp, excluded.xp),
    level             = greatest(public.players.level, excluded.level),
    wins              = greatest(public.players.wins, excluded.wins),
    losses            = greatest(public.players.losses, excluded.losses),
    games_played      = greatest(public.players.games_played, excluded.games_played),
    daily_xp_earned   = case when public.players.last_active_date = excluded.last_active_date
                              then greatest(public.players.daily_xp_earned, excluded.daily_xp_earned)
                              else excluded.daily_xp_earned end,
    last_active_date  = excluded.last_active_date,
    display_name      = excluded.display_name,
    avatar            = excluded.avatar,
    nimiq_address      = coalesce(excluded.nimiq_address, public.players.nimiq_address),
    device_identifier = coalesce(excluded.device_identifier, public.players.device_identifier),
    total_xp_earned   = greatest(public.players.total_xp_earned, excluded.total_xp_earned)
  returning * into result;
  return result;
end;
$$;

grant execute on function public.merge_player_progress(
  bigint, int, int, int, int, int, date, text, text, text, text, bigint
) to authenticated;

-- Also bump the XP→NIM conversion rate to match src/lib/xp.ts's new
-- XP_TO_NIM_RATE (0.02 / 1000 instead of 0.001 / 1000) — sized so a player
-- hitting the 50,000/day XP cap every day converts at most ~1 NIM/day.
create or replace function public.request_xp_conversion(p_xp_amount bigint)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players;
  v_amount_nim numeric(18, 5);
  v_payout public.payouts;
begin
  select * into v_player from public.players where id = auth.uid() for update;
  if v_player is null then
    raise exception 'player not found';
  end if;
  if p_xp_amount <= 0 or p_xp_amount > v_player.xp then
    raise exception 'invalid xp amount: have %, requested %', v_player.xp, p_xp_amount;
  end if;

  -- 1000 XP = 0.02 NIM — must match XP_TO_NIM_RATE in src/lib/xp.ts
  v_amount_nim := p_xp_amount * 0.02 / 1000;

  update public.players set xp = xp - p_xp_amount where id = auth.uid();

  insert into public.payouts (player_id, amount_nim, reason, status)
  values (auth.uid(), v_amount_nim, 'xp_conversion', 'pending')
  returning * into v_payout;

  return v_payout;
end;
$$;

grant execute on function public.request_xp_conversion(bigint) to authenticated;
