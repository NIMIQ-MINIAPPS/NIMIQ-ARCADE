# NIM-ARCADE

**Web3 arcade gaming platform built as a Nimiq Pay Mini App.**  
Earn XP by playing games, convert it to NIM, compete in tournaments, and challenge players worldwide.

---

## What Is This

NIM-ARCADE is a mobile-first web app designed to run inside Nimiq Pay as a Mini App. Players connect their Nimiq wallet, play arcade and brain-training games, accumulate XP, and convert that XP to real NIM cryptocurrency. The entire UI fits in a 430px-wide mobile shell.

The project is currently in active development. Five games are fully playable; 25 more are designed and ready to be built.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **UI Framework** | React 18 | Component tree, state, re-renders |
| **Build Tool** | Vite 8 | Dev server (HMR), production bundler |
| **Language** | TypeScript (strict) | Type safety across the entire codebase |
| **Styling** | Tailwind CSS v4 | Utility classes via `@tailwindcss/vite` plugin |
| **Animations** | Framer Motion | Page transitions, card animations, micro-interactions |
| **State** | Zustand + persist | Global game state persisted to `localStorage` |
| **2D Graphics** | Canvas API | Nimtris (Tetris engine), Hex Runner (scrolling runner) |
| **Wallet** | Nimiq Pay Mini App SDK | Wallet connect, balance, address — mocked in dev |
| **SEO** | JSON-LD, llms.txt, robots.txt | AI-engine discoverability, structured data |

### CSS Design System

All colors are CSS custom properties defined in `src/index.css`:

```css
--y1: #f5f6ab  /* soft lemon */
--y2: #edeeb6  /* pale butter */
--y3: #eaeac2  /* cream */
--y4: #f5f5f0  /* near-white */
--y5: #fdfde7  /* paper white (base background) */

--nim-dark:  #1F2348  /* Nimiq navy — primary text */
--nim-navy:  #2E3565
--nim-mid:   #4A5585  /* secondary text */
--nim-muted: #7B82A8  /* placeholder / label text */

--gold:      #E9B213  /* Nimiq gold — primary accent */
--gold-dark: #C49210  /* hover / active gold */
```

Decorative hexagons use a CSS `clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)` utility class `.hex-clip`. SVG hex tile patterns are inlined as base64 data URIs for `.hex-pattern` and `.hex-pattern-gold` backgrounds.

---

## Project Structure

```
src/
  components/
    games/
      GameIllustration.tsx   — 30 pure-SVG game preview illustrations
    ui/
      Hex.tsx                — HexBadge, NimLogo, DecorHex, HexGrid, PulseHex
      NimBadge.tsx           — Displays a NIM amount with the hex logo
      XpBar.tsx              — XP progress bar showing level + next-level threshold
  games/
    nimtris/NimtrisGame.tsx  — Full Tetris (Canvas 2D, 10×20 board)
    hexfall/HexfallGame.tsx  — Block Blast (7×10 grid, flood-fill groups)
    memory/MemoryGame.tsx    — Card matching (round-based, timer)
    quicktap/QuickTapGame.tsx — Reflex tapping (targets spawn and expire)
    runner/RunnerGame.tsx    — Endless side-scroller (Canvas 2D, physics)
  lib/
    games.ts                 — Definitions for all 30 games (id, name, category, XP multiplier, available flag)
    nimiq.ts                 — Nimiq Pay SDK wrapper (mock in dev → real SDK in prod)
    xp.ts                    — XP→NIM conversion, daily caps, level calculation
  pages/
    HomePage.tsx             — Dashboard: balance, XP, stats, quick-play carousel
    GamesPage.tsx            — Game grid with category filter, game launcher overlay
    TournamentsPage.tsx      — Tournament listings with entry fees and prize pools
    OnlinePage.tsx           — Multiplayer: quick match, create room, join room
    ProfilePage.tsx          — User stats, achievements, leaderboard
  store/
    useGameStore.ts          — Zustand store: user, XP, high scores, active tab
  types/
    index.ts                 — Shared TypeScript interfaces
public/
  robots.txt                 — Allows all AI crawlers (GPTBot, ClaudeBot, PerplexityBot…)
  llms.txt                   — Context file for AI systems (games, economy, FAQ, tech)
  pricing.md                 — Machine-readable pricing for AI agents
```

---

## XP Economy

| XP earned today | Conversion rate |
|---|---|
| 0 – 5,000 XP | 100% |
| 5,000 – 10,000 XP | 70% |
| 10,000+ XP | 40% |

Daily cap: **50,000 XP**. Conversion rate: **1,000 XP = 0.001 NIM**.

---

## Games: What Exists

### Fully Playable (5 games)

| Game | File | Renderer | Description |
|---|---|---|---|
| **Nimtris** | `games/nimtris/` | Canvas 2D | Tetris with 7 tetrominoes, hard drop, wall kicks |
| **Hex Fall** | `games/hexfall/` | React DOM | Block-blast; tap groups of 2+ same-color tiles |
| **Memory Rush** | `games/memory/` | React DOM | Card-pair matching, round timer, escalating pairs |
| **Quick Tap** | `games/quicktap/` | React DOM | Tap targets before they expire; 5 misses = over |
| **Hex Runner** | `games/runner/` | Canvas 2D | Endless side-scroller, jump to avoid obstacles |

### Designed, Not Yet Built (25 games)

All 25 are defined in `src/lib/games.ts` with `available: false` and have SVG preview illustrations in `GameIllustration.tsx`. Full design specs for all 30 games are in `GAMES.md`.

**Brain Training:** Dual N-Back, Number Flow, Pattern Sync, Focus Grid, Speed Sort, Word Flux  
**Classic Arcade:** Snake Path, Space Raid, Breakwall, Pac Maze, Asteroid Field, Frog Cross, Pong Duel  
**Action:** Gravity Switch, Neon Blade, Dodge Storm, Tower Stack  
**Puzzle:** Merge Hex, Color Path, Shift Blocks, Hex Flow, Light Bounce, Sum Path

---

## Running Locally

```bash
npm install
npm run dev        # starts at http://localhost:5173
```

The Nimiq SDK is mocked in development — it returns a fake wallet address and 42.5 NIM balance automatically. No wallet connection is needed to develop or test.

---

## Nimiq Pay Integration

In production, replace the mock in `src/lib/nimiq.ts`:

```ts
// dev mock (current)
export async function initNimiq(): Promise<NimiqSDK>  // returns MockNimiqSDK

// production target
import { init } from '@nimiq/mini-app-sdk'
```

The SDK provides `listAccounts()` → `[{ address, balance }]`.

---

## Navigation

Five tabs, managed by Zustand `setActiveTab()`:

| Tab | Page | Icon |
|---|---|---|
| `home` | HomePage | Home |
| `games` | GamesPage | Gamepad |
| `tournaments` | TournamentsPage | Trophy |
| `online` | OnlinePage | Wifi |
| `profile` | ProfilePage | User |

---

## Repository

[https://github.com/NIMIQ-MINIAPPS/NIMIQ-ARCADE](https://github.com/NIMIQ-MINIAPPS/NIMIQ-ARCADE)
