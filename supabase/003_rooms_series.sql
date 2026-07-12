-- NIM-ARCADE — multi-round Online rooms (run after schema.sql + 002_functions.sql)
-- Dashboard → SQL Editor → paste this whole file → Run.
--
-- Redesigns "Online" rooms from single-match to a series: a room now runs N
-- rounds (default 10, ~2 min each), drawing from one or more games chosen by
-- the host. Every round, all current players play the SAME game; whoever has
-- the highest SUM of scores across all rounds when the series ends wins the
-- majority of the entry-fee pool (70/20/10 to top 3, 5% house cut — same
-- split as tournaments). Max 10 players per room.

-- ── extend rooms ─────────────────────────────────────────────────────────────
alter table public.rooms add column if not exists rounds int not null default 10;
alter table public.rooms add column if not exists current_round int not null default 0;
alter table public.rooms add column if not exists game_ids text[] not null default '{}';
alter table public.rooms add column if not exists round_duration_s int not null default 120;

alter table public.rooms drop constraint if exists rooms_max_players_check;
alter table public.rooms add constraint rooms_max_players_check check (max_players between 2 and 10);

-- Backfill any pre-existing rooms (from before this migration) so old rows stay valid.
update public.rooms set game_ids = array[game_id] where game_ids = '{}';

-- ── one row per round, records which game was assigned ─────────────────────
create table public.room_rounds (
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number int not null,
  game_id text not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  primary key (room_id, round_number)
);

alter table public.room_rounds enable row level security;

create policy "room rounds are publicly readable"
  on public.room_rounds for select using (true);
-- No insert/update policy for regular clients — only start_room()/submit_round_score()
-- (both security definer, below) ever write to this table.

-- ── one row per (round, player), their score for that single round ─────────
create table public.room_round_scores (
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number int not null,
  player_id uuid not null references public.players(id) on delete cascade,
  score bigint not null default 0,
  submitted_at timestamptz not null default now(),
  primary key (room_id, round_number, player_id)
);

alter table public.room_round_scores enable row level security;

create policy "room round scores are publicly readable (live standings)"
  on public.room_round_scores for select using (true);
-- No direct insert policy either — everything goes through submit_round_score()
-- so the "all players submitted -> advance or finalize" logic can never be skipped.

create index room_round_scores_room_idx on public.room_round_scores (room_id, round_number);

-- ── start_room: host kicks off round 1 ──────────────────────────────────────
create or replace function public.start_room(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_game text;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room is null then raise exception 'room not found'; end if;
  if v_room.host_id <> auth.uid() then raise exception 'only the host can start the room'; end if;
  if v_room.status <> 'waiting' then raise exception 'room already started'; end if;
  if array_length(v_room.game_ids, 1) is null then raise exception 'room has no games selected'; end if;

  v_game := v_room.game_ids[1];

  insert into public.room_rounds (room_id, round_number, game_id, ends_at)
  values (p_room_id, 1, v_game, now() + (v_room.round_duration_s || ' seconds')::interval);

  update public.rooms set status = 'playing', current_round = 1
  where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

grant execute on function public.start_room(uuid) to authenticated;

-- ── submit_round_score: the whole game loop lives here ──────────────────────
-- Records the caller's score for the current round. If that was the last
-- player still missing for this round: either starts the next round (picking
-- the next game from game_ids, cycling), or — if this was the final round —
-- computes standings (sum of scores per player across all rounds), splits the
-- entry-fee pool 70/20/10 among the top 3 (minus a 5% house cut) into
-- `payouts` as 'pending' rows, and marks the room 'finished'.
create or replace function public.submit_round_score(p_room_id uuid, p_round_number int, p_score bigint)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_player_count int;
  v_submitted_count int;
  v_next_game text;
  v_pot numeric(18, 5);
  v_share numeric(18, 5);
  r record;
  v_rank int := 0;
  v_splits numeric[] := array[0.70, 0.20, 0.10];
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room is null then raise exception 'room not found'; end if;
  if v_room.status <> 'playing' then raise exception 'room is not in progress'; end if;
  if p_round_number <> v_room.current_round then raise exception 'not the current round'; end if;

  insert into public.room_round_scores (room_id, round_number, player_id, score)
  values (p_room_id, p_round_number, auth.uid(), p_score)
  on conflict (room_id, round_number, player_id) do update set score = excluded.score;

  select count(*) into v_player_count from public.room_players where room_id = p_room_id;
  select count(*) into v_submitted_count from public.room_round_scores
    where room_id = p_room_id and round_number = p_round_number;

  if v_submitted_count < v_player_count then
    return v_room; -- still waiting on someone else this round
  end if;

  if v_room.current_round < v_room.rounds then
    -- advance to the next round
    v_next_game := v_room.game_ids[((v_room.current_round) % array_length(v_room.game_ids, 1)) + 1];
    insert into public.room_rounds (room_id, round_number, game_id, ends_at)
    values (p_room_id, v_room.current_round + 1, v_next_game, now() + (v_room.round_duration_s || ' seconds')::interval);

    update public.rooms set current_round = current_round + 1
    where id = p_room_id
    returning * into v_room;

    return v_room;
  end if;

  -- final round just closed out — compute standings and queue payouts
  v_pot := v_room.entry_fee_nim * v_player_count;

  if v_pot > 0 then
    for r in
      select player_id, sum(score) as total
      from public.room_round_scores
      where room_id = p_room_id
      group by player_id
      order by total desc
      limit 3
    loop
      v_rank := v_rank + 1;
      v_share := round(v_pot * 0.95 * v_splits[v_rank], 5);
      if v_share > 0 then
        insert into public.payouts (player_id, amount_nim, reason, status)
        values (r.player_id, v_share, 'room_prize', 'pending');
      end if;
    end loop;
  end if;

  update public.rooms set status = 'finished'
  where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

grant execute on function public.submit_round_score(uuid, int, bigint) to authenticated;
