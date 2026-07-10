-- NIM-ARCADE — RPC functions (run after schema.sql)
-- Dashboard → SQL Editor → paste this whole file → Run.

-- ── merge_player_progress ────────────────────────────────────────────────────
-- Atomic "keep the max" upsert for a player's own row. Called after every game
-- session with the client's current local values; safe to call from multiple
-- tabs/devices concurrently since the greatest() merge never loses progress.
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
  p_device_identifier text
) returns public.players
language plpgsql
security invoker
as $$
declare
  result public.players;
begin
  insert into public.players (
    id, xp, level, wins, losses, games_played, daily_xp_earned,
    last_active_date, display_name, avatar, nimiq_address, device_identifier
  )
  values (
    auth.uid(), p_xp, p_level, p_wins, p_losses, p_games_played, p_daily_xp_earned,
    p_last_active_date, coalesce(p_display_name, 'Player'), coalesce(p_avatar, '🎮'),
    p_nimiq_address, p_device_identifier
  )
  on conflict (id) do update set
    xp               = greatest(public.players.xp, excluded.xp),
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
    device_identifier = coalesce(excluded.device_identifier, public.players.device_identifier)
  returning * into result;
  return result;
end;
$$;

grant execute on function public.merge_player_progress(
  bigint, int, int, int, int, int, date, text, text, text, text
) to authenticated;

-- ── upsert_high_score ────────────────────────────────────────────────────────
-- Atomic "keep the max" upsert for one (player, game) high score row.
create or replace function public.upsert_high_score(p_game_id text, p_score bigint)
returns public.high_scores
language plpgsql
security invoker
as $$
declare
  result public.high_scores;
begin
  insert into public.high_scores (player_id, game_id, score)
  values (auth.uid(), p_game_id, p_score)
  on conflict (player_id, game_id) do update set
    score = greatest(public.high_scores.score, excluded.score),
    updated_at = now()
  returning * into result;
  return result;
end;
$$;

grant execute on function public.upsert_high_score(text, bigint) to authenticated;

-- ── request_xp_conversion ────────────────────────────────────────────────────
-- The ONLY way XP turns into a payout row. Runs as security definer (elevated
-- privileges) specifically so it can insert into `payouts`, which regular
-- clients otherwise have zero write access to (see schema.sql) — but every
-- operation inside is hard-scoped to auth.uid(), so a caller can only ever
-- spend their own XP. This creates a 'pending' payout; actually SENDING the
-- NIM (setting status='sent' + tx_hash) is a separate, deliberately-not-here
-- backend process using the funded server wallet — never triggered by a client.
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

  -- 1000 XP = 0.001 NIM — must match XP_TO_NIM_RATE in src/lib/xp.ts
  v_amount_nim := p_xp_amount * 0.001 / 1000;

  update public.players set xp = xp - p_xp_amount where id = auth.uid();

  insert into public.payouts (player_id, amount_nim, reason, status)
  values (auth.uid(), v_amount_nim, 'xp_conversion', 'pending')
  returning * into v_payout;

  return v_payout;
end;
$$;

grant execute on function public.request_xp_conversion(bigint) to authenticated;
