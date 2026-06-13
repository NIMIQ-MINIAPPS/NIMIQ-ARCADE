import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('perilous-path')

type Phase = 'memorize' | 'navigate' | 'result'

function genBoard(size: number, mineCount: number) {
  const total = size * size
  const startIdx = 0
  const endIdx = total - 1
  const mines = new Set<number>()
  while (mines.size < mineCount) {
    const idx = Math.floor(Math.random() * total)
    if (idx !== startIdx && idx !== endIdx) mines.add(idx)
  }
  return { size, mines, start: startIdx, end: endIdx }
}

export default function PerilousPathGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [phase, setPhase] = useState<Phase>('memorize')
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [board, setBoard] = useState({ size: 5, mines: new Set<number>(), start: 0, end: 24 })
  const [path, setPath] = useState<number[]>([])
  const [hitMine, setHitMine] = useState<number | null>(null)
  const [lives, setLives] = useState(3)

  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const levelRef = useRef(1)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>>)

  const setupLevel = useCallback((lvl: number) => {
    const size = lvl >= 7 ? 7 : lvl >= 4 ? 6 : 5
    const mineCount = Math.min(2 + lvl, Math.floor(size * size * 0.35))
    const b = genBoard(size, mineCount)
    setBoard(b)
    setPath([b.start])
    setHitMine(null)
    setPhase('memorize')
    const memorizeTime = Math.max(1500, 4000 - lvl * 300)
    timerRef.current = setTimeout(() => setPhase('navigate'), memorizeTime)
  }, [])

  const start = useCallback(() => {
    scoreRef.current = 0; livesRef.current = 3; levelRef.current = 1
    setScore(0); setLives(3); setLevel(1); setGameOver(false); setStarted(true)
    setupLevel(1)
  }, [setupLevel])

  const handleTap = useCallback((idx: number) => {
    if (phase !== 'navigate' || gameOver) return
    const last = path[path.length - 1]
    const { size, mines, end } = board
    const lr = Math.floor(last / size), lc = last % size
    const tr = Math.floor(idx / size), tc = idx % size
    const adjacent = Math.abs(lr - tr) + Math.abs(lc - tc) === 1
    if (!adjacent || path.includes(idx)) return

    if (mines.has(idx)) {
      setHitMine(idx)
      setPath(prev => [...prev, idx])
      livesRef.current--
      setLives(livesRef.current)
      if (livesRef.current <= 0) {
        addXp(Math.floor(scoreRef.current * 0.4))
        setHighScore('perilous-path', scoreRef.current)
        setGameOver(true)
      } else {
        setTimeout(() => setupLevel(levelRef.current), 800)
      }
      return
    }

    const newPath = [...path, idx]
    setPath(newPath)

    if (idx === end) {
      const pts = board.size * 20 + levelRef.current * 10
      scoreRef.current += pts
      setScore(scoreRef.current)
      levelRef.current++
      setLevel(levelRef.current)
      setTimeout(() => setupLevel(levelRef.current), 600)
    }
  }, [phase, path, board, gameOver, setupLevel, addXp, setHighScore])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const cellSize = Math.min(56, (320 - (board.size - 1) * 4) / board.size)
  const best = highScores['perilous-path'] ?? 0
  const xp = Math.floor(score * 0.4)

  return (
    <GameShell theme={T} onExit={onExit} hud={[
      { label: 'LIVES', value: lives, color: lives <= 1 ? T.danger : T.hudText },
      { label: 'LV', value: level },
      { label: 'SCORE', value: score },
    ]}>
      {!started ? <StartOverlay theme={T} onStart={start} /> : (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-[11px] font-bold tracking-[0.2em]" style={{
            color: phase === 'memorize' ? T.accent : T.hudMuted
          }}>
            {phase === 'memorize' ? 'MEMORIZE THE MINES' : 'NAVIGATE A → B'}
          </p>

          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${board.size}, ${cellSize}px)` }}>
            {Array.from({ length: board.size * board.size }).map((_, i) => {
              const isStart = i === board.start
              const isEnd = i === board.end
              const isMine = board.mines.has(i)
              const inPath = path.includes(i)
              const isHit = hitMine === i
              const showMine = phase === 'memorize' && isMine

              let bg = T.surface
              if (isHit) bg = T.danger
              else if (inPath && !isMine) bg = `${T.success}CC`
              else if (showMine) bg = `${T.danger}80`
              else if (isStart || isEnd) bg = `${T.accent}40`

              return (
                <motion.button
                  key={`${level}-${i}`}
                  onClick={() => handleTap(i)}
                  whileTap={phase === 'navigate' ? { scale: 0.9 } : {}}
                  animate={isHit ? { x: [0, -4, 4, -4, 0] } : {}}
                  style={{
                    width: cellSize, height: cellSize, borderRadius: 8,
                    background: bg,
                    border: `1px solid ${T.gridLine}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 900,
                    color: isStart || isEnd ? T.accent : showMine ? T.danger : 'transparent',
                  }}
                >
                  {isStart ? 'A' : isEnd ? 'B' : showMine ? '×' : ''}
                </motion.button>
              )
            })}
          </div>
        </div>
      )}
      {gameOver && (
        <GameOverOverlay theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'LEVEL', value: level }]} />
      )}
    </GameShell>
  )
}
