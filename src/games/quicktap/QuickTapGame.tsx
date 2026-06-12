import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { ArrowLeft } from 'lucide-react'

interface Target {
  id: number
  x: number
  y: number
  size: number
  color: string
  born: number
}

const COLORS = ['#FFC107', '#4FC3F7', '#CE93D8', '#81C784', '#F06292']

let nextId = 0

interface Props { onExit: () => void }

export default function QuickTapGame({ onExit }: Props) {
  const { addXp, setHighScore } = useGameStore()
  const [targets, setTargets] = useState<Target[]>([])
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState(0)
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [round, setRound] = useState(1)
  const [flash, setFlash] = useState<{ text: string; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const spawnRef = useRef<number>(0)
  const cleanRef = useRef<number>(0)

  const spawnTarget = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const size = Math.max(40, 70 - round * 2)
    const x = Math.random() * (rect.width - size)
    const y = Math.random() * (rect.height - size)
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    setTargets(ts => [...ts, { id: nextId++, x, y, size, color, born: Date.now() }])
  }, [round])

  const startGame = useCallback(() => {
    setTargets([])
    setScore(0)
    setMisses(0)
    setRound(1)
    setGameOver(false)
    setStarted(true)
  }, [])

  useEffect(() => {
    if (!started || gameOver) return
    const interval = Math.max(400, 1200 - round * 80)
    spawnRef.current = window.setInterval(spawnTarget, interval)
    return () => clearInterval(spawnRef.current)
  }, [started, gameOver, round, spawnTarget])

  // Remove expired targets
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
              addXp(Math.floor(score * 0.5))
              setHighScore('quicktap', score)
            }
            return nm
          })
        }
        return ts.filter(t => now - t.born <= lifetime)
      })
    }, 200)
    return () => clearInterval(cleanRef.current)
  }, [started, gameOver, round, score, addXp, setHighScore])

  useEffect(() => {
    if (score > 0 && score % 10 === 0) setRound(r => r + 1)
  }, [score])

  const handleTap = (t: Target, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    if (gameOver) return
    const reaction = Date.now() - t.born
    const pts = Math.max(1, Math.floor(100 - reaction / 30))
    setScore(s => s + pts)
    setFlash({ text: `+${pts}`, x: t.x, y: t.y })
    setTimeout(() => setFlash(null), 500)
    setTargets(ts => ts.filter(tt => tt.id !== t.id))
  }

  return (
    <div className="flex flex-col h-full bg-[#080808]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <button onClick={onExit} className="text-[#555]"><ArrowLeft size={20} /></button>
        <h2 className="font-black text-white tracking-widest text-sm">QUICK TAP</h2>
        <div className="text-right">
          <p className="text-[10px] text-[#555]">SCORE</p>
          <p className="font-black text-[#FFC107]">{score}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-[11px] text-[#555]">ROUND <span className="text-white font-bold">{round}</span></span>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full ${i < misses ? 'bg-red-400' : 'bg-[#222]'}`} />
          ))}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {flash && (
          <motion.div
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -30, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute z-10 font-black text-[#FFC107] pointer-events-none text-lg"
            style={{ left: flash.x, top: flash.y }}
          >
            {flash.text}
          </motion.div>
        )}

        <AnimatePresence>
          {targets.map(t => (
            <motion.div
              key={t.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              onClick={(e) => handleTap(t, e)}
              onTouchStart={(e) => handleTap(t, e)}
              className="absolute flex items-center justify-center rounded-full cursor-pointer font-black text-[#080808] select-none"
              style={{
                left: t.x,
                top: t.y,
                width: t.size,
                height: t.size,
                backgroundColor: t.color,
                boxShadow: `0 0 15px ${t.color}60`,
                fontSize: t.size * 0.35,
              }}
            >
              ⬡
            </motion.div>
          ))}
        </AnimatePresence>

        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#080808]">
            <p className="text-4xl">⚡</p>
            <h3 className="text-xl font-black text-white">QUICK TAP</h3>
            <p className="text-[12px] text-[#555]">Tap the targets before they disappear</p>
            <button onClick={startGame} className="px-8 py-3 bg-[#FFC107] text-[#080808] font-black rounded-xl">
              START GAME
            </button>
          </div>
        )}

        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/90"
          >
            <p className="text-3xl mb-2">⚡</p>
            <h3 className="text-xl font-black text-white mb-1">GAME OVER</h3>
            <p className="text-[#FFC107] font-black text-2xl mb-1">{score}</p>
            <p className="text-[12px] text-[#888] mb-6">+{Math.floor(score * 0.5)} XP earned</p>
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
