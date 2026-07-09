-- NIM-ARCADE — initial backend schema
--
-- HOW TO APPLY: Supabase dashboard → SQL Editor → paste this whole file → Run.
-- (No Postgres password or Management API token was provided, so this can't be
-- applied programmatically from here — see the assistant's message for why.)
--
-- BEFORE running this: Authentication → Providers → enable "Anonymous Sign-ins".
-- This schema assumes players authenticate via `supabase.auth.signInAnonymously()`
-- and that `players.id = auth.uid()` — that's what makes the RLS policies below
-- work without any custom JWT claims or server-side session logic.

-- ── players ──────────────────────────────────────────────────────────────────
create table public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  device_identifier text unique,           -- from Nimiq Pay's requestDeviceIdentifier()
  nimiq_address text,
  display_name text not null default 'Player',
  avatar text not null default '🎮',
  xp bigint not null default 0,
  level int not null default 1,
  wins int not null default 0,
  losses int not null default 0,
  games_played int not null default 0,
  daily_xp_earned int not null default 0,
  last_active_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;

create policy "players are publicly readable (leaderboard)"
  on public.players for select using (true);

create policy "players can insert their own row"
  on public.players for insert with check (auth.uid() = id);

create policy "players can update their own row"
  on public.players for update using (auth.uid() = id);

-- ── high_scores ──────────────────────────────────────────────────────────────
-- One row per (player, game) holding their best score — matches the existing
-- client-side setHighScore(gameId, score) "keep the max" semantics.
create table public.high_scores (
  player_id uuid not null references public.players(id) on delete cascade,
  game_id text not null,
  score bigint not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, game_id)
);

alter table public.high_scores enable row level security;

create policy "high scores are publicly readable (leaderboard)"
  on public.high_scores for select using (true);

create policy "players can upsert their own high scores"
  on public.high_scores for insert with check (auth.uid() = player_id);

create policy "players can raise their own high scores"
  on public.high_scores for update using (auth.uid() = player_id);

-- ── rooms (async score-battle "Online" mode) ────────────────────────────────
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,               -- 6-char join code
  game_id text not null,
  host_id uuid not null references public.players(id) on delete cascade,
  max_players int not null default 4,
  entry_fee_nim numeric(18,5) not null default 0,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

create policy "rooms are publicly readable"
  on public.rooms for select using (true);

create policy "players can create rooms as host"
  on public.rooms for insert with check (auth.uid() = host_id);

create policy "host can update their own room"
  on public.rooms for update using (auth.uid() = host_id);

create table public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  score bigint,
  finished_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

alter table public.room_players enable row level security;

create policy "room rosters are publicly readable"
  on public.room_players for select using (true);

create policy "players can join a room as themselves"
  on public.room_players for insert with check (auth.uid() = player_id);

create policy "players can submit their own room score"
  on public.room_players for update using (auth.uid() = player_id);

-- ── tournaments ──────────────────────────────────────────────────────────────
-- Deliberately no insert/update policy for regular users — tournaments are
-- created and closed by an admin (dashboard) or a service_role Edge Function
-- (cron), never directly by a player.
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game_id text not null,
  entry_fee_nim numeric(18,5) not null default 0,
  max_players int,
  prize_pool_nim numeric(18,5) not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'ended')),
  type text not null check (type in ('daily', 'weekly', 'monthly')),
  created_at timestamptz not null default now()
);

alter table public.tournaments enable row level security;

create policy "tournaments are publicly readable"
  on public.tournaments for select using (true);

create table public.tournament_entries (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  best_score bigint not null default 0,
  paid_tx_hash text,                        -- proof of the entry-fee payment; verify server-side
  entered_at timestamptz not null default now(),
  primary key (tournament_id, player_id)
);

alter table public.tournament_entries enable row level security;

create policy "tournament entries are publicly readable (live ranking)"
  on public.tournament_entries for select using (true);

create policy "players can enter a tournament as themselves"
  on public.tournament_entries for insert with check (auth.uid() = player_id);

create policy "players can update their own tournament best score"
  on public.tournament_entries for update using (auth.uid() = player_id);

-- ── payouts ──────────────────────────────────────────────────────────────────
-- Client can only ever READ its own payouts. Rows are created/updated
-- exclusively by service_role from a backend process — never by a player
-- directly. This is what makes "the client never triggers a payout" a fact
-- enforced by the database, not just an app-level convention.
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  amount_nim numeric(18,5) not null,
  reason text not null,                     -- e.g. 'xp_conversion', 'tournament_prize', 'room_win'
  tx_hash text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.payouts enable row level security;

create policy "players can read their own payouts"
  on public.payouts for select using (auth.uid() = player_id);

-- ── indexes ──────────────────────────────────────────────────────────────────
create index high_scores_game_score_idx on public.high_scores (game_id, score desc);
create index players_xp_idx on public.players (xp desc);
create index rooms_status_idx on public.rooms (status, game_id);
create index tournament_entries_score_idx on public.tournament_entries (tournament_id, best_score desc);
create index payouts_player_idx on public.payouts (player_id, created_at desc);
