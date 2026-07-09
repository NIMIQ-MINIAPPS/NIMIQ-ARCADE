# AGENTS.md — Nimiq Mini App SDK integration

Context for whichever agent picks up the **real** Nimiq Pay Mini App SDK integration. This repo currently runs entirely on a mock.

## Current state

`src/lib/nimiq.ts` is 100% mock — `MockNimiqSDK` returns a fake wallet
(`NQ07 0000 0000 0000 0000 0000 0000 0000 0000`, 42.5 NIM hardcoded) and
resolves payments after a 1s `setTimeout` with a random fake `txHash`.

No Nimiq package is installed:
- `@nimiq/mini-app-sdk` → not in `package.json`
- `@nimiq/core` → not in `package.json`
- nothing under `node_modules/@nimiq`

`initNimiq()` is called once in `src/App.tsx` on mount; the resulting
`nimiqAddress`/`nimBalance` are stored in `useGameStore` (Zustand). No game
component talks to `nimiq.ts` directly — games only call `addXp` /
`setHighScore` from `useGameStore`; XP→NIM conversion and payouts happen at
the page level (Profile/Tournaments), not inside individual games.

## What's already defined (don't redesign it, just implement it)

The interface in `src/lib/nimiq.ts` is the contract to fill in:

```ts
export interface NimiqSDK {
  listAccounts: () => Promise<NimiqAccount[]>
  requestPayment: (params: PaymentRequest) => Promise<PaymentResult>
  requestDeviceIdentifier: () => Promise<string>
}
```

Swap the mock for the real SDK:

```ts
// current:
sdk = new MockNimiqSDK()

// target:
import { init } from '@nimiq/mini-app-sdk'
sdk = await init()
```

`listAccounts`, `requestPayment`, `requestDeviceIdentifier` should already
match the real SDK's shape closely enough that callers (`App.tsx`,
Profile/Tournaments pages) shouldn't need changes — verify against the real
SDK's actual types once installed, since the mock's shape was written by
inference, not against real docs.

## What a future agent needs before starting

1. **The Nimiq Mini App SDK docs** — `https://nimiq.github.io/mini-app-sdk/`
   (methods: `init()`, `listAccounts()`, `requestPayment()`). Fetch and read
   this before writing code; the mock's interface may not match 1:1.
2. **Project context**: mobile-first Mini App, UI capped at 430px
   (`src/index.css`), meant to run embedded inside Nimiq Pay.
3. **Starting point**: `src/lib/nimiq.ts` — the interface is defined, only
   the implementation needs to change.

## Known gaps to flag, not necessarily fix in the same pass

- No `NimiqProvider`/`useNimiq()` — SDK init is a bare `useEffect` in
  `App.tsx`. Fine for a mock; worth reconsidering once real network calls
  and error states (rejected payment, no wallet, offline) enter the
  picture.
- No env vars / config for sandbox vs. production Nimiq Pay endpoints —
  will need one once the real SDK is wired in.
