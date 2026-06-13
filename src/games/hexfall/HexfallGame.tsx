import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('hexfall')
const COLS = 7, ROWS = 10
const COLORS = ['#C0675C', '#5B8DB8', '#5BAA7E', '#C4A24D', '#8B6BAD', '#C48B5A']

type Grid = (string | null)[][]

function createGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => COLORS[Math.floor(Math.random() * COLORS.length)])
  )
}
function findGroup(grid: Grid, r: number, c: number, color: string, visited: Set<string>): [number, number][] {
  const key = `${r},${c}`
  if (visited.has(key) || r < 0 || r >= ROWS || c < 0 || c >= COLS || grid[r][c] !== color) return []
  visited.add(key)
  const group: [number, number][] = [[r, c]]
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) group.push(...findGroup(grid, r+dr, c+dc, color, visited))
  return group
}
function applyGravity(grid: Grid): Grid {
  const g = grid.map(r => [...r])
  for (let c = 0; c < COLS; c++) {
    let bottom = ROWS - 1
    for (let r = ROWS - 1; r >= 0; r--) {
      if (g[r][c] !== null) { g[bottom][c] = g[r][c]; if (bottom !== r) g[r][c] = null; bottom-- }
    }
  }
  return g
}
function fillEmpty(grid: Grid): Grid {
  return grid.map(row => row.map(cell => cell ?? COLORS[Math.floor(Math.random() * COLORS.length)]))
}

export default function HexfallGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [grid, setGrid] = useState<Grid>(createGrid)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [started, setStarted] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [moves, setMoves] = useState(30)
  const [gameOver, setGameOver] = useState(false)

  const handleTap = useCallback((r: number, c: number) => {
    if (!started || gameOver) return
    const color = grid[r][c]
    if (!color) return
    const group = findGroup(grid, r, c, color, new Set())
    if (group.length < 2) return
    const newGrid: Grid = grid.map(row => [...row])
    group.forEach(([gr, gc]) => { newGrid[gr][gc] = null })
    const pts = group.length * 2 * (combo + 1)
    setScore(s => s + pts)
    setCombo(co => co + 1)
    setFlash(`+${pts}`)
    setTimeout(() => setFlash(null), 700)
    const after = fillEmpty(applyGravity(newGrid))
    setGrid(after)
    setMoves(m => {
      const nm = m - 1
      if (nm <= 0) {
        setGameOver(true)
        addXp(Math.floor((score + pts) * 0.3))
        setHighScore('hexfall', score + pts)
      }
      return nm
    })
  }, [grid, started, gameOver, combo, score, addXp, setHighScore])

  const startGame = () => {
    setGrid(createGrid()); setScore(0); setCombo(0); setMoves(30)
    setGameOver(false); setStarted(true)
  }

  const CELL = Math.floor((Math.min(380, window.innerWidth) - 40) / COLS)
  const best = highScores['hexfall'] ?? 0
  const xp = Math.floor(score * 0.3)

  return (
    <GameShell
      theme={T}
      onExit={onExit}
      hud={[
        { label: 'COMBO', value: `×${combo}`, color: combo > 0 ? T.accent : T.hudMuted },
        { label: 'MOVES', value: moves, color: moves <= 5 ? T.danger : T.hudText },
        { label: 'SCORE', value: score },
      ]}
    >
      <div className="flex flex-col items-center justify-center h-full px-4">
        {flash && (
          <motion.div
            initial={{ y: 0, opacity: 1 }} animate={{ y: -40, opacity: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 text-xl font-black z-10 pointer-events-none"
            style={{ color: T.accent }}
          >{flash}</motion.div>
        )}

        <div className="grid rounded-xl overflow-hidden" style={{
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gap: 2,
          background: T.surface, padding: 3,
        }}>
          {grid.map((row, r) => row.map((cell, c) => (
            <motion.div
              key={`${r}-${c}`}
              whileTap={{ scale: 0.88 }}
              onClick={() => handleTap(r, c)}
              style={{
                width: CELL, height: CELL,
                backgroundColor: cell || T.bg,
                borderRadius: 8,
                cursor: 'pointer',
                border: `1px solid ${cell ? cell + '30' : 'transparent'}`,
              }}
            />
          )))}
        </div>
      </div>

      {!started && !gameOver && <StartOverlay theme={T} onStart={startGame} />}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={score} onRestart={startGame} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
        />
      )}
    </GameShell>
  )
}
