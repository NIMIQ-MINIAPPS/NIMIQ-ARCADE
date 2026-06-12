import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { ArrowLeft } from 'lucide-react'

const COLS = 7
const ROWS = 10
const COLORS = ['#4FC3F7', '#FFC107', '#CE93D8', '#81C784', '#F06292', '#FF8A65']

type Grid = (string | null)[][]

function createGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => COLORS[Math.floor(Math.random() * COLORS.length)])
  )
}

function findGroup(grid: Grid, r: number, c: number, color: string, visited: Set<string>): [number, number][] {
  const key = `${r},${c}`
  if (visited.has(key)) return []
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return []
  if (grid[r][c] !== color) return []
  visited.add(key)
  const group: [number, number][] = [[r, c]]
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    group.push(...findGroup(grid, r+dr, c+dc, color, visited))
  }
  return group
}

function applyGravity(grid: Grid): Grid {
  const g = grid.map(r => [...r])
  for (let c = 0; c < COLS; c++) {
    let bottom = ROWS - 1
    for (let r = ROWS - 1; r >= 0; r--) {
      if (g[r][c] !== null) {
        g[bottom][c] = g[r][c]
        if (bottom !== r) g[r][c] = null
        bottom--
      }
    }
  }
  return g
}

function fillEmpty(grid: Grid): Grid {
  return grid.map(row => row.map(cell => cell === null ? COLORS[Math.floor(Math.random() * COLORS.length)] : cell))
}

interface Props { onExit: () => void }

export default function HexfallGame({ onExit }: Props) {
  const { addXp, setHighScore } = useGameStore()
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
    setGrid(createGrid())
    setScore(0)
    setCombo(0)
    setMoves(30)
    setGameOver(false)
    setStarted(true)
  }

  const CELL = Math.floor((Math.min(380, window.innerWidth) - 32) / COLS)

  return (
    <div className="flex flex-col h-full bg-[#080808]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <button onClick={onExit} className="text-[#555]"><ArrowLeft size={20} /></button>
        <h2 className="font-black text-white tracking-widest text-sm">HEX FALL</h2>
        <div className="text-right">
          <p className="text-[10px] text-[#555]">SCORE</p>
          <p className="font-black text-[#FFC107]">{score.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#555]">COMBO</span>
          <span className="font-black text-[#FFC107]">x{combo}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#555]">MOVES</span>
          <span className={`font-black ${moves <= 5 ? 'text-red-400' : 'text-white'}`}>{moves}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative px-4">
        {flash && (
          <motion.div
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -40, opacity: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 text-2xl font-black text-[#FFC107] z-10 pointer-events-none"
          >
            {flash}
          </motion.div>
        )}

        <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gap: 2 }}>
          {grid.map((row, r) => row.map((cell, c) => (
            <motion.div
              key={`${r}-${c}`}
              whileTap={{ scale: 0.85 }}
              onClick={() => handleTap(r, c)}
              style={{
                width: CELL,
                height: CELL,
                backgroundColor: cell || '#111',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            />
          )))}
        </div>

        {!started && !gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-2xl"
          >
            <p className="text-4xl mb-2">🔶</p>
            <h3 className="text-xl font-black text-white mb-1">HEX FALL</h3>
            <p className="text-[12px] text-[#555] mb-6">Tap groups of 2+ same-color blocks</p>
            <button onClick={startGame} className="px-8 py-3 bg-[#FFC107] text-[#080808] font-black rounded-xl glow-yellow">
              START GAME
            </button>
          </motion.div>
        )}

        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-2xl"
          >
            <p className="text-3xl mb-2">🔶</p>
            <h3 className="text-xl font-black text-white mb-1">GAME OVER</h3>
            <p className="text-[#FFC107] font-black text-2xl mb-1">{score.toLocaleString()}</p>
            <p className="text-[12px] text-[#888] mb-6">+{Math.floor(score * 0.3)} XP earned</p>
            <div className="flex gap-3">
              <button onClick={startGame} className="px-6 py-3 bg-[#FFC107] text-[#080808] font-black rounded-xl">
                PLAY AGAIN
              </button>
              <button onClick={onExit} className="px-6 py-3 bg-[#222] text-white font-black rounded-xl">
                EXIT
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
