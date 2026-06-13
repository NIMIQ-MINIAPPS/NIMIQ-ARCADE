import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'

const C = {
  memorize: '#4DA8FF',
  memorizeGlow: '#8FD3FF',
  correct: '#E9B213',
  wrong: '#FF6B6B',
  text: '#1A2744',
  muted: '#8FA4C8',
  hexBg: '#FFFFFF',
  hexBorder: 'rgba(77,168,255,0.18)',
  overlay: 'rgba(248,251,255,0.97)',
  live: '#FF6B6B',
  liveDead: 'rgba(0,0,0,0.1)',
}

const BG = 'linear-gradient(160deg, #F8FBFF 0%, #EEF6FF 50%, #DDEEFF 100%)'

function getDiff(lvl: number) {
  if (lvl >= 20) return {
    size: 7,
    count: Math.min(18 + Math.floor((lvl - 20) / 2), 44),
    time: Math.max(1100, 1500 - (lvl - 20) * 8),
  }
  if (lvl >= 10) return {
    size: 6,
    count: Math.min(12 + (lvl - 10), 34),
    time: Math.max(1500, 1800 - (lvl - 10) * 15),
  }
  if (lvl >= 5) return {
    size: 5,
    count: Math.min(7 + (lvl - 5), 22),
    time: Math.max(1800, 2000 - (lvl - 5) * 10),
  }
  return {
    size: 4,
    count: Math.min(3 + (lvl - 1), 14),
    time: Math.max(2000, 2500 - (lvl - 1) * 100),
  }
}

function hexR(size: number) {
  return size === 4 ? 36 : size === 5 ? 29 : size === 6 ? 24 : 20
}

function hexPts(cx: number, cy: number, R: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

function buildPositions(size: number, R: number) {
  const W = R * Math.sqrt(3)
  return Array.from({ length: size * size }, (_, i) => {
    const row = Math.floor(i / size), col = i % size
    return {
      cx: col * W + (row % 2 ? W / 2 : 0) + W / 2,
      cy: row * R * 1.5 + R,
    }
  })
}

let audioCtx: AudioContext | null = null

function snd(type: 'ding' | 'buzz' | 'tada' | 'whoosh' | 'doom') {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = audioCtx, t = c.currentTime
    const note = (f: number, at: number, dur: number, vol: number, shape: OscillatorType = 'sine') => {
      const o = c.createOscillator(), g = c.createGain()
      o.type = shape; o.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur)
      o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur)
    }
    if (type === 'ding')   { note(1400, t, 0.04, 0.14); note(1800, t, 0.22, 0.09) }
    if (type === 'buzz')   { note(90, t, 0.18, 0.28, 'sawtooth') }
    if (type === 'whoosh') { note(200, t, 0.2, 0.08); note(500, t + 0.05, 0.15, 0.06) }
    if (type === 'tada')   { [523, 659, 784, 1047].forEach((f, i) => note(f, t + i * 0.1, 0.24, 0.11)) }
    if (type === 'doom')   { note(100, t, 0.5, 0.25, 'sawtooth'); note(70, t + 0.2, 0.5, 0.18, 'square') }
  } catch { /* ignore */ }
}

type Badge = 'combo' | 'perfect' | 'levelup'

export default function MemoryMatrixGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [phase, setPhase] = useState<'memorize' | 'countdown' | 'recall'>('memorize')
  const [countdown, setCountdown] = useState<3 | 2 | 1 | null>(null)
  const [flashWhite, setFlashWhite] = useState(false)
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [litCells, setLitCells] = useState<Set<number>>(new Set())
  const [tapped, setTapped] = useState<Set<number>>(new Set())
  const [wrong, setWrong] = useState<Set<number>>(new Set())
  const [shakeIdx, setShakeIdx] = useState<number | null>(null)
  const [burstIdx, setBurstIdx] = useState<number | null>(null)
  const [gridSize, setGridSize] = useState(4)
  const [barPct, setBarPct] = useState(100)
  const [combo, setCombo] = useState(0)
  const [badge, setBadge] = useState<Badge | null>(null)

  const scoreRef = useRef(0)
  const levelRef = useRef(1)
  const livesRef = useRef(3)
  const comboRef = useRef(0)
  const wrongInLevelRef = useRef(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const barRef = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)

  const push = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
    return t
  }, [])

  const clearAll = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    clearInterval(barRef.current)
  }, [])

  const showBadge = useCallback((b: Badge, ms = 1200) => {
    setBadge(b)
    push(() => setBadge(null), ms)
  }, [push])

  const setupLevel = useCallback((lvl: number) => {
    const d = getDiff(lvl)
    const total = d.size * d.size
    const cells = new Set<number>()
    while (cells.size < Math.min(d.count, total - 1)) cells.add(Math.floor(Math.random() * total))

    setGridSize(d.size)
    setLitCells(cells)
    setTapped(new Set())
    setWrong(new Set())
    setShakeIdx(null)
    setBurstIdx(null)
    setBadge(null)
    wrongInLevelRef.current = 0
    setPhase('memorize')
    setBarPct(100)
    snd('whoosh')

    const t0 = Date.now()
    barRef.current = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - t0) / d.time) * 100)
      setBarPct(pct)
      if (pct <= 0) clearInterval(barRef.current)
    }, 40)

    push(() => {
      clearInterval(barRef.current)
      setBarPct(0)
      setPhase('countdown')
      setCountdown(3)
      push(() => setCountdown(2), 700)
      push(() => setCountdown(1), 1400)
      push(() => {
        setFlashWhite(true)
        push(() => {
          setFlashWhite(false)
          setCountdown(null)
          setPhase('recall')
        }, 200)
      }, 2000)
    }, d.time)
  }, [push])

  const start = useCallback(() => {
    clearAll()
    scoreRef.current = 0; levelRef.current = 1; livesRef.current = 3; comboRef.current = 0
    setScore(0); setLevel(1); setLives(3); setCombo(0)
    setGameOver(false); setStarted(true); setBadge(null)
    setupLevel(1)
  }, [clearAll, setupLevel])

  const handleTap = useCallback((idx: number) => {
    if (phase !== 'recall' || gameOver || tapped.has(idx) || wrong.has(idx)) return

    if (litCells.has(idx)) {
      snd('ding')
      comboRef.current++
      setCombo(comboRef.current)
      setBurstIdx(idx)
      push(() => setBurstIdx(null), 400)

      const nt = new Set(tapped); nt.add(idx)
      setTapped(nt)

      if (nt.size === litCells.size) {
        // Level complete
        const perfect = wrongInLevelRef.current === 0
        const multiplier = 1 + Math.floor(comboRef.current / 5)
        const pts = litCells.size * 50 * multiplier
        scoreRef.current += pts
        setScore(scoreRef.current)
        setHighScore('memory-matrix', scoreRef.current)
        snd('tada')
        showBadge(perfect ? 'perfect' : 'levelup', perfect ? 1600 : 1000)
        levelRef.current++
        setLevel(levelRef.current)
        push(() => setupLevel(levelRef.current), 900)
      } else if (comboRef.current > 0 && comboRef.current % 5 === 0) {
        showBadge('combo', 900)
      }
    } else {
      snd('buzz')
      comboRef.current = 0
      setCombo(0)
      wrongInLevelRef.current++
      const nw = new Set(wrong); nw.add(idx)
      setWrong(nw)
      setShakeIdx(idx)
      push(() => setShakeIdx(null), 350)
      livesRef.current--
      setLives(livesRef.current)

      if (livesRef.current <= 0) {
        snd('doom')
        clearAll()
        addXp(Math.floor(scoreRef.current * 0.4))
        setHighScore('memory-matrix', scoreRef.current)
        setGameOver(true)
      }
    }
  }, [phase, tapped, wrong, litCells, gameOver, push, setupLevel, showBadge, addXp, setHighScore])

  useEffect(() => () => clearAll(), [clearAll])

  const R = hexR(gridSize)
  const W = R * Math.sqrt(3)
  const gridW = gridSize * W + W / 2
  const gridH = gridSize * R * 1.5 + R * 0.5
  const positions = buildPositions(gridSize, R)
  const found = tapped.size
  const total = litCells.size
  const best = highScores['memory-matrix'] ?? 0
  const xp = Math.floor(scoreRef.current * 0.4)
  const litFade = phase === 'countdown'
    ? (countdown === 3 ? 0.9 : countdown === 2 ? 0.6 : 0.3)
    : 1

  const badgeLabel = badge === 'combo'
    ? `COMBO x${combo}`
    : badge === 'perfect'
    ? 'PERFECT'
    : 'LEVEL UP'

  if (!started) {
    return (
      <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
        <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 12px', background: `linear-gradient(135deg, ${C.memorize}, ${C.memorizeGlow})`, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="28" viewBox="0 0 32 28">
              <polygon points="16,1 29,7 29,21 16,27 3,21 3,7" fill="none" stroke="white" strokeWidth="2.5" />
              <circle cx="16" cy="14" r="4" fill="white" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: '0 0 4px', letterSpacing: '0.06em' }}>MEMORY MATRIX</h1>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Recall the pattern</p>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={start} style={{ background: C.memorize, color: '#fff', border: 'none', borderRadius: 16, padding: '16px 52px', fontSize: 18, fontWeight: 900, cursor: 'pointer', boxShadow: `0 6px 24px ${C.memorize}55`, letterSpacing: '0.1em' }}>
          PLAY
        </motion.button>
        {best > 0 && <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden', position: 'relative' }}>

      {/* White flash */}
      <AnimatePresence>
        {flashWhite && (
          <motion.div key="flash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
            style={{ position: 'absolute', inset: 0, background: 'white', zIndex: 30, pointerEvents: 'none' }} />
        )}
      </AnimatePresence>

      {/* HUD */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 8px', flexShrink: 0 }}>
        <button onClick={onExit} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 0 }}>←</button>

        <div style={{ textAlign: 'center', minWidth: 52 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: C.muted, margin: 0 }}>LEVEL</p>
          <p style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: 0, lineHeight: 1.1 }}>{level}</p>
        </div>

        <div style={{ textAlign: 'center', flex: 1 }}>
          {phase !== 'countdown' && (
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', margin: '0 0 2px',
              color: phase === 'memorize' ? C.memorize : C.correct }}>
              {phase === 'memorize' ? 'MEMORIZE' : 'RECALL'}
            </p>
          )}
          {phase === 'recall' && total > 0 && (
            <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, margin: 0 }}>{found} / {total}</p>
          )}
        </div>

        <div style={{ textAlign: 'center', minWidth: 52 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: C.muted, margin: 0 }}>SCORE</p>
          <p style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
        </div>
      </div>

      {/* Memory bar */}
      <div style={{ height: 4, margin: '0 20px 8px', background: 'rgba(77,168,255,0.12)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', background: barPct > 35 ? C.memorize : C.wrong, borderRadius: 2, width: `${barPct}%` }} />
      </div>

      {/* Lives — colored dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 7, paddingBottom: 10, flexShrink: 0 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < lives ? C.live : C.liveDead, transition: 'background 0.3s' }} />
        ))}
      </div>

      {/* Grid area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 0 }}>

        {/* Floating badge — single element avoids AnimatePresence conflict */}
        <AnimatePresence>
          {badge && (
            <motion.div key={badge}
              initial={{ opacity: 0, scale: 0.7, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -16 }}
              transition={{ duration: 0.22 }}
              style={{
                position: 'absolute', top: '8%', left: 0, right: 0,
                textAlign: 'center', zIndex: 20, pointerEvents: 'none',
                fontSize: 15, fontWeight: 900, letterSpacing: '0.14em',
                color: badge === 'perfect' ? C.correct : C.memorize,
              }}>
              {badgeLabel}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Countdown */}
        <AnimatePresence>
          {phase === 'countdown' && countdown != null && (
            <motion.div key={`cd-${countdown}`}
              initial={{ scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{ position: 'absolute', zIndex: 25, fontSize: 80, fontWeight: 900, color: C.memorize, pointerEvents: 'none', lineHeight: 1 }}>
              {countdown}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hex grid */}
        <svg width={gridW} height={gridH} style={{ overflow: 'visible', display: 'block' }}>
          <defs>
            <filter id="mm-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="mm-shadow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(0,0,0,0.09)" />
            </filter>
          </defs>

          {positions.map((pos, i) => {
            const isLit = litCells.has(i)
            const isCorrect = tapped.has(i)
            const isWrong = wrong.has(i)
            const showLit = isLit && (phase === 'memorize' || phase === 'countdown')

            const fill = showLit ? C.memorize : isCorrect ? C.correct : isWrong ? C.wrong : C.hexBg
            const stroke = showLit ? C.memorize : isCorrect ? C.correct : isWrong ? C.wrong : C.hexBorder
            const isBursting = burstIdx === i
            const isShaking = shakeIdx === i

            return (
              <motion.g
                key={`${level}-${i}`}
                animate={
                  isShaking ? { x: [0, -7, 7, -7, 0] } :
                  isBursting ? { scale: [1, 1.2, 1] } :
                  {}
                }
                transition={{ duration: 0.3 }}
                style={{
                  cursor: phase === 'recall' ? 'pointer' : 'default',
                  transformOrigin: `${pos.cx}px ${pos.cy}px`,
                }}
                onClick={() => handleTap(i)}
              >
                <polygon
                  points={hexPts(pos.cx, pos.cy, R - 2)}
                  fill={fill}
                  fillOpacity={showLit ? litFade : 1}
                  stroke={stroke}
                  strokeWidth="1.5"
                  filter={showLit ? 'url(#mm-glow)' : 'url(#mm-shadow)'}
                  style={{ transition: 'fill 0.15s, fill-opacity 0.35s' }}
                />
                {showLit && phase === 'memorize' && (
                  <motion.polygon
                    points={hexPts(pos.cx, pos.cy, R + 5)}
                    fill="none"
                    stroke={C.memorizeGlow}
                    strokeWidth="1.5"
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.07, 1] }}
                    transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                    style={{ transformOrigin: `${pos.cx}px ${pos.cy}px` }}
                  />
                )}
              </motion.g>
            )
          })}
        </svg>
      </div>

      {/* Game Over */}
      <AnimatePresence>
        {gameOver && (
          <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
            style={{ position: 'absolute', inset: 0, background: C.overlay, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, zIndex: 40 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: C.wrong, letterSpacing: '0.2em', margin: '0 0 10px' }}>GAME OVER</p>
              <p style={{ fontSize: 54, fontWeight: 900, color: C.text, margin: 0, lineHeight: 1 }}>{score.toLocaleString()}</p>
              <p style={{ fontSize: 13, color: C.muted, margin: '6px 0 0' }}>LEVEL {level} · XP +{xp}</p>
              {score > 0 && score >= best && (
                <p style={{ fontSize: 11, color: C.memorize, fontWeight: 800, margin: '8px 0 0', letterSpacing: '0.15em' }}>NEW BEST</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <motion.button whileTap={{ scale: 0.96 }} onClick={start}
                style={{ background: C.memorize, color: '#fff', border: 'none', borderRadius: 14, padding: '14px 32px', fontSize: 14, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.1em', boxShadow: `0 4px 18px ${C.memorize}50` }}>
                PLAY AGAIN
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={onExit}
                style={{ background: 'none', color: C.muted, border: `1.5px solid rgba(77,168,255,0.2)`, borderRadius: 14, padding: '14px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                EXIT
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
