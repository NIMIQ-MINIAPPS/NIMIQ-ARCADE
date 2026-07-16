// Per-game "How to Play" bullets shown once before a game's first play.
// Keyed by the game's id from lib/games.ts.

export const TUTORIALS: Record<string, string[]> = {
  // ── Brain training ──────────────────────────────────────────────────────
  'memory-matrix': [
    'A grid flashes a pattern of lit cells — memorize it.',
    'When it goes dark, tap every cell that was lit.',
    'One wrong tap ends the round. Patterns grow each level.',
  ],
  'lowdown': [
    'A number appears — guess if the next one is HIGHER or LOWER.',
    'Correct guesses build your streak and score.',
    'Answer fast — the timer keeps shrinking.',
  ],
  'dual-n-back': [
    'Each turn shows a letter in one of 9 grid positions.',
    '"N-back" means: does THIS turn match the one from N turns ago?',
    'Tap POSITION if the square matches, LETTER if the letter matches — tap both if both match.',
    'Get it right to raise N (harder); N goes up automatically as you succeed.',
  ],
  'color-stroop': [
    'A color word appears, written in an ink color.',
    'Tap the ink COLOR, not the word you read.',
    'Your brain will want to read the word — resist it.',
  ],
  'number-flow': [
    'Solve the running math chain as fast as you can.',
    'Each correct answer feeds into the next step of the chain.',
    'Combos multiply your score — mistakes break the chain.',
  ],
  'pattern-sync': [
    'A visual sequence plays, then one piece is missing.',
    'Tap the option that correctly completes the pattern.',
    'Sequences get longer and trickier as you go.',
  ],
  'focus-grid': [
    'A grid of near-identical elements appears.',
    'Find and tap the one that\'s subtly different.',
    'The grid shifts and the difference gets harder to spot.',
  ],
  'speed-sort': [
    'Shapes and colors fly in — sort each with a single tap.',
    'Match it to the correct bin before it reaches the edge.',
    'Speed increases the longer you survive.',
  ],
  'word-fresh': [
    'Letters fall from the top — tap them in order to spell a word.',
    'Complete a valid word before the letters pile up to the top.',
    'Pick your language on the start screen.',
  ],
  'low-pop': [
    'Hexagons appear with numbers on them.',
    'Tap them in ascending order, 1 first.',
    'Tapping out of order costs a life.',
  ],
  // ── Classic arcade ───────────────────────────────────────────────────────
  'nimtris': [
    'Move and rotate the falling piece to fill complete rows.',
    'Full rows clear and score points — clearing several at once scores more.',
    'The board fills up and speeds up as you clear lines — don\'t top out.',
  ],
  'hexfall': [
    'Tap any connected group of 2 or more same-colored hexagons to clear them.',
    'Bigger groups score more and drop the blocks above them down.',
    'Clear the board before you run out of moves.',
  ],
  'snake-path': [
    'Drag or swipe to steer the snake toward the food.',
    'Every bite makes you longer — and faster.',
    'Don\'t hit the walls or your own tail.',
  ],
  'galaxy-defender': [
    'Your ship auto-fires — focus on dodging enemy fire.',
    'Move to line up shots and clear each wave of alien ships.',
    'Waves get tougher the further you survive.',
  ],
  'space-raid': [
    'Move to dodge incoming fire while your ship shoots automatically.',
    'Grab power-ups dropped by enemies for a temporary edge.',
    'A boss shows up every few waves — its pattern is tougher, so keep moving.',
  ],
  'breakwall': [
    'Move the paddle to keep the ball in play.',
    'Break every brick to clear the level.',
    'The ball speeds up the longer a level runs, so stay sharp.',
  ],
  'frog-cross': [
    'Move the frog forward, avoiding cars on the road.',
    'Hop onto logs to cross the river safely — don\'t fall in the water.',
    'It\'s endless — the road gets busier the further you go.',
  ],
  'pong-duel': [
    'Move your paddle to return the ball past the AI.',
    'First to the winning score takes the match.',
    'Pick a difficulty on the start screen — higher tiers react faster and predict better.',
  ],
  // ── Action ───────────────────────────────────────────────────────────────
  'runner': [
    'Tap to jump over obstacles as you run automatically.',
    'The further you go, the faster and denser the course gets.',
    'One hit ends the run — score is based on distance.',
  ],
  'quicktap': [
    'Targets pop up briefly across the screen.',
    'Tap each one before it disappears.',
    'Miss too many and it\'s game over — speed ramps up over time.',
  ],
  'gravity-switch': [
    'Tap to flip gravity between the floor and ceiling.',
    'Weave through the spike corridor without touching a wall or spike.',
    'The corridor speeds up the longer you survive.',
  ],
  'neon-blade': [
    'Swipe across incoming objects to slice them.',
    'Slice fruit for points — avoid bombs, they end the run instantly.',
    'Any fruit you let fall costs a life.',
  ],
  'dodge-storm': [
    'Move to dodge waves of incoming projectiles — you have no weapon.',
    'Survive as long as possible; the storm gets denser over time.',
    'One hit costs a life.',
  ],
  'tower-stack': [
    'A block slides back and forth — tap to drop it onto the stack.',
    'Line it up with the block below for a clean stack; overhang gets trimmed off.',
    'Stack as high as you can before you miss.',
  ],
  // ── Puzzle ───────────────────────────────────────────────────────────────
  'memory': [
    'Flip two cards at a time to find matching pairs.',
    'Matched pairs stay face up; mismatches flip back over.',
    'Clear the whole board before time runs out.',
  ],
  'perilous-path': [
    'Study the grid — some tiles are hidden mines.',
    'Once it hides, navigate from start to finish purely from memory.',
    'Hitting a mine ends the run — the grid grows each level.',
  ],
  'mini-sudoku': [
    'Fill the grid so every row, column and box has each number exactly once.',
    'Tap a cell, then tap a number to place it.',
    'Solve it before the clock runs out.',
  ],
  'merge-hex': [
    'Swipe to slide all tiles on the hex grid in one direction.',
    'Matching tiles that collide merge into the next number.',
    'Reach the target tile before the board fills up.',
  ],
  'color-path': [
    'Drag from a colored dot to its matching dot elsewhere on the grid.',
    'Paths can\'t cross each other.',
    'Every color must be connected to unlock the level — you can redraw any pair, even a finished one, until then.',
  ],
  'shift-blocks': [
    'Slide pieces around the board to clear it out.',
    'Plan ahead — pieces only move until they hit a wall or another piece.',
    'Fewer moves means a better score.',
  ],
  'hex-flow': [
    'Tap a pipe tile to rotate it.',
    'Connect every outlet to the source so liquid reaches all of them.',
    'Solve it before time runs out for the level.',
  ],
  'light-bounce': [
    'Place mirrors on the grid to redirect the light beam.',
    'Get the beam to hit every crystal on the board.',
    'Mirrors only reflect at fixed angles — plan the bounce path.',
  ],
  'sum-path': [
    'Trace a continuous path through the grid\'s numbers.',
    'The numbers along your path must add up to the target sum exactly.',
    'You can\'t reuse a cell in the same path.',
  ],
}

const SEEN_KEY = 'nim-arcade-tutorials-seen'

function readSeen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function hasSeenTutorial(gameId: string): boolean {
  return !!readSeen()[gameId]
}

export function markTutorialSeen(gameId: string): void {
  try {
    const seen = readSeen()
    seen[gameId] = true
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  } catch { /* ignore */ }
}
