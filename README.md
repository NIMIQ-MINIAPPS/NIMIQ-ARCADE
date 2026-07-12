<div align="center">

# NIM Arcade

**A Web3 mobile arcade built as a Nimiq Pay Mini App.**
Play, earn XP, convert it to real NIM, and compete for real prizes — all inside your Nimiq wallet.

[![React](https://img.shields.io/badge/React_19-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Zustand](https://img.shields.io/badge/Zustand-443E38?style=for-the-badge&logo=react&logoColor=white)](https://zustand-demo.pmnd.rs)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Deno](https://img.shields.io/badge/Deno_Edge_Functions-000000?style=for-the-badge&logo=deno&logoColor=white)](https://deno.com)
[![Nimiq](https://img.shields.io/badge/Nimiq_Pay_SDK-E9B213?style=for-the-badge&logo=nimiq&logoColor=1F2348)](https://www.nimiq.com)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

**[Play it live →](https://nimiq-arcade.vercel.app)**

</div>

---

## What Is This

NIM Arcade turns idle wallet time into play time. It's a mobile-first arcade of **35 original games** — brain trainers, classic arcade remakes, twitch-reflex action, and logic puzzles — that runs directly inside **Nimiq Pay** as a Mini App. No sign-up form, no seed phrase typed into a browser, no separate account: your Nimiq wallet *is* your identity, and every game session quietly earns you XP that converts into real NIM.

Beyond solo play, players can open **online rooms** — real-money, multi-round tournaments for up to 10 people where the top finishers split the entry-fee pot — or enter **standing tournaments** with global, per-game leaderboards. Every payout, from XP conversions to tournament prizes, is a real on-chain NIM transaction.

Everything fits inside a 430px mobile shell, is playable in under a minute per session, and is built to keep getting harder — every game scales its difficulty without a ceiling, so there's always a reason to come back and beat your own record. Progress is also tracked through **30 achievements** across four rarity tiers (bronze → silver → gold → legendary), each with its own badge shape, gradient, and glow.

---

## How It Works

```
 connect (automatic via Nimiq Pay)
        │
        ▼
 ┌─────────────┐      earn XP        ┌──────────────┐     convert       ┌─────────┐
 │  play a game │ ──────────────────▶ │  XP balance   │ ─────────────────▶│  real NIM│
 └─────────────┘                      └──────────────┘                   └─────────┘
        │                                     │
        │ join a room / tournament            │ lifetime XP always counts
        ▼  (real NIM entry fee)                ▼  toward rank, even after converting
 ┌─────────────────────┐              ┌──────────────────┐
 │ multi-round series    │            │ global leaderboard │
 │ best combined score    │──────────▶│ per game + overall │
 │ wins a share of the pot│            └──────────────────┘
 └─────────────────────┘
```

1. **Open the app inside Nimiq Pay.** The Mini App SDK hands over your wallet address automatically — no login screen.
2. **Pick a name.** Your on-chain address gets a friendly display name that follows you across leaderboards.
3. **Play anything.** Every game session reports a score; personal bests are saved locally and synced to the backend.
4. **Earn XP, not "wins."** These are infinite, high-score games with no win condition — so progress is measured in XP, with daily-diminishing conversion rates to keep the economy sustainable.
5. **Convert XP → NIM whenever you want.** Converting spends your *redeemable* XP, but your *lifetime* XP — and therefore your rank — never goes down.
6. **Go online.** Create or join a room (2–10 players, real NIM entry fee, one or several games, 5–20 rounds of ~2 minutes each). Best combined score across all rounds wins a cut of the pot. Or enter a standing tournament and climb a global, per-game ranking.
7. **Get paid, instantly.** The moment a conversion or a room/tournament prize is queued, a database trigger fires the payout function immediately — no polling delay. A backend cron sweep runs every 2 minutes as a fallback in case that trigger ever misses.

---

## The Games

35 games across four categories, each with infinitely escalating difficulty, local high scores, haptic + audio feedback (toggleable from anywhere in the app), and 30-second-to-3-minute sessions.

<details open>
<summary><b>🧠 Brain Training</b> (10)</summary>

| Game | Description | Difficulty |
|---|---|:---:|
| Memory Matrix | Memorize a grid of lit cells, reproduce the pattern | Medium |
| Lowdown | Higher or lower? Quick math under pressure | Easy |
| Dual N-Back | Track two simultaneous sequences in working memory | Hard |
| Color Stroop | Name the ink color, not the word — fight your brain | Medium |
| Number Flow | Mental arithmetic chains under time pressure | Medium |
| Pattern Sync | Complete visual sequences before they vanish | Easy |
| Focus Grid | Spot the odd element in a shifting grid | Easy |
| Speed Sort | Classify shapes and colors with a single tap | Easy |
| Word Fresh | Catch falling letters and form words before they pile up | Medium |
| Low Pop | Tap numbered hexagons in ascending order | Easy |

</details>

<details open>
<summary><b>🕹️ Classic Arcade</b> (10)</summary>

| Game | Description | Difficulty |
|---|---|:---:|
| Nimtris | Classic falling-block puzzle. Clear lines, chain combos | Medium |
| Hex Fall | Block-blast grid. Tap groups of 2+ to shatter them | Easy |
| Snake Path | Grow without hitting walls or yourself | Easy |
| Galaxy Defender | Galaga-style shooter. Survive waves of alien ships | Medium |
| Space Raid | Vertical shoot-em-up. Dodge and blast waves of enemies | Medium |
| Breakwall | Smash all bricks with the ball. Don't let it drop | Easy |
| Pac Maze | Clear the dots, outrun the chasers | Medium |
| Asteroid Field | Rotate, thrust, and destroy all asteroids | Medium |
| Frog Cross | Cross the road and river without getting hit | Easy |
| Pong Duel | Classic 1v1 paddle battle, now online | Easy |

</details>

<details open>
<summary><b>⚡ Action</b> (6)</summary>

| Game | Description | Difficulty |
|---|---|:---:|
| Hex Runner | Endless side-scroller. Jump obstacles, go further | Hard |
| Quick Tap | Tap targets before they vanish. Pure reflex test | Easy |
| Gravity Switch | Flip gravity to survive a corridor of spikes | Hard |
| Neon Blade | Swipe to slice incoming objects, miss nothing | Medium |
| Dodge Storm | Survive waves of projectiles using only movement | Hard |
| Tower Stack | Drop moving blocks to build the tallest tower | Easy |

</details>

<details open>
<summary><b>🧩 Puzzle</b> (9)</summary>

| Game | Description | Difficulty |
|---|---|:---:|
| Memory Rush | Flip cards to match pairs before the clock hits zero | Easy |
| Perilous Path | Memorize mines, then navigate A to B from memory | Medium |
| Mini Sudoku | Quick 4×4 and 6×6 Sudoku puzzles against the clock | Medium |
| Merge Hex | 2048 on a hexagonal grid. Merge to reach 4096 | Medium |
| Color Path | Draw lines to connect matching colors without crossing | Easy |
| Shift Blocks | Slide pieces to clear the board in minimum moves | Medium |
| Hex Flow | Rotate pipes to guide liquid to every outlet | Medium |
| Light Bounce | Place mirrors so a beam hits every crystal | Hard |
| Sum Path | Trace a path through the grid that hits the target sum | Hard |

</details>

Full design specs for every game (visual language, animation timing, difficulty curves) live in [`GAMES.md`](./GAMES.md).

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **UI** | React 19 + TypeScript (strict) | Component tree, full type safety, no `any` |
| **Build** | Vite 8 | Sub-second HMR, production bundling |
| **Styling** | Tailwind CSS v4 | Utility-first, CSS custom properties for the design system |
| **Motion** | Framer Motion | Page transitions, card and score animations |
| **State** | Zustand + `persist` | Client state, high scores, and preferences in `localStorage` |
| **Rendering** | Canvas 2D + SVG | Physics-driven games (Nimtris, Runner, Space Raid…) and every game cover illustration |
| **Backend** | Supabase (Postgres + RLS + Realtime + Edge Functions) | Identity, XP sync, leaderboards, rooms, tournaments, payouts |
| **Automation** | `pg_cron` + `pg_net` | A database trigger fires payouts instantly on every new pending row; a cron sweep every 2 min covers any miss |
| **Blockchain** | `@nimiq/mini-app-sdk` + `@nimiq/core` | Wallet connect, entry-fee payments, and signed NIM payouts |
| **Hosting** | Vercel | Zero-config deploys, CI on every push to `main` |

---

## Multiplayer & Tournaments

**Rooms** are the core competitive loop: a host picks one or several games, sets a real NIM entry fee, a round count (5–20 rounds), and invites up to 10 players via a room code. Each round is a ~2-minute timed match in the chosen game; scores across all rounds are summed. When every round is played, the pot (entry fee × player count) pays out automatically as real NIM transactions:

- **70% / 20% / 10%** of 95% of the pot goes to 1st / 2nd / 3rd place
- The remaining **5% stays with the platform** — a real, self-funding cut, since entry fees and prize payouts both flow through the same wallet

**Tournaments** are standing competitions with entry fees that don't require everyone to be online at once — players enter whenever, and rankings update live. (Prize-pool payout for tournaments, mirroring the rooms mechanic above, is on the roadmap — entries and rankings work today, automatic payout doesn't yet.)

Every game also has its own **global leaderboard**, plus a single **overall ranking** across everything a player has ever earned — so casual players and specialists both have a ladder to climb.

---

## Why This Is a Good Fit for Nimiq

NIM Arcade isn't just a game collection with a wallet bolted on — it's a low-friction acquisition and retention funnel built entirely on primitives Nimiq already provides:

- **Zero-onboarding-friction demo of Nimiq Pay.** A new user's first interaction with Nimiq can be "open a link and start playing" instead of "install a wallet, write down 24 words, buy crypto." The Mini App SDK handles identity silently in the background.
- **A concrete, playful use case for NIM's actual selling points.** Fast, cheap transactions aren't an abstract pitch here — they're the thing that makes instant entry fees, instant payouts, and daily XP-to-NIM conversion *feel* good instead of annoying. Every session is a live demo of why Nimiq's fee/speed profile matters.
- **A built-in reason to return daily.** Diminishing XP-conversion rates past a daily threshold (see `src/lib/xp.ts`) reward regular short sessions over one-off binges — exactly the retention shape a Mini Apps ecosystem wants.
- **A viral, social growth loop.** Rooms are shareable by room code and have real stakes; tournaments create standing competition. Both give players an organic reason to invite friends into their wallet app.
- **Extensible inventory for partnerships.** 35 games across four genres means there's already a slot for a sponsored tournament, a branded room, or a seasonal event — without shipping new code.
- **Everything is auditable on-chain.** Entry fees, conversions, and payouts are all real NIM transactions, which makes NIM Arcade a visible, ongoing showcase of network activity rather than a walled-garden points system.

---

## Project Structure

```
src/
  games/<game-id>/<Game>.tsx    35 self-contained game components
  components/
    games/GameIllustration.tsx  SVG cover art for every game, matched to its real palette
    ui/                         Shared hex-badge, XP bar, NIM badge components
  lib/
    games.ts                    Game registry (id, category, difficulty, XP multiplier)
    nimiq.ts                    Nimiq Pay SDK wrapper — real SDK in prod, mock in dev
    houseWallet.ts               Entry-fee collection helper
    xp.ts                       XP economy: daily caps, level curve, XP→NIM rate
    backend.ts / backendSync.ts  Supabase sync — identity, scores, XP, rooms, tournaments
    rooms.ts / tournaments.ts   Multi-round room and tournament client logic
  store/useGameStore.ts         Zustand store: user, XP, high scores, active room/tournament
  pages/                        Home · Games · Online · Tournaments · Profile
supabase/
  schema.sql, 00X_*.sql         Tables, RLS policies, security-definer RPCs, the
                                 instant-payout trigger, and pg_cron schedule
  functions/process-payouts/    Edge Function that signs and broadcasts real NIM payouts
```

---

## Running Locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + anon key
npm run dev                  # http://localhost:5173
```

Outside of Nimiq Pay, the app falls back to a mock Nimiq SDK (fake address, fake balance) so the full experience — including a visible **DEMO MODE** banner — works in any browser without a wallet.

---

## Repository

[github.com/NIMIQ-MINIAPPS/NIMIQ-ARCADE](https://github.com/NIMIQ-MINIAPPS/NIMIQ-ARCADE) · Live at [nimiq-arcade.vercel.app](https://nimiq-arcade.vercel.app)
