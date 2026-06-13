import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('memory')
const ICONS = ['◆','●','▲','■','★','◎','⬡','⬢','◇','▼','⊕','⊗']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export default function MemoryGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [round, setRound] = useState(1)
  const [score, setScore] = useState(0)
  const [cards, setCards] = useState<{ icon: string; matched: boolean }[]>([])
  const [flipped, setFlipped] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState(100)
  const locked = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const scoreRef = useRef(0)

  const setupRound = useCallback((r: number) => {
    const pairs = Math.min(3 + r, 12)
    const icons = shuffle(ICONS).slice(0, pairs)
    const deck = shuffle([...icons, ...icons])
    setCards(deck.map(icon => ({ icon, matched: false })))
    setFlipped([])
    locked.current = false
    const time = Math.max(10, 30 - r * 2)
    setTimeLeft(time)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          addXp(Math.floor(scoreRef.current * 0.4))
          setHighScore('memory', scoreRef.current)
          setGameOver(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [addXp, setHighScore])

  const start = useCallback(() => {
    scoreRef.current = 0; setScore(0); setRound(1); setGameOver(false); setStarted(true)
    setupRound(1)
  }, [setupRound])

  const handleFlip = useCallback((idx: number) => {
    if (locked.current || gameOver) return
    if (flipped.includes(idx) || cards[idx].matched) return

    const newFlipped = [...flipped, idx]
    setFlipped(newFlipped)

    if (newFlipped.length === 2) {
      locked.current = true
      const [a, b] = newFlipped
      if (cards[a].icon === cards[b].icon) {
        setTimeout(() => {
          setCards(prev => prev.map((c, i) => i === a || i === b ? { ...c, matched: true } : c))
          const pts = 50
          scoreRef.current += pts
          setScore(scoreRef.current)
          setFlipped([])
          locked.current = false
        }, 250)
      } else {
        setTimeout(() => { setFlipped([]); locked.current = false }, 600)
      }
    }
  }, [flipped, cards, gameOver])

  useEffect(() => {
    if (!started || gameOver) return
    if (cards.length > 0 && cards.every(c => c.matched)) {
      clearInterval(timerRef.current)
      const nextRound = round + 1
      setRound(nextRound)
      setTimeout(() => setupRound(nextRound), 600)
    }
  }, [cards, started, gameOver, round, setupRound])

  useEffect(() => () => clearInterval(timerRef.current), [])

  const cols = cards.length <= 8 ? 4 : cards.length <= 18 ? 4 : 6
  const cellSize = Math.floor((Math.min(360, window.innerWidth - 40) - (cols - 1) * 6) / cols)
  const best = highScores['memory'] ?? 0
  const xp = Math.floor(score * 0.4)
  const maxTime = Math.max(10, 30 - round * 2)

  return (
    <GameShell
      theme={T}
      onExit={onExit}
      hud={[
        { label: 'ROUND', value: round },
        { label: 'TIME', value: `${timeLeft}s`, color: timeLeft <= 5 ? T.danger : T.hudText },
        { label: 'SCORE', value: score },
      ]}
    >
      {/* Timer bar */}
      <div className="h-1 shrink-0" style={{ background: T.surface }}>
        <div
          className="h-full transition-all duration-1000"
          style={{
            width: `${(timeLeft / maxTime) * 100}%`,
            background: timeLeft <= 5 ? T.danger : T.accent,
          }}
        />
      </div>

      <div className="flex items-center justify-center h-full px-4">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`, gap: 6 }}>
          {cards.map((card, i) => {
            const isFlipped = flipped.includes(i) || card.matched
            return (
              <motion.button
                key={`${round}-${i}`}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleFlip(i)}
                style={{
                  width: cellSize, height: cellSize * 1.2,
                  borderRadius: 10,
                  background: isFlipped
                    ? card.matched ? 'rgba(39,174,96,0.12)' : T.surface
                    : '#1F2348',
                  border: card.matched
                    ? '2px solid #27AE60'
                    : isFlipped
                      ? `1px solid ${T.accent}30`
                      : '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: cellSize * 0.4,
                  color: isFlipped ? T.hudText : '#1F2348',
                  transition: 'background 0.2s, border 0.2s',
                }}
              >
                {isFlipped ? card.icon : (
                  <svg width="16" height="18" viewBox="0 0 10 12" style={{ opacity: 0.15 }}>
                    <polygon points="5,0.5 9.3,2.75 9.3,9.25 5,11.5 0.7,9.25 0.7,2.75" fill="#E9B213" />
                  </svg>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      {!started && !gameOver && <StartOverlay theme={T} onStart={start} />}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'ROUNDS', value: round }]}
        />
      )}
    </GameShell>
  )
}
