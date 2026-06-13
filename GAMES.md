# NIM-ARCADE — Complete Game Design Specifications

30 arcade games designed for the NIM Arcade ecosystem. Each spec is self-contained and ready to be pasted into a game generation prompt. An AI design system should be able to read any single game entry and produce a complete, premium-quality mobile game.

---

## Global Design Tokens

These tokens apply to ALL 30 games. Every game inherits this palette and these rules.

```
Primary Gold:      #E9B213
Gold Dark:         #C49210
Gold Light:        #F7DC6F
Gold Glow:         rgba(233, 178, 19, 0.30)
Gold Background:   rgba(233, 178, 19, 0.12)

Dark Navy:         #1F2348
Secondary Navy:    #2E3565
Mid Navy:          #4A5585
Muted:             #7B82A8

Game Background:   #0C0A06
Card Surface:      #16130E

Success Green:     #27AE60
Danger Red:        #E74C3C
Electric Blue:     #00BFFF
Cyber Purple:      #A855F7
Neon Pink:         #FF4D9D
Arcade Cyan:       #00E5FF
Lime:              #7CFC00
```

**Viewport:** 430 × 932px mobile shell. Games fill 95–100% of screen.

**Typography:** Bold, high-contrast. Score: 32–48px. Labels: 12–16px. Buttons: 18–22px.

**Universal Screens:** Every game must have Start → Ready (3-2-1-GO) → Gameplay → Pause (blur overlay) → Game Over (score + XP + play again).

---

## GAME 01 — NIMTRIS

**Status:** ✅ BUILT  
**Category:** Classic Arcade  
**Difficulty:** Medium  
**XP Multiplier:** ×1.2  
**Renderer:** Canvas 2D  
**File:** `src/games/nimtris/NimtrisGame.tsx`

### How to Play

Classic Tetris. Seven tetrominoes fall from the top of a 10-column × 20-row grid. Move pieces left/right, rotate, soft-drop, or hard-drop. Complete full horizontal lines to clear them. Cleared lines score points; multi-line clears score exponentially more. Speed increases with level. Game ends when pieces stack above the top row.

### Gameplay Loop

Piece spawns at top → player positions it → piece locks on landing → lines checked → cleared lines animate → score updates → next piece spawns → repeat. Every 10 lines cleared, level increases and drop speed increases.

### Visual Elements

**Game Canvas**
- Shape: Rectangle filling viewport width (380px)
- Size: 280 × 560px (10 cols × 20 rows × 28px cells)
- Fill: `#0C0A06`
- Border: None

**Grid Cell (Empty)**
- Shape: Square
- Size: 28 × 28px with 1px gap
- Fill: Transparent
- Stroke: `rgba(255, 255, 255, 0.04)` — barely visible grid lines
- Idle: Static

**Active Tetromino**
- Shape: 4 connected squares forming one of 7 tetromino shapes (I, O, T, S, Z, J, L)
- Size: Each block 28 × 28px
- Fill: Per-piece colors:
  - I-piece: Cyan `#00BCD4`
  - O-piece: Yellow `#FFEB3B`
  - T-piece: Magenta `#E91E63`
  - J-piece: Blue `#2196F3`
  - L-piece: Orange `#FF9800`
  - S-piece: Green `#4CAF50`
  - Z-piece: Red `#F44336`
- Glow: Subtle inner shadow matching piece color at 30% opacity
- Spawn: Appears at top-center, no animation
- Idle: Falls at current speed (500ms level 1 → 50ms level 15)
- Move: Instant lateral shift on input
- Rotate: Instant 90° clockwise
- Hard drop: Instant teleport to lowest valid position

**Ghost Piece**
- Shape: Same as active tetromino
- Size: Same
- Fill: `rgba(255, 255, 255, 0.12)`
- Stroke: Dashed outline 1px `rgba(255, 255, 255, 0.2)`
- Position: Always at the lowest valid drop position for current piece

**Locked Cells**
- Shape: Square
- Size: 28 × 28px
- Fill: Same 7 colors as active pieces, brightness reduced 15%
- Stroke: 1px darker shade of cell color
- Idle: Static

**Line Clear Animation**
- Trigger: When a row is fully filled
- Effect: Row flashes white (120ms), then all cells in row scale to 0 and collapse, rows above slide down
- Duration: 300ms total
- Particles: 8–12 small squares scatter from row, matching row cell colors, fade over 400ms

**Score Panel**
- Shape: Horizontal strip above canvas
- Size: Full width × 40px
- Fill: `rgba(0, 0, 0, 0.6)` with blur
- Score Label: "SCORE" — `#E9B213` gold, 10px, tracking widest, font-weight 900
- Score Value: White, 24px, font-weight 900
- Position: Top-left

**Level Indicator**
- Shape: Pill badge
- Size: Auto width × 24px, rounded-full
- Fill: `#E9B213` gold
- Text: `#1F2348` navy, "LV 3", 11px, font-weight 900
- Position: Top-right

**Next Piece Preview**
- Shape: 4×4 mini-grid
- Size: 80 × 80px
- Fill: `rgba(255, 255, 255, 0.04)`
- Border: `rgba(255, 255, 255, 0.1)` 1px
- Position: Top-center
- Content: Next tetromino displayed at 50% scale

### Screen Flow

1. **Start:** Dark canvas, "NIMTRIS" title 48px white font-weight 900, gold "PLAY" button centered, hex-pattern background subtly animated
2. **Ready:** 3-2-1-GO countdown, each number 72px, scale 1.5→1.0 with bounce, screen shakes on "GO"
3. **In-game:** Score top-left, level top-right, next piece top-center, active piece falling, ghost at bottom
4. **Line clear:** Row flashes white → collapses → particles scatter → score floats "+100" in gold upward
5. **Game over:** Canvas freezes, dark overlay fades in (400ms), card appears with: Final Score (large white), Best Score (gold if beaten), XP Earned (gold badge), "PLAY AGAIN" (gold button), "EXIT" (muted button)

### Difficulty Scaling

- Level 1: 500ms drop interval
- Every 10 lines: level +1, drop interval ×0.85
- Level 15+: 50ms minimum (maximum speed)

### Combo System

- Single line: 100 pts
- Double: 300 pts, "+300" popup in gold
- Triple: 500 pts, "+500" popup + glow
- Tetris (4 lines): 800 pts, "+800 TETRIS!" popup + screen flash + particles

### XP Formula

`Math.floor(score × 0.5)`

---

## GAME 02 — HEX FALL

**Status:** ✅ BUILT  
**Category:** Classic Arcade  
**Difficulty:** Easy  
**XP Multiplier:** ×1.0  
**Renderer:** React DOM  
**File:** `src/games/hexfall/HexfallGame.tsx`

### How to Play

A 7-column × 10-row grid filled with colored tiles. Tap any tile to highlight its "group" — all connected tiles of the same color (flood-fill adjacency, horizontal and vertical). Tap the highlighted group again to destroy it. Tiles above fall down to fill gaps. Empty columns collapse inward. The player has 30 moves. Score depends on group size — larger groups score exponentially more.

### Gameplay Loop

Grid fills with random tiles → player taps a tile → group highlights → player confirms tap → group shatters → gravity pulls tiles down → empty columns slide inward → new tiles fill gaps → check for chain reactions → repeat until 30 moves exhausted.

### Visual Elements

**Grid Background**
- Shape: Rectangle
- Size: Full viewport width, height = 10 rows × ~38px + gaps
- Fill: `#16130E`

**Tile (Normal)**
- Shape: Rounded square
- Size: 38 × 38px, border-radius 8px
- Fill: 6 distinct colors:
  - Red: `#E74C3C`
  - Blue: `#3498DB`
  - Green: `#2ECC71`
  - Yellow: `#F1C40F`
  - Purple: `#9B59B6`
  - Orange: `#E67E22`
- Glow: None in normal state
- Spawn: Scale 0→1 with bounce, 200ms, staggered 20ms per tile
- Idle: Static
- Hover/Selected: N/A (selection is group-based)

**Tile (Selected / Highlighted Group)**
- Shape: Same rounded square
- Size: Same
- Fill: Same base color at +50% brightness
- Stroke: White outline 2px
- Glow: Soft colored bloom matching tile color, radius 8px
- Animation: Gentle pulse scale 1.0→1.05→1.0, 600ms loop
- Label: Group count "×N" floating above the group in white, 14px bold

**Tile (Destroying)**
- Shape: Breaks into 4–6 polygon fragments
- Fill: Same color as tile
- Animation: Fragments scatter outward with gravity, 400ms, fade to 0 opacity
- Particles: 6–8 sparkle dots in tile color, burst outward, 300ms

**Tile (Falling — Gravity)**
- Shape: Same tile
- Animation: Translate Y downward to new position, 200ms ease-out
- Effect: Subtle motion blur

**Moves Counter**
- Shape: Pill badge
- Size: Auto × 28px, rounded-full
- Fill: `#1F2348` navy
- Text: `#E9B213` gold, "22 MOVES", 12px, font-weight 900
- Position: Top-right

**Score Display**
- Shape: Text block
- Size: Auto
- Score Label: "SCORE" — `#E9B213`, 10px, tracking widest
- Score Value: White, 28px, font-weight 900
- Position: Top-left

**Combo Banner**
- Shape: Full-width horizontal strip
- Size: Viewport width × 40px
- Fill: `#E9B213` gold
- Text: `#1F2348` navy, "COMBO ×3!", 16px, font-weight 900
- Spawn: Slides down from top, 200ms
- Idle: Holds 1.2s
- Destroy: Slides up, 200ms
- Glow: Gold bloom `rgba(233, 178, 19, 0.4)` behind strip

### Screen Flow

1. **Start:** Full grid of colored tiles, score 0, "30 MOVES" badge, animated background hex pattern
2. **Tap tile:** Entire connected group highlights with glow + pulse + "×N" count
3. **Confirm tap:** Tiles shatter into fragments → particles burst → tiles fall → columns collapse
4. **Chain reaction:** If falling tiles form new groups that auto-clear, "COMBO ×N" banner slides in
5. **Moves exhausted:** Overlay with final score, tiles remaining count, XP earned, play again / exit

### Difficulty Scaling

- Moves: Fixed 30
- Score formula: `group_size²` — incentivizes large group clears
- 6 colors keep the grid random enough to require strategy

### Combo System

- Chain × 2: Small glow on score
- Chain × 3: Combo banner + score multiplier ×1.5
- Chain × 5+: Banner + screen pulse + particles everywhere

### XP Formula

`Math.floor(score × 0.3)`

---

## GAME 03 — MEMORY RUSH

**Status:** ✅ BUILT  
**Category:** Puzzle  
**Difficulty:** Easy  
**XP Multiplier:** ×0.8  
**Renderer:** React DOM  
**File:** `src/games/memory/MemoryGame.tsx`

### How to Play

A grid of face-down cards. Tap to flip two cards per turn. If both cards show the same icon, they stay face up (matched). If they differ, both flip back face-down after 600ms. Match all pairs before the timer runs out. Each round increases the number of pairs and shortens the timer.

### Gameplay Loop

Round starts → cards appear face-down → player flips first card → flips second card → match check → matched pair stays, mismatched pair flips back → repeat until all matched or time expires → next round with more pairs and less time.

### Visual Elements

**Card (Face Down)**
- Shape: Rounded rectangle
- Size: 70 × 90px, border-radius 12px
- Fill: `#1F2348` navy
- Pattern: Subtle hex pattern centered, 20% opacity gold
- Stroke: 1px `rgba(255, 255, 255, 0.08)`
- Idle: Static
- Spawn: Fade in 0→1, staggered 30ms per card

**Card (Flipping)**
- Shape: Same
- Animation: 3D rotateY 0°→180°, 300ms ease-in-out
- First half (0–90°): Shows back, shrinks horizontally
- Second half (90–180°): Shows face, expands horizontally

**Card (Face Up — Unmatched)**
- Shape: Same rounded rectangle
- Size: Same
- Fill: `#f5f5f0` off-white
- Icon: Centered symbol/emoji, 32px
- Stroke: 1px `rgba(31, 35, 72, 0.1)`

**Card (Matched)**
- Shape: Same
- Fill: `rgba(39, 174, 96, 0.15)` light green tint
- Stroke: 2px `#27AE60` green
- Icon: Same, + small checkmark overlay bottom-right
- Animation: Green pulse ring expands outward, 400ms

**Card (Mismatch)**
- Animation: Both cards shake horizontally ±4px, 200ms, 3 cycles
- Tint: Brief red overlay `rgba(231, 76, 60, 0.2)`, 200ms
- Then: Both flip back face-down

**Timer Bar**
- Shape: Horizontal bar, full width
- Size: Viewport width × 6px
- Fill: Gradient from `#E9B213` gold (full) → `#E74C3C` red (depleting)
- Animation: Width shrinks continuously from 100% to 0%
- Position: Top of screen
- Danger: When <25%, bar pulses red

**Round Indicator**
- Shape: Pill badge
- Size: Auto × 24px
- Fill: `#1F2348` navy
- Text: `#E9B213` gold, "ROUND 3", 11px, font-weight 900
- Position: Top-center

### Screen Flow

1. **Round start:** Cards deal out face-down in grid, timer bar full gold, "ROUND N" badge appears
2. **First flip:** Card rotates to reveal icon, stays face-up
3. **Second flip — match:** Both cards pulse green, checkmark appears, pair stays visible
4. **Second flip — mismatch:** Both cards shake + red tint, then flip back after 600ms
5. **All matched:** "ROUND CLEAR!" banner in gold, 1s pause, next round loads with more cards
6. **Time expires:** "TIME'S UP" overlay, shows pairs matched, total score, XP earned

### Difficulty Scaling

- Round 1: 3 pairs, 30s timer
- Each round: +1 pair (max 12), timer = max(10, 30 − round×2) seconds
- Card icons get more visually similar at higher rounds

### XP Formula

`Math.floor(score × 0.4)`

---

## GAME 04 — QUICK TAP

**Status:** ✅ BUILT  
**Category:** Action  
**Difficulty:** Easy  
**XP Multiplier:** ×0.9  
**Renderer:** React DOM  
**File:** `src/games/quicktap/QuickTapGame.tsx`

### How to Play

Circular targets appear at random positions on a dark screen. Each target shrinks over its lifetime. Tap the target before it disappears to score points — faster reactions earn more. If a target expires without being tapped, it counts as a miss. 5 misses end the game. Spawn rate increases and lifetimes shorten each round.

### Gameplay Loop

Target spawns at random position → target shrinks over lifetime → player taps → reaction-based score awarded → next target(s) spawn → miss 5 = game over.

### Visual Elements

**Target (Spawning)**
- Shape: Circle with layered concentric rings
- Size: 64px outer diameter, shrinks to 28px over lifetime
- Fill: Radial gradient from `#E9B213` center to `#C49210` edge
- Outer Ring: 2px `rgba(233, 178, 19, 0.5)`
- Inner Dot: 8px white circle at center
- Glow: Soft gold bloom `rgba(233, 178, 19, 0.3)`, radius 16px
- Spawn: Scale 0→1.2→1.0, 150ms bounce
- Idle: Breathing scale 1.0→1.05→1.0, 800ms loop; shrinks linearly over lifetime

**Target (Urgent — <30% lifetime remaining)**
- Fill: Gradient shifts to `#E74C3C` red
- Glow: Red bloom `rgba(231, 76, 60, 0.4)`
- Animation: Fast pulse 1.0→1.1→1.0, 300ms loop

**Hit Feedback**
- Shape: Expanding ring burst at tap position
- Size: 0→120px
- Fill: None
- Stroke: White 3px → fading to 0 opacity
- Particles: 8 gold sparkle dots scatter outward, 300ms
- Duration: 300ms

**Miss Feedback**
- Shape: Target flashes red
- Fill: `#E74C3C`
- Animation: Scale 1.0→0.5→0, 200ms, while turning red
- Particles: 4 red fragments scatter downward

**Score Display**
- Shape: Text block, top-center
- Score Value: White, 36px, font-weight 900
- Score Label: `#E9B213` gold, "PTS", 12px
- Position: Top-center

**Reaction Score Popup**
- Shape: Floating text at tap position
- Text: "+87 PTS" in `#E9B213` gold, 16px, font-weight 900
- Spawn: At tap coordinates
- Animation: Floats upward 40px, fades to 0, 600ms

**Miss Counter**
- Shape: Row of 5 circles
- Size: 10px each, gap 6px
- Fill (unused): `rgba(255, 255, 255, 0.15)`
- Fill (used/miss): `#E74C3C` red
- Position: Top-right
- Animation: When a miss occurs, next dot fills red with pulse

**Round Badge**
- Shape: Pill
- Fill: `rgba(255, 255, 255, 0.08)`
- Text: `#E9B213` "ROUND 3", 10px
- Position: Top-left

### Screen Flow

1. **Start:** Dark screen, gold target illustration, "QUICK TAP" title, play button
2. **Ready:** 3-2-1-GO countdown in gold
3. **In-game:** Targets spawning at random positions, score counter, miss dots; increasing chaos
4. **Perfect hit (fast):** Large ring burst + "+95" gold popup + brief screen glow
5. **Miss:** Target goes red and implodes, miss dot fills red
6. **5th miss:** All remaining targets implode, "GAME OVER" overlay with score + XP

### Difficulty Scaling

- Round 1: Spawn every 1.5s, lifetime 3s
- Each round: Spawn rate −100ms (min 400ms), lifetime −200ms (min 800ms)
- Multiple simultaneous targets at higher rounds

### XP Formula

`Math.floor(score × 0.5)`

---

## GAME 05 — HEX RUNNER

**Status:** ✅ BUILT  
**Category:** Action  
**Difficulty:** Hard  
**XP Multiplier:** ×1.5  
**Renderer:** Canvas 2D  
**File:** `src/games/runner/RunnerGame.tsx`

### How to Play

Endless side-scrolling runner. A hexagonal character runs automatically left to right. Tap anywhere to jump; tap mid-air for double jump. Rectangular obstacles of varying heights scroll from right to left. Speed increases over time. Distance traveled = score. One hit = game over.

### Gameplay Loop

Character runs → obstacles approach from right → player taps to jump → clear obstacle → distance increments → speed increases → collision = game over.

### Visual Elements

**Background**
- Shape: Full canvas
- Size: 380 × 480px
- Fill: Gradient from `#0C1020` top to `#0C0A06` bottom
- Stars: 30–50 tiny dots, 1–2px, `rgba(255, 255, 255, 0.04–0.15)`, 3 parallax layers scrolling at 0.2×, 0.5×, 1× speed

**Ground Line**
- Shape: Horizontal strip
- Size: Full width × 2px
- Fill: `rgba(233, 178, 19, 0.3)` gold
- Position: Bottom 80px from canvas floor

**Player Character**
- Shape: Hexagon (6-sided polygon)
- Size: 28 × 24px
- Fill: `#E9B213` gold
- Glow: `rgba(233, 178, 19, 0.3)` shadow, radius 6px
- Spawn: Fade in + slide from left, 400ms
- Idle (running): Vertical bob ±3px, 300ms sine loop
- Jump: Parabolic arc, physics: GRAVITY = 0.6, JUMP_FORCE = -13
- Double jump: Second arc from air, brief gold spark burst at jump point
- Death: Red flash full screen 200ms, character spins and falls off-screen

**Obstacle**
- Shape: Rectangle
- Size: Width 30–50px, height 40–120px (varied)
- Fill: `#1F2348` navy
- Stroke: `#2E3565` secondary navy, 1px
- Spawn: Appears at right edge of canvas
- Idle: Scrolls left at current game speed
- Destroy: N/A (scrolls off-screen left)

**Distance Counter**
- Shape: Text
- Text: White, 20px, font-weight 900, "m" suffix in `#7B82A8`
- Position: Top-right
- Animation: Number increments smoothly

**Speed Indicator**
- Shape: Thin vertical bar, left edge
- Size: 4px × variable height
- Fill: `#E9B213` gold, height grows with speed
- Max height: Canvas height

**Death Collision**
- Effect: Full screen red flash `rgba(231, 76, 60, 0.4)`, 200ms
- Character: Rotates 360° while falling downward off-screen, 500ms

### Screen Flow

1. **Start:** Character on ground, "TAP TO BEGIN" floating text in gold, parallax stars scrolling slowly
2. **Running:** Player moves, obstacles scroll, parallax speeds up, distance counter climbing
3. **Jump:** Hex character arcs upward, shadow stays on ground line, gold trail
4. **Collision:** Red screen flash → character spins off → dark overlay → score card: distance + high score + XP + play again

### Difficulty Scaling

- Starting speed: 4 px/frame
- Speed formula: `min(10, 4 + distance/200)`
- Obstacle gap decreases as speed increases
- Obstacle height variation increases

### XP Formula

`Math.floor(distance)` — 1 XP per meter

---

## GAME 06 — MEMORY MATRIX

**Status:** 🔲 TO BUILD  
**Category:** Brain Training  
**Difficulty:** Medium  
**XP Multiplier:** ×1.1

### How to Play

A 4×4 grid (expanding to 6×6 at higher levels). A random subset of cells light up gold for 1.5 seconds. Then all cells go dark. The player must tap exactly the cells that were lit, from memory. Correct taps turn green. Wrong taps turn red and shake. Each level adds one more lit cell to memorize.

### Gameplay Loop

Grid appears → subset lights up gold (1.5s) → all go dark → player taps from memory → correct/wrong feedback per tap → all correct = level up (+1 cell) → too many mistakes = game over.

### Visual Elements

**Grid Cell (Idle)**
- Shape: Square, rounded 8px
- Size: 56 × 56px, gap 4px
- Fill: `rgba(255, 255, 255, 0.06)`
- Stroke: `rgba(255, 255, 255, 0.1)` 1px
- Idle: Static

**Grid Cell (Lit — Memorize Phase)**
- Shape: Same
- Fill: `#E9B213` gold
- Glow: `rgba(233, 178, 19, 0.6)` shadow, radius 12px
- Spawn: Fade in 0→1, 100ms
- Idle: Gentle pulse brightness ±10%, 600ms

**Grid Cell (Player Tap — Correct)**
- Fill: `rgba(39, 174, 96, 0.8)` green
- Stroke: `#27AE60` 2px
- Animation: Scale 1.0→1.15→1.0, 200ms bounce
- Particles: 4 green sparkles, 200ms

**Grid Cell (Player Tap — Wrong)**
- Fill: `rgba(231, 76, 60, 0.8)` red
- Stroke: `#E74C3C` 2px
- Animation: Shake horizontal ±6px, 200ms, 3 cycles
- Effect: Brief red vignette around grid edges

**Phase Label**
- Shape: Text, top-center
- Memorize Phase: "MEMORIZE" in `#E9B213` gold, 18px, font-weight 900, with eye icon
- Recall Phase: "RECALL" in white, 18px, font-weight 900, with brain icon
- Transition: Crossfade 300ms

**Level Indicator**
- Shape: Pill badge
- Fill: `rgba(255, 255, 255, 0.08)`
- Text: `#E9B213` "LEVEL 4", 11px, font-weight 900
- Position: Top-right

**Countdown Ring**
- Shape: Circular arc around entire grid
- Size: Circumscribes grid
- Stroke: `#E9B213` gold, 3px
- Animation: Arc depletes clockwise from 360°→0° over recall time limit
- Danger: Color shifts to `#E74C3C` when <25% remaining

### Screen Flow

1. **Level start:** Grid cells appear dark, "LEVEL N" badge, "MEMORIZE" label
2. **Memorize (1.5s):** Random cells light up gold simultaneously, pulsing glow
3. **Transition:** All cells fade to dark over 200ms, label changes to "RECALL"
4. **Recall:** Player taps cells — instant green (correct) or red+shake (wrong) per tap
5. **Level clear:** All correct cells cascade green pulse, "LEVEL UP" gold banner, grid expands if applicable
6. **Fail:** 3+ wrong taps → "GAME OVER" overlay with level reached + score + XP

### Difficulty Scaling

- Level 1: 4×4 grid, 3 lit cells, 8s recall time
- Each level: +1 lit cell
- Level 5+: 5×5 grid
- Level 9+: 6×6 grid
- Recall time: max(4, 10 − level×0.5) seconds

---

## GAME 07 — COLOR STROOP

**Status:** 🔲 TO BUILD  
**Category:** Brain Training  
**Difficulty:** Medium  
**XP Multiplier:** ×1.0

### How to Play

A color word appears on screen ("RED", "BLUE", "GREEN", "YELLOW", "PURPLE") printed in an ink color that may differ from the word's meaning. The player must tap the button matching the **ink color**, not the word. Speed matters — a reaction bar depletes for each question. Wrong answers lose a life. 3 lives total. 30 questions per game.

### Gameplay Loop

Word appears in colored ink → player identifies ink color (not word meaning) → taps matching color button → correct/wrong feedback → next word → 30 questions or 0 lives = game over.

### Visual Elements

**Word Display**
- Shape: Large centered text
- Size: 52px, font-weight 900, letter-spacing 4px
- Fill: The INK color (one of 5: red `#E74C3C`, blue `#3498DB`, green `#2ECC71`, yellow `#F1C40F`, purple `#9B59B6`)
- Position: Upper-center, 35% from top
- Spawn: Scale 0→1.1→1.0, 200ms bounce per new word
- Idle: Static

**Color Buttons (5 total)**
- Shape: Rounded rectangles arranged in 2 rows (3 top, 2 bottom centered)
- Size: 90 × 56px, border-radius 14px
- Fill: Each filled with its respective color (red, blue, green, yellow, purple)
- Text: Color name in white, 14px, font-weight 900
- Idle: Subtle depth shadow
- Press: Scale 0.95, 100ms
- Correct: Green ring pulse outward, 300ms + gold "+N" popup
- Wrong: Red shake ±4px, 200ms + lost life heart animation

**Reaction Timer Bar**
- Shape: Horizontal bar below the word
- Size: 280px × 6px
- Fill: `#E9B213` gold → `#E74C3C` red as it depletes
- Animation: Shrinks left-to-right over 3 seconds per question
- If expires: Auto-wrong, loses a life

**Streak Counter**
- Shape: Badge, top-right
- Text: "×7 STREAK" in `#E9B213` gold, 12px, font-weight 900
- Spawn: Appears after 3+ correct in a row
- Animation: Scale bounce on increment
- Destroy: Fades if streak breaks

**Lives**
- Shape: 3 heart icons in a row
- Size: 18px each, gap 4px
- Fill (active): `#E74C3C` red
- Fill (lost): `rgba(255, 255, 255, 0.1)` ghost
- Position: Top-left
- Loss animation: Heart breaks apart into 2 halves falling, 300ms

**Question Counter**
- Shape: Text
- Text: "12 / 30" in `#7B82A8` muted, 11px
- Position: Top-center

### Screen Flow

1. **Start:** "COLOR STROOP" title, example showing mismatched word/color, "Tap the INK color!" instruction, play button
2. **In-game:** Word appears center, 5 color buttons below, timer bar depleting, streak counter if active
3. **Correct:** Button pulses green ring, gold "+N" floats up, next word bounces in
4. **Wrong:** Button shakes red, heart breaks, streak resets
5. **30 questions done or 0 lives:** Score summary — accuracy %, best streak, total score, XP earned

---

## GAME 08 — DUAL N-BACK

**Status:** 🔲 TO BUILD  
**Category:** Brain Training  
**Difficulty:** Hard  
**XP Multiplier:** ×1.8

### How to Play

Working memory trainer. A 3×3 grid shows one cell lighting up per round (position stimulus). Simultaneously, a letter is displayed (audio stimulus). The player must determine: does the current POSITION match what was shown N steps ago? Does the current LETTER match N steps ago? Two independent yes/no buttons. Starts at N=2 (compare to 2 rounds back). After 20 trials, accuracy determines whether N increases or decreases.

### Gameplay Loop

Stimulus pair shown (position + letter) for 500ms → player decides within 2s: press "Position Match" and/or "Letter Match" or neither → feedback → next stimulus → after 20 trials, N adjusts based on accuracy.

### Visual Elements

**3×3 Grid**
- Shape: 3 columns × 3 rows of squares
- Size: Each cell 80 × 80px, gap 8px, total ~256px
- Fill (idle): `rgba(255, 255, 255, 0.06)`
- Stroke: `rgba(255, 255, 255, 0.08)` 1px
- Border-radius: 12px per cell
- Position: Center-upper third of screen

**Grid Cell (Active/Lit)**
- Fill: `#E9B213` gold
- Glow: `rgba(233, 178, 19, 0.5)` shadow, radius 16px
- Spawn: Fade in 0→1, 150ms
- Duration: 500ms
- Destroy: Fade out 1→0, 150ms

**Letter Display**
- Shape: Single large letter below grid
- Size: 64px, font-weight 900
- Fill: White
- Position: Centered below grid, 24px gap
- Spawn: Fade in 0→1, 150ms, simultaneous with cell light
- Duration: 500ms
- Destroy: Fade out 150ms

**"Position Match" Button**
- Shape: Wide pill button
- Size: 160 × 52px, border-radius 26px
- Fill: `#3498DB` blue
- Text: "POSITION" white, 14px, font-weight 900
- Icon: Grid icon left-aligned
- Position: Bottom-left area
- Press: Scale 0.95, blue glow
- Correct: Green outline pulse
- Wrong: Red shake

**"Letter Match" Button**
- Shape: Same pill
- Size: Same
- Fill: `#9B59B6` purple
- Text: "LETTER" white, 14px, font-weight 900
- Icon: "A" icon left-aligned
- Position: Bottom-right area
- Press: Scale 0.95, purple glow
- Correct: Green outline pulse
- Wrong: Red shake

**N-Level Badge**
- Shape: Hexagon badge
- Size: 44px
- Fill: `#E9B213` gold
- Text: "N=2" in `#1F2348`, 14px, font-weight 900
- Position: Top-center
- Level up: Pulse scale 1.0→1.3→1.0, gold burst particles

**Trial Counter**
- Shape: Progress bar + text
- Size: 200px × 4px
- Fill: `#E9B213` gold, width = (trial/20) × 100%
- Text: "Trial 12/20" in `#7B82A8`, 10px
- Position: Below N-level badge

### Screen Flow

1. **Start:** "DUAL N-BACK" title, brain icon, explanation of N-back concept, difficulty selector (N=2 default)
2. **Ready:** 3-2-1 countdown
3. **In-game:** Grid shows, cell lights + letter appears for 500ms, then 2s to respond
4. **Feedback:** Correct matches glow green, missed matches flash red indicator
5. **20 trials done:** Accuracy card: position accuracy %, letter accuracy %, overall %, N adjustment (+1 if >80%, stays if 50–80%, −1 if <50%), XP earned

---

## GAME 09 — NUMBER FLOW

**Status:** 🔲 TO BUILD  
**Category:** Brain Training  
**Difficulty:** Medium  
**XP Multiplier:** ×1.2

### How to Play

Mental arithmetic chains. An equation appears: "17 + 8 = ?" with 4 answer options. Tap the correct answer before the countdown bar depletes (3s per question). If correct, the answer becomes part of the next equation ("25 − 9 = ?"). The chain continues — streak multiplier grows. Wrong answer or timeout breaks the chain. Game lasts 60 seconds total.

### Gameplay Loop

Equation appears → 4 answer buttons → player taps → correct: chain continues, multiplier grows → wrong: chain breaks, multiplier resets → 60 seconds total.

### Visual Elements

**Equation Display**
- Shape: Centered text block
- Numbers: White, 48px, font-weight 900
- Operator: `#E9B213` gold, 40px, font-weight 900
- "= ?": `#7B82A8` muted, 40px
- Position: Upper-center, 30% from top
- Spawn: Slide in from right, 200ms
- Exit: Slide out left, 150ms (on answer)

**Answer Buttons (4)**
- Shape: Rounded rectangles in 2×2 grid
- Size: 140 × 64px, border-radius 16px, gap 12px
- Fill: `rgba(255, 255, 255, 0.08)`
- Stroke: `rgba(255, 255, 255, 0.1)` 1px
- Text: White, 24px, font-weight 900
- Position: Center-lower area
- Press: Scale 0.95
- Correct: Fill transitions to `#27AE60` green, 200ms + gold "+N" popup
- Wrong: Fill transitions to `#E74C3C` red, shake ±4px + correct answer highlights green

**Countdown Bar**
- Shape: Thin horizontal bar below equation
- Size: 280px × 4px
- Fill: `#E9B213` gold → `#E74C3C` red as it depletes
- Animation: Width 100%→0% over 3 seconds per question
- Position: Below equation

**Chain Counter**
- Shape: Badge with flame icon
- Text: "CHAIN ×5" in `#E9B213` gold, 14px, font-weight 900
- Position: Top-right
- Spawn: Appears at ×2
- Grow: Scale bounce on each increment
- Glow: Gold glow intensifies with higher chains
- Break: Red shatter, text resets to "×1"

**Game Timer**
- Shape: Circular arc, top-left corner
- Stroke: `#E9B213` gold, 3px
- Animation: 360°→0° over 60 seconds
- Inner text: "42s" white, 14px, font-weight 900

**Chain Break Effect**
- Trigger: Wrong answer or timeout
- Effect: Full-screen red tint `rgba(231, 76, 60, 0.15)`, 300ms
- Chain counter: Shatters into fragments, resets to ×1

### Screen Flow

1. **Start:** "NUMBER FLOW" title, math symbols floating, play button
2. **Ready:** 3-2-1-GO
3. **In-game:** Equation top, 4 buttons center, timer top-left, chain top-right
4. **Correct:** Green button + score popup + equation slides to next
5. **Wrong/timeout:** Red flash, correct answer reveals, chain breaks, next equation
6. **60s elapsed:** Final score with chain stats, longest chain, accuracy %, XP

---

## GAME 10 — PATTERN SYNC

**Status:** 🔲 TO BUILD  
**Category:** Brain Training  
**Difficulty:** Easy  
**XP Multiplier:** ×0.9

### How to Play

A horizontal row of 3–7 colored shapes (circles and squares in 5 colors) appears for 2 seconds. It vanishes. The same row reappears with one item replaced by a "?" placeholder. The player selects the correct shape+color from 4 options to fill the blank.

### Gameplay Loop

Sequence shown (2s) → sequence reappears with one "?" → 4 options shown → player picks correct one → correct = sequence grows by 1 → 3 wrong answers total = game over.

### Visual Elements

**Sequence Row**
- Shape: Horizontal row of shapes
- Size: 3–7 items, each 48px, gap 8px, centered horizontally
- Position: Upper-center, 30% from top

**Sequence Item (Circle)**
- Shape: Circle
- Size: 48px diameter
- Fill: One of 5 colors: red `#E74C3C`, blue `#3498DB`, green `#2ECC71`, yellow `#F1C40F`, purple `#9B59B6`
- Stroke: 2px slightly darker shade of fill color
- Spawn: Scale 0→1, staggered 80ms per item

**Sequence Item (Square)**
- Shape: Rounded square, border-radius 8px
- Size: 44 × 44px
- Fill: Same 5 colors
- Stroke: Same

**Missing Item Slot ("?")**
- Shape: Dashed border circle or square (matching the shape that was there)
- Size: 48px
- Stroke: White dashed 2px
- Fill: `rgba(255, 255, 255, 0.04)`
- Inner text: "?" in white, 24px
- Animation: Gentle pulse scale 1.0→1.05→1.0, 800ms

**Answer Options (4)**
- Shape: Row of 4 items matching possible shapes+colors
- Size: 52px each, gap 12px
- Fill: Same 5-color palette, circle or square shapes
- Position: Bottom-center area
- Press: Scale 0.9
- Correct: Gold ring burst + item flies to fill blank slot, 300ms
- Wrong: Red shake + item fades 50% opacity

**Show-Phase Timer**
- Shape: Pulsing gold border around sequence row
- Stroke: `#E9B213` 2px, glow `rgba(233, 178, 19, 0.4)`
- Animation: Pulse opacity 0.6→1.0→0.6, 1s loop
- Label: "MEMORIZE" above in gold, 11px

**Level Progress Bar**
- Shape: Horizontal bar
- Size: 200px × 4px
- Fill: `#E9B213` gold
- Position: Top of screen
- Grows: Each correct answer adds progress

**Lives**
- Shape: 3 diamond icons
- Fill (active): `#E9B213` gold
- Fill (lost): `rgba(255, 255, 255, 0.1)`
- Position: Top-right

### Screen Flow

1. **Show (2s):** Full sequence visible, gold pulsing border, "MEMORIZE" label
2. **Hide + Recall:** Sequence reappears with "?" blank + 4 answer options below
3. **Correct:** Answer flies to fill blank, gold burst, sequence extends by 1 for next round
4. **Wrong:** Red shake, life lost, same length sequence for next round
5. **3 lives lost:** Game over with level reached, patterns completed, XP

---

## GAME 11 — FOCUS GRID

**Status:** 🔲 TO BUILD  
**Category:** Brain Training  
**Difficulty:** Easy  
**XP Multiplier:** ×0.8

### How to Play

A 5×5 grid of identical-looking symbols fills the screen. One cell contains a subtly different symbol (different rotation, size, or shade). The player must tap the odd one out as fast as possible. Faster taps = more points. Differences become subtler each level. 5 rounds per game, timer per round.

### Visual Elements

**Grid Cell (Normal)**
- Shape: Square, rounded 6px
- Size: 60 × 60px, gap 4px
- Fill: `rgba(255, 255, 255, 0.05)`
- Symbol: SVG shape centered (arrow, circle, hexagon, triangle, or cross)
- Symbol color: `rgba(255, 255, 255, 0.3)`
- Symbol size: 28px

**Grid Cell (Odd One)**
- Shape: Same
- Fill: Same
- Symbol: Same type but rotated 90°, OR 80% size, OR opacity 0.15 instead of 0.3
- Difference becomes subtler each level

**Correct Tap (Found It)**
- Shape: Circle ring expands from tapped cell
- Fill: None
- Stroke: `#27AE60` green, 3px
- Size: 0→120px
- Text: "FOUND IT!" gold, 18px, font-weight 900, floats up
- Particles: 6 gold sparkles

**Wrong Tap**
- Cell: Red tint 200ms, shake ±3px
- Penalty: −1 second on timer

**Reaction Score Popup**
- Text: "+150 PTS" in `#E9B213` gold, 14px
- Animation: Floats up 30px, fades out, 500ms

**Timer**
- Shape: Text, top-right
- Text: White, 20px, font-weight 900
- Turns red when <3s remaining, pulses

**Level/Round Badge**
- Text: "ROUND 3/5" in `#E9B213`, 11px, font-weight 900
- Position: Top-left

### Screen Flow

1. **Grid appears:** 25 cells with identical symbols, one odd cell hidden among them
2. **Timer ticking:** 10s per round
3. **Player scans and taps:** Correct = green ring + score popup → next round; Wrong = red shake + time penalty
4. **5 rounds:** Final score = sum of reaction bonuses, XP

---

## GAME 12 — SPEED SORT

**Status:** 🔲 TO BUILD  
**Category:** Brain Training  
**Difficulty:** Easy  
**XP Multiplier:** ×0.9

### How to Play

An item (colored shape) appears at the top of screen and falls slowly. Two labeled buckets sit at the bottom-left and bottom-right. The player swipes left or right to sort the item into the correct bucket based on the current rule (e.g., "CIRCLES → LEFT, SQUARES → RIGHT" or "WARM COLORS → LEFT, COOL COLORS → RIGHT"). Sorting rules change every 10 items. 3 lives.

### Visual Elements

**Falling Item**
- Shape: Circle (50px) or Square (46px, rounded 6px)
- Fill: One of 6 colors (red, blue, green, yellow, orange, purple)
- Spawn: Top-center, scale 0→1, 200ms
- Idle: Falls slowly ~1px/frame
- Swipe left: Arcs to left bucket, 300ms
- Swipe right: Arcs to right bucket, 300ms

**Left Bucket**
- Shape: Rounded rectangle with label
- Size: 130 × 80px, border-radius 16px
- Fill: `rgba(52, 152, 219, 0.2)` blue tint
- Stroke: `#3498DB` 2px
- Label: Current rule label (e.g., "CIRCLES"), white, 12px, font-weight 900
- Position: Bottom-left
- Correct receive: Green flash fill, 200ms
- Wrong receive: Red shake

**Right Bucket**
- Shape: Same
- Fill: `rgba(233, 178, 19, 0.2)` gold tint
- Stroke: `#E9B213` 2px
- Label: Other rule label (e.g., "SQUARES")
- Position: Bottom-right

**Swipe Arrow Hint (first 3 items only)**
- Shape: Animated arrow pointing left/right
- Fill: `rgba(255, 255, 255, 0.3)`
- Animation: Slides in swipe direction, loops, fades after first 3 correct sorts

**Speed Multiplier**
- Shape: Badge, center-top
- Text: "×2.5" in `#E9B213` gold, 18px, font-weight 900
- Glow: Intensifies with higher multiplier
- Break: Red shatter, resets

**Lives**
- Shape: 3 heart icons
- Fill (active): `#E74C3C` red
- Fill (lost): `rgba(255, 255, 255, 0.1)`
- Position: Top-right

**Rule Change Banner**
- Shape: Full-width strip
- Fill: `#E9B213` gold
- Text: "NEW RULE!" `#1F2348`, 16px, font-weight 900
- Duration: 1.5s, slides down then up
- New rules shown below in white

### Screen Flow

1. **Start:** Rules displayed — "CIRCLES LEFT / SQUARES RIGHT", animated example
2. **In-game:** Item falls, player swipes, feedback per sort
3. **Every 10 items:** "NEW RULE!" banner, categories change
4. **3 lives lost:** Game over with items sorted, accuracy, longest streak, XP

---

## GAME 13 — WORD FLUX

**Status:** 🔲 TO BUILD  
**Category:** Brain Training  
**Difficulty:** Medium  
**XP Multiplier:** ×1.0

### How to Play

A 5×5 grid of random letters. The player draws a path through adjacent cells (including diagonal) to spell words of 3+ letters. Valid English words score points; longer words score more. Used letters disappear and new ones fall in from the top. Game timer: 90 seconds.

### Visual Elements

**Letter Grid**
- Shape: 5×5 grid of square cells
- Size: Each cell 58 × 58px, gap 4px
- Cell fill: `rgba(255, 255, 255, 0.07)`
- Cell border-radius: 8px
- Letter: White, 20px, font-weight 900, centered

**Cell (Selected — Drawing Path)**
- Fill: `rgba(233, 178, 19, 0.4)`
- Stroke: `#E9B213` gold, 2px
- Scale: 1.05

**Path Line**
- Shape: Line connecting cell centers
- Stroke: `#E9B213` gold, 3px
- Style: Smooth bezier between cells

**Valid Word Glow**
- All cells in path: Bright gold fill pulse, 400ms
- Particles: Gold sparkles along path

**Invalid Word**
- All cells in path: Red tint `rgba(231, 76, 60, 0.3)`, 200ms
- Path line: Turns red, then all resets

**Current Word Display**
- Shape: Text above grid
- Letters: `#E9B213` gold, 28px, font-weight 900
- Position: Above grid, centered
- Updates: Each new cell adds a letter with slide-in animation

**Letter Fall (New Letters)**
- Shape: Same cell
- Animation: Translate Y from above grid to target position, 200ms ease-out, staggered 30ms

**Timer**
- Shape: Circular arc surrounding grid
- Stroke: `#E9B213` gold, 3px
- Animation: Depletes over 90 seconds
- Danger: Red when <15s

**Word Score Popup**
- Text: "+150 FLUX!" in `#E9B213`, 16px
- Animation: Float up + fade, 600ms
- Scale: Bigger popup for longer words

### Screen Flow

1. **Grid:** 25 random letters, timer ring full
2. **Draw path:** Finger draws through adjacent cells, letters appear above
3. **Lift finger:** Word validated — green glow + score popup (valid) or red shake (invalid)
4. **Valid word:** Letters disappear, new ones fall in
5. **90s elapsed:** Final score, words found, longest word, XP

---

## GAME 14 — SNAKE PATH

**Status:** 🔲 TO BUILD  
**Category:** Classic Arcade  
**Difficulty:** Easy  
**XP Multiplier:** ×0.9

### How to Play

Classic Snake on canvas. Snake moves automatically in one direction. Tap left or right arrow buttons (or swipe) to turn 90°. Eat glowing food pellets to grow longer and score points. The snake gets faster as it grows. Hit a wall or your own tail = game over.

### Visual Elements

**Snake Head**
- Shape: Square, rounded 4px
- Size: 18 × 18px
- Fill: `#E9B213` gold
- Glow: `rgba(233, 178, 19, 0.4)` shadow
- Eyes: Two 3px white dots facing direction of movement

**Snake Body**
- Shape: Chain of 18px squares
- Fill: Gradient from `#E9B213` (near head) → `#C49210` → `rgba(233, 178, 19, 0.4)` (tail end)
- Each segment: Slightly separated by 1px gap
- Movement: Smooth segment-by-segment follow

**Food Pellet**
- Shape: Circle
- Size: 12px diameter
- Fill: `#2ECC71` green
- Glow: `rgba(39, 174, 96, 0.5)` shadow, radius 8px
- Idle: Pulse scale 1.0→1.2→1.0, 800ms loop
- Eat: Burst into 6 green sparkles + "+10" score popup

**Grid Lines**
- Shape: Full canvas grid
- Stroke: `rgba(255, 255, 255, 0.04)`, 1px
- Spacing: 20px

**Wall**
- Shape: Canvas border
- Stroke: `rgba(255, 255, 255, 0.1)`, 2px

**Turn Buttons**
- Shape: Two large semi-circle buttons at bottom
- Size: Each 50% width × 80px
- Fill: `rgba(255, 255, 255, 0.08)`
- Icon: Left arrow / Right arrow, white, 24px
- Press: Scale 0.95 + darker fill

**Death Animation**
- Snake body flashes red 3 times (100ms on/off)
- Then body segments separate and drift apart, 500ms
- Screen: Brief red vignette

### Screen Flow

1. **Start:** 3-segment snake at center, food pellet somewhere on grid
2. **In-game:** Snake moves, player turns, food eaten = grow + score + new food
3. **Collision:** Death animation → game over card with score + length + XP

---

## GAME 15 — SPACE RAID

**Status:** 🔲 TO BUILD  
**Category:** Classic Arcade  
**Difficulty:** Medium  
**XP Multiplier:** ×1.1

### How to Play

Vertical shoot-em-up. Player ship at the bottom, drag to move. Auto-fires upward. Enemy ships descend in formation from the top. Enemies shoot projectiles down. Clear all enemies in a wave to advance. Power-ups drop from destroyed enemies.

### Visual Elements

**Star Field Background**
- 50+ dots, 1–3px, white
- 3 parallax layers scrolling downward at 0.3×, 0.6×, 1× speed
- Canvas background: `#000818`

**Player Ship**
- Shape: Isosceles triangle pointing up with wing details
- Size: 28px wide × 32px tall
- Fill: `#E9B213` gold
- Engine glow: Elongated teardrop below ship, `rgba(233, 178, 19, 0.6)`, flickering
- Move: Follows finger drag, 1:1, clamped to canvas
- Death: Explosion burst (see below), spin + scale down

**Enemy Ship (Type A — Common)**
- Shape: Inverted triangle with small wing fins
- Size: 24px wide × 20px tall
- Fill: `#E74C3C` red
- Eyes: Two 3px `#FF6B6B` dots
- Formation: Grid 5–8 wide, 2–4 rows, weaving left-right

**Enemy Ship (Type B — Elite)**
- Shape: Diamond with wing extensions
- Size: 28px
- Fill: `#9B59B6` purple
- Glow: Purple bloom
- Takes 2 hits (1st hit: flashes white)

**Player Bullet**
- Shape: Thin tall rectangle
- Size: 3 × 12px
- Fill: `#E9B213` gold
- Trail: 3 fading copies behind, 200ms
- Speed: 8px/frame upward

**Enemy Bullet**
- Shape: Circle
- Size: 6px
- Fill: `#E74C3C` red
- Trail: Red fading, 3 copies
- Speed: 3px/frame downward

**Explosion**
- Shape: Hexagonal burst expanding outward
- Colors: Orange `#FF9800` + yellow `#FFEB3B` + white center
- Particles: 8–12 fragments scatter, 400ms
- Screen shake: 2px, 100ms (for player hit)

**Power-Up**
- Shape: Hexagon, 16px, falls slowly
- Types:
  - Gold hex: Double fire rate, 5s
  - Green hex: Shield (absorbs 1 hit)
  - Blue hex: Screen-clear bomb

**Wave Counter**
- Text: "WAVE 3" in `#E9B213`, 12px, font-weight 900
- Position: Top-right

**Lives**
- Shape: 3 small ship icons
- Fill: `#E9B213`
- Position: Top-left

### Screen Flow

1. **Start:** Ship centered at bottom, star field scrolling, "SPACE RAID" title
2. **In-game:** Enemies descend in formation, bullets fly, explosions, power-ups fall
3. **Wave clear:** "WAVE CLEAR" gold banner, 1s pause, next wave spawns
4. **3 lives lost:** Final score, waves cleared, enemies destroyed, XP

---

## GAME 16 — BREAKWALL

**Status:** 🔲 TO BUILD  
**Category:** Classic Arcade  
**Difficulty:** Easy  
**XP Multiplier:** ×0.9

### How to Play

Classic Breakout. A paddle at the bottom deflects a bouncing ball upward. Rows of colored bricks fill the top area. The ball bounces off walls, the paddle, and bricks. Each brick hit destroys it. Some bricks require 2 hits. Power-ups drop from certain bricks. Clear all bricks to win. 3 lives.

### Visual Elements

**Paddle**
- Shape: Rounded rectangle
- Size: 80 × 12px, border-radius 6px
- Fill: `#E9B213` gold
- Position: Bottom 60px from canvas floor, follows finger drag horizontally
- Glow: `rgba(233, 178, 19, 0.3)` subtle shadow

**Ball**
- Shape: Circle
- Size: 10px diameter
- Fill: White
- Glow: `rgba(255, 255, 255, 0.4)`, radius 4px
- Trail: 5 fading circles behind, each 1px smaller, `rgba(233, 178, 19, 0.3)`

**Brick (1-Hit)**
- Shape: Rectangle
- Size: 40 × 16px, border-radius 3px
- Fill: Row-based gradient colors from top to bottom:
  - Row 1: `#E74C3C` red
  - Row 2: `#FF9800` orange
  - Row 3: `#F1C40F` yellow
  - Row 4: `#2ECC71` green
  - Row 5: `#3498DB` blue
- Destroy: Shatters into 4–6 polygon fragments in brick color, scatter outward, 300ms

**Brick (2-Hit)**
- Shape: Same
- Fill: Same base color, brighter
- First hit: Crack lines appear across surface, color desaturates 30%
- Second hit: Same shatter animation

**Power-Up (Drops from Destroyed Brick)**
- Shape: Hexagon, 16px, falls slowly (2px/frame)
- Gold hex: Paddle widens to 120px for 8s
- Green hex: Multi-ball (ball splits into 3)
- Blue hex: Ball slows down for 5s
- Catch: Touches paddle → power-up applies + gold burst

**Score**
- Text: White, 24px, font-weight 900
- Position: Top-center

**Lives**
- Shape: 3 circle icons
- Fill: White
- Position: Top-right

### Screen Flow

1. **Start:** Brick wall (5 rows × 10 cols), paddle, ball on paddle ready to launch
2. **Launch:** Tap to release ball upward
3. **In-game:** Ball bounces, bricks shatter, power-ups fall
4. **Ball lost:** Brief red flash, life lost, ball respawns on paddle
5. **All bricks cleared:** "LEVEL CLEAR" gold banner, next level loads with different brick layout
6. **3 lives lost:** Game over with bricks destroyed, levels cleared, XP

---

## GAME 17 — PAC MAZE

**Status:** 🔲 TO BUILD  
**Category:** Classic Arcade  
**Difficulty:** Medium  
**XP Multiplier:** ×1.0

### How to Play

Simplified Pac-Man. Player moves a circular character through a maze eating dots. 4 ghost enemies patrol corridors. Power pellets (large dots) make ghosts edible for 8 seconds. Eat all dots to complete the level. Contact with a normal ghost loses a life.

### Visual Elements

**Player Character**
- Shape: Circle with wedge "mouth" opening/closing
- Size: 24px diameter
- Fill: `#E9B213` gold
- Mouth: Animates open/close 10°→45°→10°, 200ms loop
- Direction: Rotates to face movement direction

**Maze Walls**
- Shape: Rectangle segments forming corridors
- Fill: `#2E3565` navy
- Stroke: `#4A5585` lighter navy, 1px inner edge
- Corner joins: Rounded 4px

**Dot**
- Shape: Circle
- Size: 4px
- Fill: `#E9B213` gold
- Eat: Pop + disappear, "+10" micro-popup

**Power Pellet**
- Shape: Circle
- Size: 10px
- Fill: `#E9B213` gold
- Glow: `rgba(233, 178, 19, 0.5)` bloom
- Idle: Pulse scale 1.0→1.4→1.0, 600ms

**Ghost (Normal)**
- Shape: Rounded top half-circle + wavy bottom edge
- Size: 22px
- Fill: 4 colors: red `#E74C3C`, pink `#FF69B4`, cyan `#00BCD4`, orange `#FF9800`
- Eyes: 2 white ovals with blue pupils tracking player direction
- Movement: Smooth tile-to-tile

**Ghost (Frightened)**
- Shape: Same
- Fill: `#1A237E` dark blue, flashing
- Eyes: Simple wavy mouth, no pupils
- Duration: 8 seconds after power pellet
- Warning: Flashes blue/white alternating last 2 seconds

**Ghost (Eaten)**
- Shape: Eyes only (2 white ovals + blue pupils)
- Movement: Floats back to ghost house

### Screen Flow

1. **Start:** Full maze with dots, 4 ghosts in center "ghost house", player at bottom
2. **In-game:** D-pad or swipe controls, player eats dots, ghosts patrol
3. **Power pellet eaten:** Ghosts turn blue, player can eat them for bonus
4. **All dots cleared:** "LEVEL CLEAR", next level with faster ghosts
5. **3 lives lost:** Game over with dots eaten, ghosts eaten, levels, XP

---

## GAME 18 — ASTEROID FIELD

**Status:** 🔲 TO BUILD  
**Category:** Classic Arcade  
**Difficulty:** Medium  
**XP Multiplier:** ×1.1

### How to Play

Classic Asteroids. Player ship floats in 2D space. Tap left/right edges to rotate, hold center-bottom to thrust, tap top to fire. Asteroids drift across screen. Shooting a large asteroid splits it into 2 medium; medium into 2 small; small are destroyed. Screen wraps on all edges. Clear all asteroids to advance.

### Visual Elements

**Player Ship**
- Shape: Thin triangle outline (vector style)
- Size: 28px tall
- Stroke: `#E9B213` gold, 2px
- Fill: None (wireframe style)
- Thrust flame: Short cone at rear, `rgba(233, 178, 19, 0.8)`, visible only while thrusting
- Death: Lines scatter outward from center, 500ms

**Large Asteroid**
- Shape: Irregular 8-sided polygon (randomized vertices)
- Size: 60–80px
- Stroke: `rgba(255, 255, 255, 0.6)`, 2px
- Fill: None
- Rotation: Slow continuous rotation, 0.5–2 deg/frame
- Split: Two medium asteroids fly outward at 45° angles

**Medium Asteroid**
- Shape: Irregular 6-sided polygon
- Size: 30–40px
- Stroke: `rgba(255, 255, 255, 0.5)`, 1.5px
- Rotation: 1–3 deg/frame

**Small Asteroid**
- Shape: Irregular 5-sided polygon
- Size: 14–18px
- Stroke: `rgba(255, 255, 255, 0.4)`, 1px
- Destroy: Lines break apart + fade, 300ms

**Bullet**
- Shape: Small line
- Size: 8px
- Stroke: White, 2px
- Speed: 10px/frame
- Lifetime: 40 frames then disappears

**Stars Background**
- 80+ dots, 1–2px, white at various opacities
- Static or very slowly drifting
- Canvas: `#000818`

### Screen Flow

1. **Start:** Ship center, 4–6 large asteroids drifting from edges
2. **In-game:** Rotate, thrust, shoot, wrap around edges
3. **Asteroid destroyed:** Split animation or debris particles
4. **All cleared:** "WAVE CLEAR", new set spawns (more + faster)
5. **Death:** Ship explodes → game over with asteroids destroyed, waves, XP

---

## GAME 19 — FROG CROSS

**Status:** 🔲 TO BUILD  
**Category:** Classic Arcade  
**Difficulty:** Easy  
**XP Multiplier:** ×0.8

### How to Play

Classic Frogger. Move a frog from bottom to top. Cross a multi-lane road (dodge cars) then a river (hop on logs; miss = drown). Reach one of 5 lily pad slots at the top. Fill all 5 slots to complete the level.

### Visual Elements

**Frog**
- Shape: Rounded square with limbs suggestion
- Size: 24 × 24px
- Fill: `#27AE60` green
- Eyes: 2 white dots, 3px
- Jump: Hop arc animation, 150ms
- Death (car): Red flash + flatten animation
- Death (water): Blue ripple circles expanding, frog disappears

**Road Lanes**
- Shape: Horizontal bands
- Fill: `#2A2A2A` dark gray
- Lane markings: Dashed white lines between lanes

**Cars**
- Shape: Rectangles with rounded ends
- Size: 60–100px wide × 20px tall
- Fill: Various: red, yellow, blue, white
- Speed: Different per lane, alternating directions

**River**
- Shape: Horizontal band
- Fill: `#0A1A3A` dark blue, subtle wave animation

**Logs**
- Shape: Rounded rectangles
- Size: 80–140px × 20px
- Fill: `#6D4C41` brown
- Texture: Subtle grain lines
- Movement: Scrolls horizontally, frog rides on top

**Lily Pads (Destinations)**
- Shape: Circle
- Size: 28px
- Fill: `#2ECC71` green
- Idle: Empty, pulsing glow
- Filled: Frog icon, solid green

**D-Pad Controls**
- Shape: 4 arrow buttons in cross layout
- Size: 48px each
- Fill: `rgba(255, 255, 255, 0.08)`
- Position: Bottom-center overlay

### Screen Flow

1. **Start:** Frog at bottom, road + river + lily pads visible
2. **In-game:** D-pad to hop, dodge cars, ride logs
3. **Reach lily pad:** Frog locks in, green burst, respawn at bottom
4. **All 5 filled:** "LEVEL CLEAR", faster traffic/current
5. **3 lives lost:** Game over with frogs saved, levels, XP

---

## GAME 20 — PONG DUEL

**Status:** 🔲 TO BUILD  
**Category:** Classic Arcade  
**Difficulty:** Easy  
**XP Multiplier:** ×1.0

### How to Play

Classic Pong. Player controls the bottom paddle (drag). AI controls the top paddle. Ball bounces between paddles. Miss the ball = opponent scores. First to 7 wins. Ball accelerates with each rally hit.

### Visual Elements

**Player Paddle**
- Shape: Rounded rectangle
- Size: 80 × 10px, border-radius 5px
- Fill: `#E9B213` gold
- Position: Bottom, 50px from edge
- Move: Follows finger drag horizontally

**AI Paddle**
- Shape: Same
- Fill: `rgba(255, 255, 255, 0.5)` white semi-transparent
- Position: Top, 50px from edge
- AI: Follows ball X with slight delay/imperfection

**Ball**
- Shape: Square (retro style)
- Size: 10 × 10px
- Fill: White
- Trail: 4 fading squares behind, each slightly dimmer
- Speed: Starts 4px/frame, increases 0.3px per rally hit

**Center Line**
- Shape: Dashed horizontal line
- Stroke: `rgba(255, 255, 255, 0.15)`, dashes 8px gap 8px

**Score (Player)**
- Text: White, 36px, font-weight 900
- Position: Bottom-center, below paddle

**Score (AI)**
- Text: `rgba(255, 255, 255, 0.5)`, 36px
- Position: Top-center, above paddle

**Hit Effect**
- White ring burst at ball-paddle contact point, 200ms

**Score Point Effect**
- Scoring side flashes white across entire half, 200ms
- Ball resets to center

### Screen Flow

1. **Start:** Both paddles, ball at center, scores 0-0
2. **Serve:** Ball launches at random angle from center
3. **Rally:** Ball bounces, speed increases, paddles track
4. **Point scored:** Side flash, score updates, ball resets
5. **7 points:** "YOU WIN" (gold fireworks) or "YOU LOSE" (red), final stats + XP

---

## GAME 21 — GRAVITY SWITCH

**Status:** 🔲 TO BUILD  
**Category:** Action  
**Difficulty:** Hard  
**XP Multiplier:** ×1.6

### How to Play

Auto-runner through a horizontal corridor. Player character runs along the floor. Tap anywhere to flip gravity — character transitions to the ceiling. Spikes on both floor and ceiling create gaps the player must thread through. Distance = score. Speed increases over time.

### Visual Elements

**Player Character**
- Shape: Hexagon
- Size: 22px
- Fill: `#E9B213` gold
- Glow: `rgba(233, 178, 19, 0.3)`
- Gravity-down: Positioned on floor surface
- Gravity-up: Positioned on ceiling surface, flipped
- Flip animation: 180° vertical arc between floor↔ceiling, 150ms ease-in-out
- Trail: 3 fading hex copies behind, gold at decreasing opacity

**Floor/Ceiling**
- Shape: Solid horizontal bands
- Size: Full width × 20px
- Fill: `#2E3565` navy

**Spikes (Floor)**
- Shape: Upward-pointing triangles
- Size: 12px wide × 16px tall
- Fill: `#E74C3C` red
- Glow: `rgba(231, 76, 60, 0.3)` subtle

**Spikes (Ceiling)**
- Shape: Downward-pointing triangles
- Same styling

**Corridor (Open Space)**
- Fill: `#0C0A06`
- Decoration: Sparse stars scrolling right-to-left, `rgba(255, 255, 255, 0.03)`
- Subtle hex pattern overlay: `rgba(255, 255, 255, 0.02)`

**Death Effect**
- Character: Shatters into 6 hexagonal fragments scattering outward, 400ms
- Screen: Red flash 200ms
- Particles: 8 red sparkles

**Distance Counter**
- Text: White, 20px, font-weight 900
- Position: Top-right

### Screen Flow

1. **Start:** Character on floor, corridor stretching ahead, "TAP TO FLIP GRAVITY"
2. **In-game:** Spikes alternate floor/ceiling, player taps to flip, distance climbs
3. **Flip:** Smooth arc animation between surfaces
4. **Collision:** Hex shatters → red flash → game over with distance + XP

---

## GAME 22 — NEON BLADE

**Status:** 🔲 TO BUILD  
**Category:** Action  
**Difficulty:** Medium  
**XP Multiplier:** ×1.2

### How to Play

Fruit Ninja style. Objects drift onto screen from the edges. Player swipes to slice them. Unsliced objects that exit the screen lose a life. Bombs appear among objects — slicing a bomb = instant game over. Combos (multiple items in one swipe) give bonus points.

### Visual Elements

**Normal Object (Hexagon)**
- Shape: Hexagon, rotating slowly
- Size: 40–60px
- Fill: Random from: gold `#E9B213`, cyan `#00E5FF`, magenta `#FF4D9D`, green `#2ECC71`
- Spawn: Tosses in from edge with arc trajectory (gravity)
- Idle: Rotates 1–3 deg/frame while airborne

**Normal Object (Orb)**
- Shape: Circle
- Size: 36–50px
- Fill: Same colors
- Glow: Matching color bloom

**Bomb**
- Shape: Circle with "!" icon
- Size: 44px
- Fill: `#1A1A1A` black
- Stripe: Red band around equator `#E74C3C`
- Label: "!" red, 20px, font-weight 900
- Glow: Red bloom `rgba(231, 76, 60, 0.3)`

**Slice Trail**
- Shape: Arc line following finger touch-drag
- Stroke: Gradient white → `#E9B213` gold
- Width: 3px → 1px taper
- Duration: Fades over 300ms

**Slice Effect**
- Object splits into 2 halves along slice angle
- Both halves: Fly outward in opposite directions, 400ms, with gravity
- Color splash: 6–8 particles in object color burst from cut point

**Bomb Explosion**
- Full screen red flash `rgba(231, 76, 60, 0.5)`, 300ms
- Shockwave circle expanding outward from bomb, 400ms
- Instant game over

**Combo Counter**
- Text: "×3 COMBO" in `#E9B213`, 18px, font-weight 900
- Position: Center screen
- Animation: Scale bounce 1.0→1.3→1.0 on increment

**Lives**
- Shape: 3 blade/diamond icons
- Fill (active): `#E9B213` gold
- Fill (lost): `rgba(255, 255, 255, 0.1)`
- Position: Top-right

### Screen Flow

1. **Start:** "NEON BLADE" title, animated blade slash across screen, play button
2. **In-game:** Objects toss in from edges, player swipes to slice, combos build
3. **Missed object:** Red "-1" text, life icon dims
4. **Bomb sliced:** Red explosion → instant game over
5. **3 misses:** Game over with objects sliced, best combo, XP

---

## GAME 23 — DODGE STORM

**Status:** 🔲 TO BUILD  
**Category:** Action  
**Difficulty:** Hard  
**XP Multiplier:** ×1.5

### How to Play

Bullet-hell survival. Player's hexagonal character sits in an open arena. Drag to move. Projectiles spawn from all edges and converge inward. Survive as long as possible. Power-ups drop periodically (invincibility shield, slow-motion).

### Visual Elements

**Player**
- Shape: Hexagon
- Size: 28px
- Fill: `#E9B213` gold
- Glow: Pulsing `rgba(233, 178, 19, 0.4)` bloom
- Move: Follows finger drag, smooth
- Hit: Red flash, ±4px shake, -1 life
- Invincible: Flashing white-gold, 2s duration

**Bullet (Small)**
- Shape: Circle
- Size: 8px
- Fill: `#E74C3C` red
- Trail: 3 fading red dots behind
- Speed: 2–4px/frame toward center

**Missile (Medium)**
- Shape: Elongated diamond / arrow
- Size: 20px long
- Fill: `#E67E22` orange
- Trail: Orange fading streak
- Speed: 1.5–3px/frame, slight homing

**Laser (Warning)**
- Shape: Thin line extending from edge to edge
- Stroke: `rgba(0, 229, 255, 0.3)` cyan, 1px
- Warning: Pulses for 1s before firing
- Active: Full brightness cyan `#00E5FF`, 3px, 300ms duration
- Player must not be in its path when it fires

**Power-Up (Invincibility)**
- Shape: Star, 20px
- Fill: `#E9B213` gold with sparkle animation
- Falls: Slowly from top

**Power-Up (Slow-Mo)**
- Shape: Clock icon, 20px
- Fill: `#3498DB` blue with glow
- Effect: All projectiles slow to 30% speed for 3s

**Invincibility Ring**
- Shape: Circle around player
- Stroke: `#3498DB` blue, 2px, pulsing
- Shrinks as duration ends

**Survival Timer**
- Text: "14.2s" white, 24px, font-weight 900
- Position: Top-center

**Lives**
- Shape: 3 hexagon icons
- Fill: `#E9B213` gold (active), `rgba(255, 255, 255, 0.1)` (lost)
- Position: Top-right

### Screen Flow

1. **Start:** Player center, empty arena, "SURVIVE" text
2. **In-game:** Projectiles from all edges, density increasing, player dodging
3. **Power-up:** Falls from top, player collects by touching
4. **Hit:** Flash, shake, life lost
5. **3 lives lost:** Survival time shown, projectiles dodged, XP

---

## GAME 24 — TOWER STACK

**Status:** 🔲 TO BUILD  
**Category:** Action  
**Difficulty:** Easy  
**XP Multiplier:** ×0.9

### How to Play

A block swings left-right on a pendulum above a growing tower. Tap to drop it. If aligned with the block below, it stacks perfectly (full score). If it overhangs, the excess is cut off — the block gets narrower. Perfect stacks keep the full width. Game ends when the block becomes too narrow or misses entirely.

### Visual Elements

**Moving Block (Current)**
- Shape: Rectangle
- Size: Starts at 200px wide × 24px tall
- Fill: Gradient `#E9B213` → `#C49210`
- Movement: Oscillates left-right, 3px/frame
- Shadow: Projected down onto tower top

**Stacked Block (Previous Blocks)**
- Shape: Rectangle, width matches landing accuracy
- Fill: Gradient gold, progressively more desaturated toward bottom
- Stack: Grows upward, camera scrolls up

**Cut Fragment**
- Shape: Rectangle (the overhang portion)
- Fill: Same as block
- Animation: Falls off screen with gravity + slight rotation, 600ms

**Perfect Landing**
- Effect: White flash across landing zone, 200ms
- Text: "PERFECT!" in `#E9B213`, 24px, scale bounce
- Particles: Gold sparkles, 8 particles
- Benefit: Block stays full width

**Height Counter**
- Text: "34" in white, 20px, font-weight 900, "m" suffix in `#7B82A8`
- Position: Right edge, vertical orientation

**Danger Indicator**
- When block width < 30px: Red tint on moving block, warning pulse
- Text: "CAREFUL!" red, 12px, top-center

### Screen Flow

1. **Start:** First block (full width) on ground, next block swinging above
2. **Tap:** Block drops straight down, lands
3. **Perfect:** Flash + "PERFECT!" + full-width next block
4. **Overhang:** Cut piece falls, next block is narrower
5. **Miss completely or block too narrow:** Tower crumbles animation → game over with height + perfects + XP

---

## GAME 25 — MERGE HEX

**Status:** 🔲 TO BUILD  
**Category:** Puzzle  
**Difficulty:** Medium  
**XP Multiplier:** ×1.2

### How to Play

2048 on a hexagonal grid. Tiles contain powers of 2 (2, 4, 8, 16…). Swipe in 6 directions to slide all tiles. Equal tiles that collide merge and double. A new tile (2 or 4) spawns after each move. Reach 4096 to win. No valid moves = game over.

### Visual Elements

**Hex Cell (Empty)**
- Shape: Hexagon, flat-top orientation
- Size: 48px point-to-point
- Fill: `rgba(255, 255, 255, 0.04)`
- Stroke: `rgba(255, 255, 255, 0.08)` 1px
- Grid: 6×6 offset hexagonal pattern (honeycomb)

**Tile Values & Colors**
- 2: Fill `rgba(255, 255, 255, 0.08)`, text `#7B82A8`
- 4: Fill `rgba(233, 178, 19, 0.15)`, text `#E9B213`
- 8: Fill `rgba(233, 178, 19, 0.3)`, text `#E9B213`
- 16: Fill `rgba(233, 178, 19, 0.5)`, text white
- 32: Fill `rgba(233, 178, 19, 0.7)`, text white
- 64: Fill `#E9B213`, text `#1F2348`
- 128: Fill `#E9B213`, white glow, text `#1F2348`
- 256: Fill `#C49210`, text white
- 512: Fill `#E74C3C`, text white
- 1024: Fill white, text `#1F2348`
- 2048: Fill `#E9B213` with rainbow pulse, text `#1F2348`
- 4096: Fill white with gold particles orbiting, text `#1F2348`

**Tile Number**
- Font-weight: 900
- Size: Scales down for larger numbers (48→36→28→24px)
- Centered in hex

**Merge Animation**
- Both tiles slide into merge cell
- Merged tile: Scale 1.0→1.2→1.0, 200ms bounce
- Score popup: "+N" in gold above merged tile

**New Tile Spawn**
- Scale 0→1.0, 200ms with bounce
- Brief glow pulse

**Swipe Direction Hints**
- 6 faint arrows at grid edges showing valid swipe angles
- Fill: `rgba(255, 255, 255, 0.1)`

### Screen Flow

1. **Start:** Hex grid with 2 random low-value tiles
2. **Swipe:** Tiles slide, merge, new tile spawns
3. **4096 reached:** "YOU WIN!" gold celebration with hex particle burst
4. **No moves:** "GAME OVER" with score, highest tile, XP

---

## GAME 26 — COLOR PATH

**Status:** 🔲 TO BUILD  
**Category:** Puzzle  
**Difficulty:** Easy  
**XP Multiplier:** ×0.9

### How to Play

A grid (5×5 to 8×8) contains pairs of colored dots. Draw paths connecting each matching pair. Paths cannot cross. Every cell must be covered (no empty cells). Flow-style puzzle game.

### Visual Elements

**Grid Cell (Empty)**
- Shape: Square
- Size: 52 × 52px, gap 3px
- Fill: `rgba(255, 255, 255, 0.04)`

**Dot Endpoint**
- Shape: Circle centered in cell
- Size: 32px diameter
- Fill: 6 colors: red `#E74C3C`, blue `#3498DB`, green `#2ECC71`, yellow `#F1C40F`, orange `#FF9800`, purple `#9B59B6`
- Glow: Matching color at 30% opacity

**Drawn Path**
- Shape: Filled rectangle segments connecting cell centers
- Fill: Same color as endpoint pair, 60% opacity
- Width: 80% of cell width
- Corner: Rounded connectors where path turns

**Complete Path (Both Endpoints Connected)**
- Fill: Full opacity color
- Glow: Subtle matching bloom

**All Cells Filled**
- Effect: White flash across entire grid, 200ms
- Text: "SOLVED!" in `#E9B213`, 28px, scale bounce
- Particles: Gold burst from grid center

**Crossing Attempt**
- Both conflicting paths: Flash red 200ms
- Action: Blocked, cannot place

**Solution Progress Bar**
- Shape: Horizontal bar at bottom
- Fill: `#E9B213` gold, proportional to cells filled

### Screen Flow

1. **Start:** Grid with colored dot pairs at fixed positions, all cells empty
2. **Draw:** Player drags from dot through cells, path fills behind finger
3. **Connect:** Both dots linked = path solidifies
4. **Redraw:** Tap a path to erase it, try different route
5. **All filled:** "SOLVED!" celebration, next puzzle loads

---

## GAME 27 — SHIFT BLOCKS

**Status:** 🔲 TO BUILD  
**Category:** Puzzle  
**Difficulty:** Medium  
**XP Multiplier:** ×1.1

### How to Play

Sokoban puzzle. Player character pushes (never pulls) colored blocks onto matching colored target squares. Think ahead — blocks can get trapped against walls. D-pad or swipe controls. Minimum moves = better score.

### Visual Elements

**Player**
- Shape: Circle
- Size: 32px
- Fill: `#E9B213` gold
- Glow: `rgba(233, 178, 19, 0.3)`
- Move: Smooth slide between cells, 150ms

**Floor Cell**
- Shape: Square
- Size: 44 × 44px
- Fill: `rgba(255, 255, 255, 0.04)`

**Wall**
- Shape: Square
- Size: 44 × 44px
- Fill: `#2E3565` navy
- Stroke: `#1F2348` darker navy, 1px

**Block**
- Shape: Square, slightly smaller than cell (40 × 40px), rounded 6px
- Fill: 4 colors: red `#E74C3C`, blue `#3498DB`, green `#2ECC71`, yellow `#F1C40F`
- Push animation: Smooth slide, 150ms ease

**Target Square**
- Shape: Square with dashed border
- Size: 44 × 44px
- Stroke: Matching block color, dashed 2px
- Fill: Matching color at 5% opacity

**Block on Target**
- Fill: Same solid color + small white checkmark overlay
- Glow: Matching color bloom

**All Solved**
- Celebration: Hexagonal burst animation from center
- Text: "SOLVED!" in `#E9B213`

**D-Pad**
- Shape: 4 directional buttons in cross layout
- Size: 48px each, gap 4px
- Fill: `rgba(255, 255, 255, 0.08)`
- Arrows: White, 18px
- Position: Bottom-center

**Move Counter**
- Text: "42 MOVES" white, 14px
- Position: Top-right

**Best Score**
- Text: "BEST: 38" in `#E9B213`, 12px
- Position: Top-left (shown if level was previously completed)

### Screen Flow

1. **Start:** Grid with walls, player, colored blocks, colored target squares
2. **Move:** D-pad to walk, push blocks
3. **Block on target:** Solid fill + checkmark
4. **All blocks matched:** Celebration + next level + move count evaluation
5. **Stuck (optional restart):** Undo last move or reset level

---

## GAME 28 — HEX FLOW

**Status:** 🔲 TO BUILD  
**Category:** Puzzle  
**Difficulty:** Medium  
**XP Multiplier:** ×1.0

### How to Play

Hexagonal pipe puzzle. Each hex cell contains a pipe segment (straight, elbow, or T-junction). Source and sink cells are fixed. Tap cells to rotate their pipe 60° at a time. Connect a continuous pipe path from source to sink. Advanced levels have multiple source-sink pairs.

### Visual Elements

**Hex Cell**
- Shape: Hexagon, flat-top
- Size: 52px
- Fill: `rgba(255, 255, 255, 0.04)`
- Stroke: `rgba(255, 255, 255, 0.06)` 1px

**Pipe Segment (Straight — Disconnected)**
- Shape: Two lines meeting at center, extending to 2 hex edges
- Stroke: `rgba(255, 255, 255, 0.3)`, 8px wide, rounded caps

**Pipe Segment (Elbow — Disconnected)**
- Shape: L-shaped, connecting 2 adjacent hex edges
- Stroke: Same

**Pipe Segment (T-Junction — Disconnected)**
- Shape: T-shape, connecting 3 hex edges
- Stroke: Same

**Pipe (Connected / Energized)**
- Same shape as disconnected version
- Stroke: `#E9B213` gold, 8px
- Glow: `rgba(233, 178, 19, 0.4)` bloom
- Animation: Liquid-flow animation (gold pulse traveling through pipe)

**Source Cell**
- Shape: Hex with filled circle at center + arrow pointing outward
- Fill: `#E9B213` gold
- Glow: Gold bloom

**Sink Cell**
- Shape: Hex with circle + inward arrow
- Stroke: `#E9B213` dashed 2px
- Fill: `rgba(233, 178, 19, 0.1)`

**Rotation Animation**
- Cell content rotates 60° clockwise per tap
- Duration: 200ms ease
- Sound-visual: Click/snap feel

**Full Connection**
- Entire connected path lights up gold simultaneously
- Gold liquid-flow animation travels from source through all pipes to sink
- Duration: 800ms
- Text: "CONNECTED!" in gold

### Screen Flow

1. **Start:** Hex grid with randomly rotated pipes, source and sink marked
2. **Tap cells:** Pipes rotate 60° each tap
3. **Connection made:** Pipes light up gold, liquid flows
4. **All connections solved:** "SOLVED!" celebration
5. **Levels progress:** More pipes, more source-sink pairs, irregular grid shapes

---

## GAME 29 — LIGHT BOUNCE

**Status:** 🔲 TO BUILD  
**Category:** Puzzle  
**Difficulty:** Hard  
**XP Multiplier:** ×1.4

### How to Play

A grid contains a laser emitter, crystal targets, walls, and empty cells. The player drags mirrors from a sidebar and places them on empty cells. Mirrors reflect the laser beam 90°. The goal: bounce the laser so it hits every crystal. Fewer mirrors used = better star rating. The laser beam renders in real-time as mirrors are placed/moved.

### Visual Elements

**Laser Emitter**
- Shape: Square cell with arrow indicating beam direction
- Fill: `rgba(0, 229, 255, 0.2)` cyan tint
- Arrow: White, 16px, pointing beam direction
- Glow: `rgba(0, 229, 255, 0.3)`

**Crystal Target (Inactive)**
- Shape: Diamond/rhombus
- Size: 28px
- Fill: `rgba(155, 89, 182, 0.4)` purple
- Glow: `rgba(155, 89, 182, 0.2)`
- Idle: Slow rotation 0.5 deg/frame, gentle pulse

**Crystal Target (Hit by Beam)**
- Fill: `#9B59B6` full bright purple
- Glow: `rgba(155, 89, 182, 0.6)` strong bloom
- Particles: Purple sparkles orbiting crystal
- Animation: Scale pulse 1.0→1.1→1.0, 600ms

**Mirror ( / diagonal)**
- Shape: Diagonal line in cell, 45° from bottom-left to top-right
- Stroke: White, 2px
- Fill: None
- Reflection surface: Subtle white highlight on reflective side

**Mirror ( \ diagonal)**
- Shape: Opposite diagonal
- Same styling

**Laser Beam**
- Shape: Thin line, animated
- Stroke: `#00E5FF` cyan, 2px
- Glow: `rgba(0, 229, 255, 0.4)` bloom
- Animation: Slight pulse brightness, particles traveling along beam

**Wall**
- Shape: Square
- Fill: `#1F2348` navy
- Pattern: Diagonal hatching `rgba(255, 255, 255, 0.05)`

**Mirror Sidebar**
- Shape: Vertical strip on right edge or bottom strip
- Fill: `rgba(255, 255, 255, 0.04)`
- Contains: Draggable mirror icons
- Text: "3 LEFT" count

**Star Rating**
- Shape: 3 star icons shown at level end
- Fill: `#E9B213` gold (earned) or `rgba(255, 255, 255, 0.1)` (not earned)
- Criteria: 3 stars = minimum mirrors used, 2 = +1 extra, 1 = +2 extra

### Screen Flow

1. **Start:** Grid visible with emitter, crystals, walls, mirror sidebar
2. **Place mirror:** Drag from sidebar to empty cell, beam updates in real-time
3. **Beam reflects:** Cyan laser visibly bounces off mirrors
4. **Crystal hit:** Purple sparkle activation
5. **All crystals hit:** Full beam path pulses, "SOLVED!" + star rating

---

## GAME 30 — SUM PATH

**Status:** 🔲 TO BUILD  
**Category:** Puzzle  
**Difficulty:** Hard  
**XP Multiplier:** ×1.5

### How to Play

A 5×5 to 7×7 grid where each cell has a number (1–9). A target sum is shown. The player draws a path through adjacent cells (horizontal/vertical only) such that the sum of all numbers on the path equals the target exactly. Multiple valid paths may exist. Longer valid paths = bonus points. Overshooting the target rejects the path.

### Visual Elements

**Grid Cell (Idle)**
- Shape: Square, rounded 6px
- Size: 54 × 54px, gap 3px
- Fill: `rgba(255, 255, 255, 0.06)`
- Number: White, 18px, font-weight 900, centered

**Grid Cell (On Path)**
- Fill: `rgba(233, 178, 19, 0.3)`
- Number: `#E9B213` gold
- Stroke: `#E9B213` 1px

**Grid Cell (Path Start)**
- Fill: `#E9B213` gold
- Number: `#1F2348` navy

**Path Connection Line**
- Shape: Line between adjacent path cell centers
- Stroke: `rgba(233, 178, 19, 0.5)`, 6px, rounded caps

**Running Total**
- Shape: Floating badge near path end
- Text: "= 17" white, 16px, font-weight 900
- Background: `rgba(0, 0, 0, 0.6)`, rounded-full, padding 4px 10px
- Updates: Each new cell adds its number to total with slide animation
- Color: White when under target, `#E9B213` when equal, `#E74C3C` when over

**Target Sum**
- Shape: Large badge, top-center
- Text: "TARGET: 24" in `#E9B213`, 22px, font-weight 900
- Background: `rgba(233, 178, 19, 0.1)`, rounded-full

**Valid Path (Exact Match)**
- All path cells: Transition fill to `rgba(39, 174, 96, 0.4)` green, 300ms
- Text: "CORRECT!" in `#27AE60`, 24px, scale bounce
- Particles: Green sparkles along path
- Score popup: "+N" in gold

**Overshoot**
- All path cells: Flash red `rgba(231, 76, 60, 0.3)`, 200ms
- Running total: Turns red
- Path: Auto-clears after 500ms

**Length Bonus**
- When valid path is longer than minimum:
- Popup: "+200 LENGTH BONUS" in `#E9B213`, 14px

### Screen Flow

1. **Start:** Number grid + "TARGET: 24" prominently shown
2. **Draw path:** Drag through adjacent cells, running total updates
3. **Exact match:** Green celebration + score + new puzzle
4. **Over target:** Red flash, path clears, try again
5. **Timer expires or N puzzles completed:** Final score with puzzles solved, longest path, XP
