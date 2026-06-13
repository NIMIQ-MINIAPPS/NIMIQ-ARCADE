import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('low-pop')

function generateHexes(count: number, maxNum: number) {
  const nums = new Set<number>()
  while (nums.size < count) nums.add(1 + Math.floor(Math.random() * maxNum))
  const sorted = [...nums].sort((a, b) => a - b)
  const positions = sorted.map((num, i) => ({
    id: i,
    num,
    x: 30 + Math.random() * 260,
    y: 30 + Math.random() * 360,
    popped: false,
  }))
  return positions
}

export default function LowPopGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(1)
  const [hexes, setHexes] = useState<ReturnType<typeof generateHexes>>([])
  const [nextIdx, setNextIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [shake, setShake] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const scoreRef = useRef(0)
  const roundRef = useRef(1)
  const timerRef = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const isRunning = useRef(false)

  const startRound = useCallback((r: number) => {
    const count = Math.min(4 + r, 12)
    const maxNum = 10 + r * 5
    setHexes(generateHexes(count, maxNum))
    setNextIdx(0)
  }, [])

  const start = useCallback(() => {
    scoreRef.current = 0; roundRef.current = 1
    setScore(0); setRound(1); setTimeLeft(60); setGameOver(false); setStarted(true)
    isRunning.current = true
    startRound(1)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          isRunning.current = false; clearInterval(timerRef.current)
          addXp(Math.floor(scoreRef.current * 0.4))
          setHighScore('low-pop', scoreRef.current)
          setGameOver(true); return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [startRound, addXp, setHighScore])

  const handleTap = useCallback((idx: number) => {
    if (!isRunning.current || gameOver) return
    if (idx === nextIdx) {
      const pts = 10 * roundRef.current
      scoreRef.current += pts; setScore(scoreRef.current)
      setFlash(`+${pts}`); setTimeout(() => setFlash(null), 500)
      setHexes(prev => prev.map((h, i) => i === idx ? { ...h, popped: true } : h))
      const ni = nextIdx + 1
      setNextIdx(ni)
      if (ni >= hexes.length) {
        roundRef.current++; setRound(roundRef.current)
        setTimeout(() => startRound(roundRef.current), 400)
      }
    } else {
      setShake(true); setTimeout(() => setShake(false), 300)
    }
  }, [nextIdx, hexes, gameOver, startRound])

  useEffect(() => () => { isRunning.current = false; clearInterval(timerRef.current) }, [])

  const best = highScores['low-pop'] ?? 0
  const xp = Math.floor(score * 0.4)

  return (
    <GameShell theme={T} onExit={onExit} hud={[
      { label: 'TIME', value: `${timeLeft}s`, color: timeLeft <= 10 ? T.danger : T.hudText },
      { label: 'ROUND', value: round },
      { label: 'SCORE', value: score },
    ]}>
      {!started ? <StartOverlay theme={T} onStart={start} /> : (
        <div className="relative h-full overflow-hidden">
          {flash && (
            <motion.div initial={{ y: 0, opacity: 1 }} animate={{ y: -30, opacity: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-10 font-black text-sm pointer-events-none"
              style={{ color: T.accent }}>{flash}</motion.div>
          )}

          <AnimatePresence>
            {hexes.map((h, i) => !h.popped && (
              <motion.button
                key={`${round}-${h.id}`}
                initial={{ scale: 0 }} animate={{ scale: 1, ...(shake && i !== nextIdx ? { x: [0, -3, 3, 0] } : {}) }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => handleTap(i)}
                className="absolute flex items-center justify-center"
                style={{ left: h.x, top: h.y, width: 56, height: 56 }}
              >
                <svg viewBox="0 0 60 52" width="56" height="48">
                  <polygon
                    points="30,1 57,14 57,38 30,51 3,38 3,14"
                    fill={i === nextIdx ? T.accent : T.surface}
                    stroke={i === nextIdx ? T.accent : T.gridLine}
                    strokeWidth="1.5"
                  />
                  <text x="30" y="30" textAnchor="middle" dominantBaseline="central"
                    fill={i === nextIdx ? T.accentText : T.hudText}
                    fontWeight="900" fontSize="16">{h.num}</text>
                </svg>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
      {gameOver && (
        <GameOverOverlay theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'ROUNDS', value: round }]} title="TIME'S UP" />
      )}
    </GameShell>
  )
}
