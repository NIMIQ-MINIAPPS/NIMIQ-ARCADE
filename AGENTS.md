# AGENTS.md — Nimiq Mini App SDK + Supabase backend

Context for whichever agent picks up production work on this repo. Read this
before touching `src/lib/nimiq.ts`, anything under `src/lib/backend*`,
`rooms.ts`, `tournaments.ts`, or `supabase/`.

## Deployed

**Live at https://nimiq-arcade.vercel.app** (Vercel project
`josueazcs-projects/nimiq-arcade`). Pushing to `main` does NOT auto-deploy —
the Vercel GitHub App has no access to the `NIMIQ-MINIAPPS` GitHub org, so a
Vercel Deploy Hook + `.github/workflows/deploy.yml` is used instead. That
workflow needs a `VERCEL_DEPLOY_HOOK_URL` repo secret to actually fire (ask
the user whether it's been added — if not, deploy manually: `vercel --prod`
from a machine already logged into the `josueazc` Vercel account).

Vercel env vars already set (production): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_HOUSE_WALLET_ADDRESS`.

## Database migrations — check what's actually been applied before assuming

`supabase/*.sql` files are numbered and MUST be run in order in the Supabase
SQL Editor (no DB password or Management API PAT exists for this project, so
nobody — not even an agent with the service_role key — can apply DDL any
other way; only data reads/writes are possible via the API). As of this
writing:

- `schema.sql`, `002_functions.sql` — **applied** (players, high_scores,
  rooms, room_players, tournaments, tournament_entries, payouts + RLS +
  merge_player_progress/upsert_high_score/request_xp_conversion RPCs).
- `003_rooms_series.sql` (multi-round rooms: `rooms.rounds/current_round/
  game_ids/round_duration_s`, new `room_rounds`/`room_round_scores` tables,
  `start_room()`/`submit_round_score()` RPCs), `004_payouts_processing_status.sql`
  (adds a `'processing'` payouts status for the Edge Function's optimistic
  lock), `005_lifetime_xp.sql` (adds `players.total_xp_earned`, redefines
  `merge_player_progress` to accept `p_total_xp_earned`, bumps the XP→NIM
  rate in `request_xp_conversion`) — **written, not yet confirmed applied**.
  If `rooms.ts`/`tournaments.ts` calls are erroring with "column/function
  does not exist" or a `rooms_host_id_fkey` violation on insert, this is why
  — ask the user to run them, don't debug the client code first.

**Always verify against the live schema before assuming a migration ran**:
```
curl -s "https://zetsrmdshvpbvsurmpnc.supabase.co/rest/v1/rooms?select=*&limit=1" \
  -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>"
```
If the response includes `rounds`/`game_ids`, 003 is applied.

## Design decisions made this session (don't relitigate without reason)

- **No "wins" concept.** Every game here is score-attack — you never "win,"
  the run just ends. `recordWin`/`recordLoss`/`User.wins`/`User.losses` were
  removed from the client entirely (dead code — no game file ever called
  them). The `players.wins`/`losses` DB columns still exist (harmless,
  always 0) but nothing reads or writes them meaningfully anymore;
  `merge_player_progress` still takes `p_wins`/`p_losses` params because
  redefining that signature wasn't worth another migration — `backend.ts`
  just hardcodes `0` for both.
- **Lifetime XP vs. spendable XP are different numbers.** `user.xp` is the
  spendable balance (decreases when converted to NIM). `user.totalXp` /
  `players.total_xp_earned` only ever goes up. Ranking, level, and the XP bar
  all read from `totalXp` — **converting XP to NIM must never cost a player
  their rank or level.** If you add anything that reads XP for a
  leaderboard/achievement/level purpose, use `totalXp`, not `xp`.
- **XP_TO_NIM_RATE = 0.02/1000** (`src/lib/xp.ts`), sized so a player hitting
  the 50k/day XP cap every day converts ~1 NIM/day max — deliberately
  conservative against the funded wallet's balance. The exact same rate is
  hardcoded in `request_xp_conversion` (`005_lifetime_xp.sql`) since that
  RPC computes the NIM amount server-side on purpose (never trust a
  client-supplied amount for something that spends real money). **If you
  change the client rate, you must also update the SQL function and get the
  user to re-run it** — there's no single source of truth across the
  language boundary here, just a comment pointing at the other one.
- **Display names are player-editable**, wired on `HomePage.tsx` (tap the
  pencil icon next to the name) via `updateDisplayName()` in `backend.ts`,
  which just does a direct `players` table update (no RPC needed — RLS
  already allows `auth.uid() = id` updates).
- **Directional glyphs must be lucide-react icons, not Unicode characters.**
  Several games (Nimtris, Snake, PacMaze, FrogCross, Lowdown) originally used
  `▲▼◀▶↑↓` as plain text in button labels — on at least one real device the
  down-arrow glyph didn't render (missing font glyph → invisible button
  label). All five were converted to `<ChevronUp/Down/Left/Right>` /
  `<ArrowUp/Down>` from lucide-react. If you add a new directional control to
  any game, use an icon, not a Unicode arrow character — text glyph
  rendering for these symbols is not reliable across devices.
- **The bottom nav must render `z-[60]`+ relative to the in-game overlay**
  (which is `z-[60]` in `GamesPage.tsx`) or it paints ON TOP of gameplay —
  `BottomNav.tsx` is `z-50`, `GamesPage.tsx`'s game wrapper was bumped from
  `z-50` to `z-[60]` to fix this (both were `z-50` before, and being later in
  the DOM, `BottomNav` won the paint order tie). Keep the game overlay's
  z-index strictly higher than `BottomNav`'s if either changes.

## Multiplayer rooms — how the round loop actually works

A room is a series of N rounds (host picks 5/10/15/20, default 10) across
one or more games (host multi-selects; rounds cycle through them in order).
Max 10 players. All round-advance and finalize logic lives server-side in
`submit_round_score()` (`003_rooms_series.sql`) — the client only ever calls
`start_room()` and `submit_round_score()`, never writes `room_rounds` or
`room_round_scores` directly (no RLS insert policy for either, on purpose).

Score routing reuses the exact same store hook as XP sync
(`backendSync.ts`): `OnlinePage.tsx` sets `useGameStore`'s `activeRoom`
(`{roomId, gameId, roundNumber}`) right before sending the player to the
Games tab; when a matching `setHighScore()` fires, `backendSync` calls
`submitRoundScore()` and clears `activeRoom`. **This listens to
`lastScoreEvent`, not `highScores` diffs** — `highScores[gameId]` only
updates on a new personal record, but a room round can legitimately end with
a LOWER score than the player's all-time best for that game, and that still
has to reach the room or the round hangs forever waiting on that player.
`lastScoreEvent` (also on `useGameStore`) fires on every `setHighScore()`
call regardless of whether it's a record — this was a real bug caught before
shipping, not a hypothetical.

Prize split on room finish: top 3 get 70/20/10 of the pot (`entry_fee_nim ×
player_count`), minus a 5% house cut — same split as the original design doc
for tournaments, applied consistently. Payouts are queued as `'pending'` rows
via the same finalize branch of `submit_round_score()`, security-definer, so
regular clients still can't write to `payouts` directly.

## Entry fees — wired, needs migrations applied + Realtime testing before trusting it

`src/lib/houseWallet.ts` has `collectEntryFee()`, which calls
`sdk.requestPayment()` (real or mock depending on environment — see the
Nimiq SDK section below) against `VITE_HOUSE_WALLET_ADDRESS`. `OnlinePage.tsx`
(room create/join) and `TournamentsPage.tsx` (tournament entry) both collect
payment BEFORE writing to the DB — if payment fails, nothing is created/
joined/entered. Room entry fee options: 0/0.5/1/2 NIM (host picks). Seeded
tournament fees: daily 0.2 NIM, weekly 0.5 NIM, monthly 1 NIM.

**This has only been tested against the mock SDK** (outside Nimiq Pay,
`sdk.requestPayment()` always resolves successfully after ~1s) — the actual
`sendBasicTransaction` path through a real Nimiq Pay session has not been
exercised. Test that specifically once inside Nimiq Pay, don't assume it
matches mock behavior.

## The payout wallet — funded, not yet wired to actually send anything

The user has designated `NQ34 JT34 JCAD R56B GSRR CALT L8QE 73XK 08UC`
(~6506 NIM at the time this was set up) as usable for this project — not
their savings wallet, explicit go-ahead given. `VITE_HOUSE_WALLET_ADDRESS`
(client-side, public, safe) is set to this address for RECEIVING entry fees.

Nothing has been given the PRIVATE KEY yet, and nothing should be asked to
provide it over chat — `supabase/functions/process-payouts/index.ts` reads it
from a `NIMIQ_PAYOUT_PRIVATE_KEY` Supabase Edge Function secret at runtime,
set directly by the user via `supabase secrets set` or the dashboard, never
pasted anywhere an agent or chat log would see it.

That Edge Function is **written but never deployed or run** — see its own
top-of-file comment for exactly what's verified (the `@nimiq/core` signing
API surface, checked against the installed package's `.d.ts`) vs. genuinely
unverified (the JSON-RPC broadcast method name and network ID — best-guess
placeholders behind env vars, not confirmed against live Nimiq RPC docs).
Payouts computed by `submit_round_score()`/`request_xp_conversion()` are
mathematically bounded by fees actually collected for that room/tournament,
never by the wallet's total balance — this was a deliberate design choice
the user was anxious about (worried the pre-existing 6506 NIM could get
drained), confirmed safe by construction, not by trusting a cap number.

## Nimiq SDK (`src/lib/nimiq.ts`)

`@nimiq/mini-app-sdk@0.1.0` is installed. `initNimiq()` detects whether it's
running inside Nimiq Pay (`window.nimiq` present) and uses the real
`NimiqProvider`, falling back to `MockNimiqSDK` otherwise (local dev /
preview). `App.tsx` shows a "DEMO MODE" banner when the mock is active.

**The real SDK's actual shape (verified against the installed package's
`.d.ts`, not assumed) differs from what an earlier mock-based spec assumed:**

- `nimiq.listAccounts()` resolves to `string[] | ErrorResponse` — addresses
  only, **no balance field**. No documented method was found anywhere for
  fetching a NIM balance. `RealNimiqSDK.listAccounts()` returns `balance: 0`
  for real accounts and says so in a comment — do not fake a number there.
- No `requestPayment()` on the raw SDK; `RealNimiqSDK.requestPayment()`
  wraps `NimiqProvider#sendBasicTransaction({ recipient, value, fee?,
  validityStartHeight? })`, converting NIM to **Lunas** (1 NIM = 1e5 Lunas).
- `requestDeviceIdentifier` is a top-level SDK export, not a provider
  method, and requires `{ reason: string }` shown to the user on first call.
- `init(options?)` only resolves once Nimiq Pay injects `window.nimiq` — it
  hangs forever outside it, so `isRunningInNimiqPay()` gates the call.
- EVM/USDT (`window.ethereum`, ERC-20 on Polygon/Arbitrum/Optimism/Base/BNB/
  Sepolia) is real per nimiq.dev but **not part of `@nimiq/mini-app-sdk`** —
  standard injected `window.ethereum`. Not wired here.

## Realtime gotcha

`supabase.channel(...).on('postgres_changes', ...)` alone did NOT propagate
`rooms`/`room_players` changes between two anonymous sessions in live
2-browser-tab testing — the tables need adding to the `supabase_realtime`
publication (`alter publication supabase_realtime add table rooms,
room_players, room_round_scores;` in the SQL Editor), which nobody has run.
`OnlinePage.tsx`'s `RoomView` therefore polls every 3s as the ACTUAL sync
mechanism — Realtime is opportunistic on top of that, never depended on. If
Realtime gets enabled later, nothing needs to change in the app.

## Credentials handling

`.env.local` (gitignored) holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_HOUSE_WALLET_ADDRESS` — all meant to be public (RLS/lack-of-private-key
is what protects things, not secrecy of these values). **Never** put the
`service_role`/`secret` Supabase key, or any Nimiq wallet private key, into a
file under `src/`, `.env.local`, or a commit. Verified every session by
grepping the repo for both secret values before committing — neither has
ever touched disk here. One-off admin actions (seeding/adjusting tournament
data, cleaning up Playwright test data) used the secret key transiently in
shell commands only, never written to a file.

## Blocked — needs the user directly

1. Confirm `003`/`004`/`005` migrations are applied (see above).
2. Enable Realtime for `rooms`/`room_players`/`room_round_scores` (cosmetic
   only — polling already covers it).
3. Add `VERCEL_DEPLOY_HOOK_URL` as a GitHub Actions secret (or grant the
   Vercel GitHub App access to the `NIMIQ-MINIAPPS` org) for auto-deploy.
4. Set `NIMIQ_PAYOUT_PRIVATE_KEY`/`NIMIQ_RPC_URL`/`NIMIQ_NETWORK_ID` as
   Supabase Edge Function secrets, then `supabase functions deploy
   process-payouts` — only once the user is ready to actually send NIM.
5. NIM balance fetching — needs real Nimiq docs/support, not guessed.
6. Nimiq Mini Apps registration — manual, account-bound.

## What a next agent should build, roughly in order

1. Verify entry-fee payment collection against a REAL Nimiq Pay session, not
   just the mock SDK.
2. Deploy and smoke-test `process-payouts` against Nimiq testnet before
   mainnet, once a network/RPC endpoint is confirmed.
3. Tournament close-out cron (mark `ended`, snapshot final ranking) — none
   exists yet, tournaments currently just sit `active` past their `ends_at`.
4. Score validation (reject implausible scores / sessions shorter than a
   game's minimum possible time) before payouts scale beyond friends-testing.
