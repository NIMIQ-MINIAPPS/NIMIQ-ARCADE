-- Lowers the XP→NIM conversion rate from 0.02/1000 to 0.01/1000.
-- Applied directly against the live project via the Management API on
-- 2026-07-12, after the first real conversion (0.02842 NIM for a small
-- amount of XP) felt disproportionately generous. Halving the rate halves
-- the worst-case daily drain per player (50,000 XP/day cap → ~0.5 NIM/day
-- instead of ~1 NIM/day), extending how long the payout wallet's balance
-- lasts. Keep in sync with XP_TO_NIM_RATE in src/lib/xp.ts.

CREATE OR REPLACE FUNCTION public.request_xp_conversion(p_xp_amount bigint)
 RETURNS payouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- 1000 XP = 0.01 NIM — must match XP_TO_NIM_RATE in src/lib/xp.ts
  v_amount_nim := p_xp_amount * 0.01 / 1000;

  update public.players set xp = xp - p_xp_amount where id = auth.uid();

  insert into public.payouts (player_id, amount_nim, reason, status)
  values (auth.uid(), v_amount_nim, 'xp_conversion', 'pending')
  returning * into v_payout;

  return v_payout;
end;
$function$;
