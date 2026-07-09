# AGENTS.md — Nimiq Mini App SDK + Supabase backend

Context for whichever agent picks up production integration work on this repo.

## Current state (updated — real SDK is wired, backend schema is drafted)

`@nimiq/mini-app-sdk@0.1.0` is installed and `src/lib/nimiq.ts` now detects
whether it's running inside Nimiq Pay (`window.nimiq` present) and uses the
real `NimiqProvider` when it is, falling back to `MockNimiqSDK` otherwise
(local dev / preview outside Nimiq Pay). `App.tsx` shows a "DEMO MODE" banner
when the mock is active (`isUsingMockSdk()`).

**The real SDK's actual shape (verified against the installed package's
`.d.ts`, not assumed) differs from what the mock originally modeled:**

- `nimiq.listAccounts()` resolves to `string[] | ErrorResponse` — addresses
  only, **no balance field**. There is no documented method anywhere (this
  package's types, nimiq.dev's Mini Apps page, or the Hub API references
  linked from it) for fetching a NIM balance. `RealNimiqSDK.listAccounts()`
  in `src/lib/nimiq.ts` returns `balance: 0` for real accounts and says so in
  a comment — **do not silently fake a balance number**, find the real method
  first (likely a Hub API call or a `nimiq.request()` JSON-RPC passthrough —
  unconfirmed, needs Nimiq's fuller docs or a support question).
- There is no `requestPayment()`. Payments go through
  `NimiqProvider#sendBasicTransaction({ recipient, value, fee?,
  validityStartHeight? })`, where `value` is in **Lunas** (1 NIM = 1e5 Lunas),
  not decimal NIM — `RealNimiqSDK.requestPayment()` does the conversion.
- `requestDeviceIdentifier` is a **top-level SDK export**, not a provider
  method, and requires `{ reason: string }` shown to the user in a consent
  prompt on first call per origin.
- `init(options?: { timeout?: number })` only resolves once Nimiq Pay injects
  `window.nimiq` — it hangs forever outside Nimiq Pay, so `initNimiq()` checks
  `isRunningInNimiqPay()` before ever calling it.
- EVM/USDT support (`window.ethereum`, ERC-20 on Polygon/Arbitrum/Optimism/
  Base/BNB/Sepolia) is real and documented on nimiq.dev's Mini Apps page, but
  is **not part of `@nimiq/mini-app-sdk`** — it's the standard injected
  `window.ethereum` provider. Not wired in this repo yet; would need its own
  integration (viem/ethers) if USDT payments are required.

A Supabase backend schema exists at `supabase/schema.sql` (players,
high_scores, rooms, room_players, tournaments, tournament_entries, payouts —
all RLS-enabled) but **has not been applied yet** — see "Blocked on the user"
below. `src/lib/supabase.ts` / `src/lib/database.types.ts` exist and compile,
but nothing in the app calls them yet (no Online/Tournaments/Profile backend
wiring — those pages are still fully mocked with hardcoded arrays).

## What's already defined (don't redesign it, just implement it)

```ts
export interface NimiqSDK {
  listAccounts: () => Promise<NimiqAccount[]>
  requestPayment: (params: PaymentRequest) => Promise<PaymentResult>
  requestDeviceIdentifier: () => Promise<string>
}
```

`App.tsx`, `HomePage.tsx`, `ProfilePage.tsx` all consume this interface (not
the raw SDK) via `initNimiq()` / `getNimiqSDK()` — keep it stable, adapt
`RealNimiqSDK` internally if the underlying SDK's surface changes.

## Blocked on the user (cannot be done by an agent alone)

1. **Apply `supabase/schema.sql`.** No Postgres password or Management API
   personal access token (`sbp_...`) was ever provided — only the project's
   API keys (anon/publishable, service_role/secret), which can't run DDL via
   PostgREST. The user needs to paste the file into Supabase's SQL Editor
   themselves (or hand over a DB connection string / PAT).
2. **Enable Anonymous Sign-ins** in Supabase Auth → Providers. The schema's
   RLS policies assume `players.id = auth.uid()` from
   `supabase.auth.signInAnonymously()` — nothing works until this is on.
3. **Server-side wallet for payouts.** `payouts` rows are read-only from the
   client by design (RLS has no insert/update policy for regular users) —
   they must be created/updated by a service_role-authenticated backend
   process (Edge Function + cron). That process needs a funded Nimiq wallet
   whose private key never touches this repo or the Supabase `anon` context.
4. **Vercel deploy access** and **Nimiq Mini Apps registration** — both are
   manual, account-bound actions on the user's side.

## Credentials handling

`.env.local` (gitignored — see `.gitignore`'s `.env.*` entries) holds
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only. The anon key is meant
to be public (it ships in the client bundle); RLS is what actually protects
data, not secrecy of that key. **Never** put the `service_role` / `secret`
Supabase key, or any Nimiq wallet private key, into a file under `src/`, into
`.env.local`, or into a commit — those are server-only and belong in Supabase
Edge Function secrets / Vercel environment variables, set through their
respective dashboards, not through this repo.

## Known gaps still open

- NIM balance fetching (see above) — needs real Nimiq docs, not guessed.
- OnlinePage / TournamentsPage / ProfilePage still read hardcoded arrays
  (`ROOMS`, `TOURNAMENTS`, `LB`) — wiring them to the new `players` /
  `rooms` / `tournaments` tables is the next phase, blocked on schema
  application (see above).
- No Edge Functions written yet (score validation, payout processing,
  tournament close-out cron).
