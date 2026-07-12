-- Restores the XP→NIM rate to 0.02/1000 (from the temporary 0.01/1000 in
-- 006_lower_xp_rate.sql) and adds a hard server-side anti-farming cap: no
-- player can convert more than 1 NIM total per rolling 24 hours, no matter
-- how much XP they've accumulated or what the rate is. Applied directly
-- against the live project via the Management API on 2026-07-12.
--
-- Why a flat NIM cap instead of just relying on the daily XP-earning cap
-- (calculateDailyXpReward in src/lib/xp.ts, 50,000 XP/day with diminishing
-- tiers): that cap only bounds *earning*, not *converting* — a bug in the
-- XP-award path, a client desync, or any future exploit that inflates a
-- player's xp balance would otherwise translate directly into NIM with no
-- second line of defense. This cap makes the actual spend-rate ceiling
-- explicit and enforced at the one place that can't be bypassed: the
-- security-definer function that creates the payout row.

CREATE OR REPLACE FUNCTION public.request_xp_conversion(p_xp_amount bigint)
 RETURNS payouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player public.players;
  v_amount_nim numeric(18, 5);
  v_converted_24h numeric(18, 5);
  v_daily_cap_nim constant numeric(18, 5) := 1.0;
  v_payout public.payouts;
begin
  select * into v_player from public.players where id = auth.uid() for update;
  if v_player is null then
    raise exception 'player not found';
  end if;
  if p_xp_amount <= 0 or p_xp_amount > v_player.xp then
    raise exception 'invalid xp amount: have %, requested %', v_player.xp, p_xp_amount;
  end if;

  -- Anti-farming: cap total NIM converted per player per rolling 24h,
  -- independent of how much XP they've accumulated. Counts pending +
  -- processing + sent so a burst of rapid requests can't stack past the cap
  -- before earlier ones finish processing.
  select coalesce(sum(amount_nim), 0) into v_converted_24h
  from public.payouts
  where player_id = auth.uid()
    and reason = 'xp_conversion'
    and status in ('pending', 'processing', 'sent')
    and created_at > now() - interval '24 hours';

  -- 1000 XP = 0.02 NIM — must match XP_TO_NIM_RATE in src/lib/xp.ts
  v_amount_nim := p_xp_amount * 0.02 / 1000;

  if v_converted_24h + v_amount_nim > v_daily_cap_nim then
    raise exception 'daily conversion cap reached: % NIM converted in the last 24h, cap is % NIM', v_converted_24h, v_daily_cap_nim;
  end if;

  update public.players set xp = xp - p_xp_amount where id = auth.uid();

  insert into public.payouts (player_id, amount_nim, reason, status)
  values (auth.uid(), v_amount_nim, 'xp_conversion', 'pending')
  returning * into v_payout;

  return v_payout;
end;
$function$;
