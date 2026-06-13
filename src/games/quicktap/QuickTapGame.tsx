import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('quicktap')

interface Target { id: number; x: number; y: number; size: number; born: number }
let nextId = 0

export default function QuickTapGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [targets, setTargets] = useState<Target[]>([])
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState(0)
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [round, setRound] = useState(1)
  const [flash, setFlash] = useState<{ text: string; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const spawnRef = useRef(0)
  const cleanRef = useRef(0)
  const scoreRef = useRef(0)

  const spawnTarget = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const size = Math.max(40, 64 - round * 2)
    setTargets(ts => [...ts, {
      id: nextId++,
      x: Math.random() * (rect.width - size - 16) + 8,
      y: Math.random() * (rect.height - size - 16) + 8,
      size, born: Date.now(),
    }])
  }, [round])

  const startGame = useCallback(() => {
    setTargets([]); setScore(0); setMisses(0); setRound(1)
    setGameOver(false); setStarted(true); scoreRef.current = 0
  }, [])

  useEffect(() => {
    if (!started || gameOver) return
    spawnRef.current = window.setInterval(spawnTarget, Math.max(400, 1200 - round * 80))
    return () => clearInterval(spawnRef.current)
  }, [started, gameOver, round, spawnTarget])

  useEffect(() => {
    if (!started || gameOver) return
    cleanRef.current = window.setInterval(() => {
      const lifetime = Math.max(800, 2000 - round * 100)
      const now = Date.now()
      setTargets(ts => {
        const expired = ts.filter(t => now - t.born > lifetime)
        if (expired.length > 0) {
          setMisses(m => {
            const nm = m + expired.length
            if (nm >= 5) {
              setGameOver(true)
              addXp(Math.floor(scoreRef.current * 0.5))
              setHighScore('quicktap', scoreRef.current)
            }
            return nm
          })
        }
        return ts.filter(t => now - t.born <= lifetime)
      })
    }, 200)
    return () => clearInterval(cleanRef.current)
  }, [started, gameOver, round, addXp, setHighScore])

  useEffect(() => {
    if (scoreRef.current > 0 && scoreRef.current % 10 === 0) setRound(r => r + 1)
  }, [score])

  const handleTap = (t: Target, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    if (gameOver) return
    const reaction = Date.now() - t.born
    const pts = Math.max(1, Math.floor(100 - reaction / 30))
    scoreRef.current += pts
    setScore(scoreRef.current)
    setFlash({ text: `+${pts}`, x: t.x + t.size / 2, y: t.y })
    setTimeout(() => setFlash(null), 500)
    setTargets(ts => ts.filter(tt => tt.id !== t.id))
  }

  const best = highScores['quicktap'] ?? 0
  const xp = Math.floor(score * 0.5)

  return (
    <GameShell
      theme={T}
      onExit={onExit}
      hud={[{ label: 'ROUND', value: round }, { label: 'SCORE', value: score }]}
      hudRight={
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[9px] tracking-widest font-semibold" style={{ color: T.hudMuted }}>SCORE</p>
            <p className="font-black text-[15px] leading-none" style={{ color: T.accent }}>{score}</p>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full" style={{
                background: i < misses ? T.danger : `${T.hudMuted}40`,
              }} />
            ))}
          </div>
        </div>
      }
    >
      {/* Measurement marks background */}
      <div ref={containerRef} className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(circle, ${T.gridLine} 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }}>
        {flash && (
          <motion.div
            initial={{ y: 0, opacity: 1 }} animate={{ y: -30, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute z-10 font-black pointer-events-none text-[15px]"
            style={{ left: flash.x, top: flash.y, color: T.accent }}
          >{flash.text}</motion.div>
        )}

        <AnimatePresence>
          {targets.map(t => (
            <motion.div
              key={t.id}
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0, opacity: 0 }}
              onClick={e => handleTap(t, e)}
              onTouchStart={e => handleTap(t, e)}
              className="absolute flex items-center justify-center rounded-full cursor-pointer select-none"
              style={{
                left: t.x, top: t.y, width: t.size, height: t.size,
                background: `radial-gradient(circle at 40% 40%, ${T.accent}, #C49210)`,
                boxShadow: `0 0 16px ${T.accent}40, inset 0 1px 2px rgba(255,255,255,0.2)`,
              }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!started && <StartOverlay theme={T} onStart={startGame} />}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={score} onRestart={startGame} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'ROUND', value: round }]}
        />
      )}
    </GameShell>
  )
}
