import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('memory-matrix')

export default function MemoryMatrixGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'memorize' | 'recall' | 'result'>('memorize')
  const [level, setLevel] = useState(1)
  const [gridSize, setGridSize] = useState(4)
  const [litCells, setLitCells] = useState<Set<number>>(new Set())
  const [tapped, setTapped] = useState<Set<number>>(new Set())
  const [wrong, setWrong] = useState<Set<number>>(new Set())
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)
  const wrongCount = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)

  const generateLevel = useCallback((lvl: number) => {
    const size = lvl >= 9 ? 6 : lvl >= 5 ? 5 : 4
    const count = 2 + lvl
    const total = size * size
    const cells = new Set<number>()
    while (cells.size < Math.min(count, total - 1)) cells.add(Math.floor(Math.random() * total))
    setGridSize(size); setLitCells(cells); setTapped(new Set()); setWrong(new Set())
    wrongCount.current = 0; setPhase('memorize')
    timerRef.current = setTimeout(() => setPhase('recall'), 1500)
  }, [])

  const start = useCallback(() => {
    setStarted(true); setGameOver(false); setScore(0); setLevel(1); generateLevel(1)
  }, [generateLevel])

  const handleTap = useCallback((idx: number) => {
    if (phase !== 'recall' || tapped.has(idx) || wrong.has(idx)) return
    if (litCells.has(idx)) {
      const nt = new Set(tapped); nt.add(idx); setTapped(nt)
      if (nt.size === litCells.size) {
        const pts = litCells.size * 50
        setScore(s => s + pts)
        const nl = level + 1; setLevel(nl)
        setTimeout(() => generateLevel(nl), 600)
      }
    } else {
      const nw = new Set(wrong); nw.add(idx); setWrong(nw); wrongCount.current++
      if (wrongCount.current >= 3) {
        setPhase('result')
        addXp(Math.floor(score * 0.4))
        setHighScore('memory-matrix', score)
        setGameOver(true)
      }
    }
  }, [phase, tapped, wrong, litCells, score, level, generateLevel, addXp, setHighScore])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const cellSize = Math.min(56, (320 - (gridSize - 1) * 4) / gridSize)
  const best = highScores['memory-matrix'] ?? 0
  const xp = Math.floor(score * 0.4)

  return (
    <GameShell theme={T} onExit={onExit} hud={[
      { label: phase === 'memorize' ? 'MEMORIZE' : 'RECALL', value: '', color: phase === 'memorize' ? T.accent : T.hudText },
      { label: 'LEVEL', value: level },
      { label: 'SCORE', value: score },
    ]}>
      {!started ? (
        <StartOverlay theme={T} onStart={start} />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)` }}>
            {Array.from({ length: gridSize * gridSize }).map((_, i) => {
              const isLit = litCells.has(i) && phase === 'memorize'
              const isCorrect = tapped.has(i)
              const isWrong = wrong.has(i)
              return (
                <motion.button
                  key={`${level}-${i}`}
                  onClick={() => handleTap(i)}
                  whileTap={phase === 'recall' ? { scale: 0.92 } : {}}
                  animate={isWrong ? { x: [0, -4, 4, -4, 0] } : {}}
                  transition={{ duration: 0.2 }}
                  style={{
                    width: cellSize, height: cellSize, borderRadius: 8,
                    border: isCorrect ? `2px solid ${T.success}` : isWrong ? `2px solid ${T.danger}` : `1px solid ${T.gridLine}`,
                    background: isLit ? T.accent
                      : isCorrect ? `${T.success}CC`
                      : isWrong ? `${T.danger}CC`
                      : T.surface,
                    boxShadow: isLit ? `0 0 14px ${T.accent}80` : 'none',
                  }}
                />
              )
            })}
          </div>
        </div>
      )}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'LEVEL', value: level }]}
        />
      )}
    </GameShell>
  )
}
