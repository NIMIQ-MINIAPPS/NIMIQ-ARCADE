import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import LivesHearts from '../../components/games/LivesHearts'

const BG = '#FFF8E7'
const PASTELS = ['#FFB3C6', '#B3DCFF', '#D4B3FF', '#B3F0D4', '#FFD4B3', '#FFF4B3']

// 2-col × 3-row slot grid; pick N at random for each set
const SLOTS = [
  { x: 95,  y: 118 }, { x: 272, y: 118 },
  { x: 95,  y: 270 }, { x: 272, y: 270 },
  { x: 95,  y: 422 }, { x: 272, y: 422 },
]

const R = 46 // hex radius (vertex to center)

function hexPoints(cx: number, cy: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${(cx + (R - 3) * Math.cos(a)).toFixed(1)},${(cy + (R - 3) * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

function numCount(seqs: number) {
  if (seqs >= 15) return 6
  if (seqs >= 10) return 5
  if (seqs >= 5)  return 4
  return 3
}

function numRange(seqs: number) {
  return 15 + seqs * 14
}

let uid = 0

function genSet(seqs: number) {
  const count = numCount(seqs)
  const half = numRange(seqs)
  const nums = new Set<number>()
  while (nums.size < count) {
    nums.add(Math.floor(Math.random() * (half * 2 + 1)) - half)
  }
  const slots = [...SLOTS].sort(() => Math.random() - 0.5).slice(0, count)
  const colors = [...PASTELS].sort(() => Math.random() - 0.5).slice(0, count)
  const arr = [...nums]
  return arr.map((num, i) => ({
    id: ++uid,
    num,
    x: slots[i].x + (Math.random() - 0.5) * 24,
    y: slots[i].y + (Math.random() - 0.5) * 18,
    color: colors[i],
  }))
}

let audioCtx: AudioContext | null = null
function snd(type: 'tick' | 'wrong' | 'clear' | 'doom') {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = audioCtx, t = c.currentTime
    const note = (f: number, at: number, dur: number, vol: number, shape: OscillatorType = 'sine') => {
      const o = c.createOscillator(), g = c.createGain()
      o.type = shape; o.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur)
      o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur)
    }
    if (type === 'tick')  { note(900, t, 0.07, 0.1) }
    if (type === 'wrong') { note(160, t, 0.15, 0.22, 'sawtooth') }
    if (type === 'clear') { [660, 880, 1100].forEach((f, i) => note(f, t + i * 0.06, 0.14, 0.1)) }
    if (type === 'doom')  { note(200, t, 0.4, 0.2, 'sawtooth'); note(140, t + 0.3, 0.4, 0.15, 'square') }
  } catch { /* ignore */ }
}

type Hex = ReturnType<typeof genSet>[0]

export default function LowPopGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [started, setStarted] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [timeLeft, setTimeLeft] = useState(60)
  const [hexes, setHexes] = useState<Hex[]>([])
  const [shakeId, setShakeId] = useState<number | null>(null)

  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const seqsRef = useRef(0)
  const hexesRef = useRef<Hex[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const isRunning = useRef(false)

  const loadSet = useCallback((seqs: number) => {
    const h = genSet(seqs)
    hexesRef.current = h
    setHexes(h)
  }, [])

  const start = useCallback(() => {
    clearInterval(timerRef.current)
    scoreRef.current = 0; livesRef.current = 3; seqsRef.current = 0
    setScore(0); setLives(3); setTimeLeft(60); setGameOver(false); setStarted(true)
    isRunning.current = true
    loadSet(0)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          isRunning.current = false
          clearInterval(timerRef.current)
          addXp(Math.floor(scoreRef.current * 0.4))
          setHighScore('low-pop', scoreRef.current)
          setGameOver(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [loadSet, addXp, setHighScore])

  const handleTap = useCallback((id: number) => {
    if (!isRunning.current || gameOver) return
    const h = hexesRef.current
    const sorted = [...h].sort((a, b) => a.num - b.num)
    const expected = sorted[0]

    if (!expected) return

    if (id === expected.id) {
      snd('tick')
      scoreRef.current++
      setScore(scoreRef.current)
      const remaining = h.filter(x => x.id !== id)
      hexesRef.current = remaining
      setHexes(remaining)
      if (remaining.length === 0) {
        snd('clear')
        seqsRef.current++
        setTimeout(() => loadSet(seqsRef.current), 120)
      }
    } else {
      snd('wrong')
      setShakeId(id)
      setTimeout(() => setShakeId(null), 380)
      livesRef.current--
      setLives(livesRef.current)
      if (livesRef.current <= 0) {
        isRunning.current = false
        clearInterval(timerRef.current)
        snd('doom')
        addXp(Math.floor(scoreRef.current * 0.4))
        setHighScore('low-pop', scoreRef.current)
        setGameOver(true)
      }
    }
  }, [gameOver, loadSet, addXp, setHighScore])

  useEffect(() => () => { isRunning.current = false; clearInterval(timerRef.current) }, [])

  const exitPlay = useCallback(() => {
    if (isRunning.current) {
      isRunning.current = false
      clearInterval(timerRef.current)
      if (scoreRef.current > 0) {
        addXp(Math.floor(scoreRef.current * 0.4))
        setHighScore('low-pop', scoreRef.current)
      }
    }
    onExit()
  }, [addXp, setHighScore, onExit])

  const best = highScores['low-pop'] ?? 0
  const xp = Math.floor(scoreRef.current * 0.4)

  if (showHowTo) {
    return (
      <div style={{ width: '100%', height: '100%', background: BG, position: 'relative', fontFamily: 'system-ui,sans-serif' }}>
        <HowToPlayOverlay bg={BG} accent="#222" textColor="#1A1A2E" mutedColor="#999" bullets={TUTORIALS['low-pop']} onStart={() => { markTutorialSeen('low-pop'); setShowHowTo(false); start() }} />
      </div>
    )
  }

  if (!started) {
    return (
      <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
        <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBAА', fontSize: 22, cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#222', margin: 0, letterSpacing: '0.04em' }}>LOW POP</h1>
        <p style={{ color: '#AAA', fontSize: 14, margin: 0, textAlign: 'center', padding: '0 40px' }}>Tap lowest to highest before time runs out</p>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('low-pop')) start(); else setShowHowTo(true) }}
          style={{ background: '#222', color: BG, border: 'none', borderRadius: 16, padding: '16px 52px', fontSize: 17, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.1em' }}>
          PLAY
        </motion.button>
        {best > 0 && <p style={{ color: '#AAA', fontSize: 13, margin: 0 }}>BEST: {best}</p>}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden', position: 'relative' }}>

      {/* HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 24px 10px', flexShrink: 0 }}>
        <button onClick={exitPlay} style={{ background: 'none', border: 'none', color: '#CCC', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 0 }}>←</button>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: '#BBBBA', margin: 0 }}>TIME</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: timeLeft <= 10 ? '#FF6B6B' : '#222', margin: 0, lineHeight: 1.1, transition: 'color 0.3s' }}>{timeLeft}s</p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: '#BBB', margin: 0 }}>SCORE</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#222', margin: 0, lineHeight: 1.1 }}>{score}</p>
        </div>
      </div>

      {/* Lives */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 10, flexShrink: 0 }}>
        <LivesHearts lives={lives} maxLives={3} color="#FF6B6B" />
      </div>

      {/* Game area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence>
          {hexes.map(h => {
            const numStr = String(h.num)
            const fs = Math.max(13, 28 - (numStr.length - 1) * 3)
            const isShaking = shakeId === h.id
            return (
              <motion.div
                key={h.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, x: isShaking ? [-9, 9, -9, 9, 0] : 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: isShaking ? 0.35 : 0.18, type: isShaking ? 'tween' : 'spring', stiffness: 300, damping: 20 }}
                onClick={() => handleTap(h.id)}
                style={{ position: 'absolute', left: h.x - R, top: h.y - R, width: R * 2, height: R * 2, cursor: 'pointer' }}
              >
                <svg width={R * 2} height={R * 2} viewBox={`0 0 ${R * 2} ${R * 2}`} overflow="visible">
                  <polygon
                    points={hexPoints(R, R)}
                    fill={h.color}
                    filter="drop-shadow(0 4px 10px rgba(0,0,0,0.11))"
                  />
                  <text
                    x={R} y={R + fs * 0.37}
                    textAnchor="middle"
                    fontSize={fs}
                    fontWeight="900"
                    fill="#222"
                    fontFamily="system-ui,-apple-system,sans-serif"
                  >{h.num}</text>
                </svg>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Game Over */}
      <AnimatePresence>
        {gameOver && (
          <motion.div key="go" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22 }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(255,248,231,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 40 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>GAME OVER</p>
            <p style={{ fontSize: 58, fontWeight: 900, color: '#222', margin: 0, lineHeight: 1 }}>{score}</p>
            <p style={{ fontSize: 13, color: '#BBB', margin: 0 }}>XP +{xp}</p>
            {score > 0 && score >= best && (
              <p style={{ fontSize: 11, color: '#E9B213', fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <motion.button whileTap={{ scale: 0.96 }} onClick={start}
                style={{ background: '#222', color: BG, border: 'none', borderRadius: 14, padding: '14px 32px', fontSize: 14, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.1em' }}>
                PLAY AGAIN
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={onExit}
                style={{ background: 'none', color: '#AAA', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: '14px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                EXIT
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
