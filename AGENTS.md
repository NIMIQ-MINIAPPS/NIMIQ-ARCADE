# AGENTS.md — Nimiq Mini App SDK + Supabase backend

Context for whichever agent picks up production integration work on this repo.

## Current state — backend is live, applied, and wired end-to-end

The Supabase project (`zetsrmdshvpbvsurmpnc`) has `supabase/schema.sql` AND
`supabase/002_functions.sql` applied, Anonymous Sign-ins enabled, and 3 seed
tournaments inserted. Every layer below has been verified working against the
**real, live** Supabase project (not just compiled) — 2-browser-context
Playwright runs for rooms, single-session runs for tournaments/profile, all
with zero console errors. Test data was cleaned out afterward; `players`,
`high_scores`, `rooms`, `room_players`, `payouts`, `tournament_entries` are
all empty and `tournaments` has exactly the 3 real seeds.

### Nimiq SDK (`src/lib/nimiq.ts`)

`@nimiq/mini-app-sdk@0.1.0` is installed. `initNimiq()` detects whether it's
running inside Nimiq Pay (`window.nimiq` present) and uses the real
`NimiqProvider`, falling back to `MockNimiqSDK` otherwise (local dev /
preview). `App.tsx` shows a "DEMO MODE" banner when the mock is active
(`isUsingMockSdk()`).

**The real SDK's actual shape (verified against the installed package's
`.d.ts`, not assumed) differs from what an earlier mock-based spec assumed:**

- `nimiq.listAccounts()` resolves to `string[] | ErrorResponse` — addresses
  only, **no balance field**. No documented method was found anywhere (this
  package's types, nimiq.dev's Mini Apps page, or the Hub API references
  linked from it) for fetching a NIM balance. `RealNimiqSDK.listAccounts()`
  returns `balance: 0` for real accounts and says so in a comment — **do not
  silently fake a balance number**, find the real method first.
- There is no `requestPayment()`. Payments go through
  `NimiqProvider#sendBasicTransaction({ recipient, value, fee?,
  validityStartHeight? })`, where `value` is in **Lunas** (1 NIM = 1e5 Lunas)
  — `RealNimiqSDK.requestPayment()` does the conversion.
- `requestDeviceIdentifier` is a **top-level SDK export**, not a provider
  method, and requires `{ reason: string }` shown to the user on first call.
- `init(options?)` only resolves once Nimiq Pay injects `window.nimiq` — it
  hangs forever outside it, so `isRunningInNimiqPay()` gates the call.
- EVM/USDT (`window.ethereum`, ERC-20 on Polygon/Arbitrum/Optimism/Base/BNB/
  Sepolia) is real per nimiq.dev but **not part of `@nimiq/mini-app-sdk`** —
  it's the standard injected `window.ethereum` provider. Not wired here.

### Supabase backend

- `src/lib/supabase.ts` — client using only `VITE_SUPABASE_ANON_KEY` (public
  by design; RLS is what actually protects data).
- `src/lib/database.types.ts` — hand-written `Database` type. Regenerate with
  `supabase gen types typescript --linked` once the CLI is linked; until then
  keep it in sync with `supabase/schema.sql` + `002_functions.sql` by hand.
- `src/lib/backend.ts` — session (`ensureSession`/`getCurrentPlayerId`),
  progress sync (`mergeProgress`, atomic "keep the max" via the
  `merge_player_progress` RPC), scores (`pushHighScore`), leaderboard
  (`fetchLeaderboard`), and XP→NIM conversion (`requestXpConversion`, which
  calls the `request_xp_conversion` RPC — creates a `pending` payout, never a
  `sent` one; see "still blocked" below for why).
- `src/lib/backendSync.ts` — the ONE place that touches `useGameStore`
  reactively. `startBackendSync()` (called once from `App.tsx` after
  `initNimiq()` resolves) signs in, merges local↔server progress, then
  subscribes to the store: any `highScores[gameId]` change pushes to
  `high_scores`, and — if `activeRoom`/`activeTournament` is set and matches
  that `gameId` — also submits to the room/tournament and clears the
  active-* flag. **No game file was touched to make this work.** This is the
  hook point for anything else that needs to react to a completed run.
- `src/lib/rooms.ts` / `src/lib/tournaments.ts` — CRUD + realtime/polling for
  Online rooms and Tournament entries, used by the now-real `OnlinePage.tsx`
  and `TournamentsPage.tsx`. `ProfilePage.tsx` is also real (leaderboard,
  achievements computed from actual `wins`/`xp`/`payouts`, working convert
  button).

**Realtime gotcha (found via live 2-tab testing, not assumed):**
`supabase.channel(...).on('postgres_changes', ...)` alone did NOT propagate
`rooms`/`room_players` changes between two anonymous sessions — Realtime
needs those tables added to the `supabase_realtime` publication (Database →
Replication in the dashboard, or `alter publication supabase_realtime add
table rooms, room_players;` in the SQL Editor), which nobody has run yet
(same "no DB password / no Management API PAT" limitation as schema
application — see below). **`OnlinePage.tsx`'s `RoomView` therefore also
polls every 3s as the actual sync mechanism** — realtime is opportunistic on
top of that, not depended on. If someone later runs that `alter publication`
statement, nothing needs to change in the app; the poll just becomes
redundant-but-harmless.

**Online rooms are free (`entry_fee_nim = 0`) for now** — same for the 3
seed tournaments. Entry-fee collection needs a house wallet *address* to send
`sendBasicTransaction` payments to, which doesn't exist yet. The code path is
a one-line addition in `enterTournament`/`createRoom` once that address is
provided — deliberately not faked in the meantime.

## Blocked — needs the user directly, cannot be done by an agent with API keys alone

1. **Enable Realtime for `rooms`/`room_players`** (see gotcha above) — cosmetic
   only, the app works via polling without it.
2. **A house wallet address** to receive room/tournament entry fees, and a
   **separately funded server wallet** (private key never touches this repo)
   to actually send `payouts` (mark them `sent` with a `tx_hash`) — that
   requires a backend process (Edge Function + cron), not yet written, and a
   real decision about how much NIM to put behind it.
3. **Vercel deploy access** and **Nimiq Mini Apps registration** — manual,
   account-bound actions.
4. NIM balance fetching (see above) — needs real Nimiq docs/support, not
   guessed.

## Credentials handling

`.env.local` (gitignored — see `.gitignore`'s `.env.*` entries) holds
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only. **Never** put the
`service_role` / `secret` Supabase key, or any Nimiq wallet private key, into
a file under `src/`, into `.env.local`, or into a commit — those are
server-only. This was verified: `grep`-ing the repo for both secret values
after every session confirms neither ever touched disk in this project;
one-off admin actions (seeding tournaments, cleaning up test data after
Playwright runs) used the secret key transiently in shell commands only.

## What a next agent should build, roughly in order

1. Score validation in an Edge Function (obvious-cheat rejection: implausible
   score for a game, session shorter than the game's minimum possible time).
2. The payout-sending backend process + funded wallet (blocked on #2 above).
3. Tournament close-out cron (mark `ended`, snapshot final ranking).
4. Real entry-fee collection once a house wallet address exists.
5. Vercel deploy + Nimiq Mini Apps submission (blocked on #3 above).
