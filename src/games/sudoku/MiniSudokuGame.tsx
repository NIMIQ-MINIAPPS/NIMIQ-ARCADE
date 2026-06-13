import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('mini-sudoku')

function generateSudoku4(): { solution: number[][]; puzzle: (number | null)[][]; blanks: number } {
  const base = [
    [1,2,3,4],
    [3,4,1,2],
    [2,1,4,3],
    [4,3,2,1],
  ]
  const perm = [1,2,3,4].sort(() => Math.random() - 0.5)
  const sol = base.map(row => row.map(v => perm[v - 1]))
  const rows = [0,1,2,3].sort(() => Math.random() - 0.5)
  const shuffled = rows.map(r => sol[r])
  const blanks = 6 + Math.floor(Math.random() * 3)
  const puzzle: (number | null)[][] = shuffled.map(r => [...r])
  const positions = Array.from({ length: 16 }, (_, i) => i).sort(() => Math.random() - 0.5)
  for (let i = 0; i < blanks; i++) {
    const pos = positions[i]
    puzzle[Math.floor(pos / 4)][pos % 4] = null
  }
  return { solution: shuffled, puzzle, blanks }
}

export default function MiniSudokuGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [grid, setGrid] = useState<(number | null)[][]>([])
  const [solution, setSolution] = useState<number[][]>([])
  const [fixed, setFixed] = useState<boolean[][]>([])
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null)
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState(120)
  const [won, setWon] = useState(false)

  const scoreRef = useRef(0)
  const levelRef = useRef(1)
  const timerRef = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>>)

  const setupPuzzle = useCallback(() => {
    const { solution: sol, puzzle } = generateSudoku4()
    setSolution(sol)
    setGrid(puzzle.map(r => [...r]))
    setFixed(puzzle.map(r => r.map(v => v !== null)))
    setErrors(new Set())
    setSelectedCell(null)
    const time = Math.max(30, 120 - levelRef.current * 8)
    setTimeLeft(time)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          addXp(Math.floor(scoreRef.current * 0.3))
          setHighScore('mini-sudoku', scoreRef.current)
          setGameOver(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [addXp, setHighScore])

  const start = useCallback(() => {
    scoreRef.current = 0; levelRef.current = 1
    setScore(0); setLevel(1); setGameOver(false); setWon(false); setStarted(true)
    setupPuzzle()
  }, [setupPuzzle])

  const placeNumber = useCallback((num: number) => {
    if (!selectedCell || gameOver) return
    const [r, c] = selectedCell
    if (fixed[r][c]) return

    const newGrid = grid.map(row => [...row])
    newGrid[r][c] = num
    setGrid(newGrid)

    if (num !== solution[r][c]) {
      setErrors(prev => new Set([...prev, `${r},${c}`]))
    } else {
      setErrors(prev => { const n = new Set(prev); n.delete(`${r},${c}`); return n })
      const complete = newGrid.every((row, ri) => row.every((v, ci) => v === solution[ri][ci]))
      if (complete) {
        clearInterval(timerRef.current)
        const pts = 100 + timeLeft * 2 + levelRef.current * 20
        scoreRef.current += pts; setScore(scoreRef.current)
        levelRef.current++; setLevel(levelRef.current)
        setWon(true)
        setTimeout(() => { setWon(false); setupPuzzle() }, 1200)
      }
    }
    setSelectedCell(null)
  }, [selectedCell, grid, solution, fixed, gameOver, timeLeft, setupPuzzle])

  useEffect(() => () => clearInterval(timerRef.current), [])

  const size = 4
  const cellSize = Math.min(72, (320 - 12) / size)
  const best = highScores['mini-sudoku'] ?? 0
  const xp = Math.floor(score * 0.3)

  return (
    <GameShell theme={T} onExit={onExit} hud={[
      { label: 'TIME', value: `${timeLeft}s`, color: timeLeft <= 15 ? T.danger : T.hudText },
      { label: 'LV', value: level },
      { label: 'SCORE', value: score },
    ]}>
      {!started ? <StartOverlay theme={T} onStart={start} /> : (
        <div className="flex flex-col items-center justify-center h-full gap-6">
          {won && (
            <motion.p initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="text-lg font-black tracking-widest" style={{ color: T.success }}>
              SOLVED!
            </motion.p>
          )}

          {/* Grid */}
          <div className="grid gap-1 p-2 rounded-xl" style={{
            gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
            background: T.surface, border: `2px solid ${T.gridLine}`,
          }}>
            {grid.map((row, r) => row.map((val, c) => {
              const isFixed = fixed[r]?.[c]
              const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c
              const isError = errors.has(`${r},${c}`)
              return (
                <motion.button
                  key={`${level}-${r}-${c}`}
                  onClick={() => !isFixed && setSelectedCell([r, c])}
                  whileTap={!isFixed ? { scale: 0.92 } : {}}
                  style={{
                    width: cellSize, height: cellSize,
                    borderRadius: 8,
                    background: isSelected ? `${T.accent}30`
                      : isError ? `${T.danger}20`
                      : isFixed ? T.bg : T.surface,
                    border: isSelected ? `2px solid ${T.accent}`
                      : isError ? `2px solid ${T.danger}`
                      : `1px solid ${T.gridLine}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: cellSize * 0.45,
                    fontWeight: 900,
                    color: isFixed ? T.hudText : isError ? T.danger : T.accent,
                    cursor: isFixed ? 'default' : 'pointer',
                  }}
                >
                  {val ?? ''}
                </motion.button>
              )
            }))}
          </div>

          {/* Number pad */}
          <div className="flex gap-3">
            {[1, 2, 3, 4].map(n => (
              <motion.button
                key={n}
                whileTap={{ scale: 0.9 }}
                onClick={() => placeNumber(n)}
                className="w-14 h-14 rounded-xl font-black text-2xl"
                style={{
                  background: T.surface,
                  color: T.hudText,
                  border: `1px solid ${T.gridLine}`,
                }}
              >{n}</motion.button>
            ))}
          </div>

          {selectedCell && (
            <button onClick={() => {
              const [r, c] = selectedCell
              if (!fixed[r][c]) {
                const newGrid = grid.map(row => [...row])
                newGrid[r][c] = null; setGrid(newGrid)
                setErrors(prev => { const n = new Set(prev); n.delete(`${r},${c}`); return n })
              }
              setSelectedCell(null)
            }}
              className="text-sm font-bold" style={{ color: T.hudMuted }}>
              CLEAR
            </button>
          )}
        </div>
      )}
      {gameOver && (
        <GameOverOverlay theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'LEVEL', value: level }]} title="TIME'S UP" />
      )}
    </GameShell>
  )
}
