import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'

const BG = '#FFF9E8'
const BOARD_BG = '#16130E'
const GOLD = '#F4C430'
const GREEN = '#86EFAC'
const RED = '#FF6B6B'
const SESSION_SECONDS = 150
const SPEED_CAP_MS = 15000

interface RoundData { size: number; grid: number[]; target: number }

function randomWalk(size: number, targetLen: number): number[] {
  const cells = size * size
  const start = Math.floor(Math.random() * cells)
  const path = [start]
  const visited = new Set([start])
  while (path.length < targetLen) {
    const last = path[path.length - 1]
    const r = Math.floor(last / size), c = last % size
    const neighbors: number[] = []
    if (r > 0) neighbors.push(last - size)
    if (r < size - 1) neighbors.push(last + size)
    if (c > 0) neighbors.push(last - 1)
    if (c < size - 1) neighbors.push(last + 1)
    const avail = neighbors.filter(n => !visited.has(n))
    if (avail.length === 0) break
    const next = avail[Math.floor(Math.random() * avail.length)]
    path.push(next)
    visited.add(next)
  }
  return path
}

function generateRound(round: number): RoundData {
  const tier = Math.floor((round - 1) / 3)
  const size = Math.min(4 + tier, 7)
  const cells = size * size
  const minLen = Math.min(3 + tier, cells - 1)
  const maxLen = Math.min(7 + tier, cells - 1)
  const targetLen = minLen + Math.floor(Math.random() * (Math.max(1, maxLen - minLen + 1)))
  const grid = Array.from({ length: cells }, () => 1 + Math.floor(Math.random() * 9))
  const path = randomWalk(size, Math.max(2, targetLen))
  const target = path.reduce((s, i) => s + grid[i], 0)
  return { size, grid, target }
}

function isAdjacent(a: number, b: number, size: number) {
  const ar = Math.floor(a / size), ac = a % size
  const br = Math.floor(b / size), bc = b % size
  return (ar === br && Math.abs(ac - bc) === 1) || (ac === bc && Math.abs(ar - br) === 1)
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

let _ac: AudioContext | null = null
function snd(type: 'add' | 'correct' | 'wrong' | 'levelup' | 'over', sum = 0) {
  if (soundMuted) return
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const n = (f: number, at: number, d: number, v: number, o: OscillatorType = 'sine') => {
      const osc = c.createOscillator(), g = c.createGain()
      osc.type = o; osc.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.001, at + d)
      osc.connect(g); g.connect(c.destination); osc.start(at); osc.stop(at + d)
    }
    if (type === 'add')      n(Math.min(1200, 320 + sum * 14), t, 0.08, 0.05, 'triangle')
    if (type === 'correct')  [660, 880, 1100].forEach((f, i) => n(f, t + i * 0.06, 0.12, 0.08))
    if (type === 'wrong')    n(190, t, 0.2, 0.13, 'sawtooth')
    if (type === 'levelup')  [600, 800, 1050, 1350].forEach((f, i) => n(f, t + i * 0.06, 0.11, 0.07))
    if (type === 'over')     { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

// Static preview for the start screen
const PREVIEW = [3, 7, 2, 5, 8, 1, 4, 9, 6, 2, 7, 3, 1, 5, 8, 4]
const PREVIEW_PATH = new Set([0, 4, 8, 9])
const PREVIEW_TARGET = PREVIEW_PATH.size ? [...PREVIEW_PATH].reduce((s, i) => s + PREVIEW[i], 0) : 0

export default function SumPathGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')

  const [gridSize, setGridSize] = useState(4)
  const [gridVals, setGridVals] = useState<number[]>([])
  const [target, setTarget] = useState(0)
  const [path, setPath] = useState<number[]>([])
  const [pathState, setPathState] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [round, setRound] = useState(1)
  const [score, setScore] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [solved, setSolved] = useState(0)
  const [streak, setStreak] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SESSION_SECONDS)
  const [popup, setPopup] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const isRunning = useRef(false)
  const busyRef = useRef(false)
  const draggingRef = useRef(false)

  const sizeRef = useRef(4)
  const gridValRef = useRef<number[]>([])
  const targetRef = useRef(0)
  const pathRef = useRef<number[]>([])
  const roundBornRef = useRef(0)
  const sessionEndRef = useRef(0)
  const prevSizeRef = useRef(4)

  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const solvedRef = useRef(0)
  const mistakesRef = useRef(0)
  const roundNumRef = useRef(1)

  const gridContainerRef = useRef<HTMLDivElement | null>(null)

  const doEnd = useCallback(() => {
    isRunning.current = false
    snd('over')
    vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.45))
    setHighScore('sum-path', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const nextRound = useCallback(() => {
    const r = generateRound(roundNumRef.current)
    if (r.size > prevSizeRef.current) {
      snd('levelup'); vibrate([15, 30, 15])
      setFlash(`GRID ${r.size}×${r.size}`)
      setTimeout(() => setFlash(null), 900)
    }
    prevSizeRef.current = r.size
    sizeRef.current = r.size
    gridValRef.current = r.grid
    targetRef.current = r.target
    pathRef.current = []
    roundBornRef.current = Date.now()
    setGridSize(r.size)
    setGridVals(r.grid)
    setTarget(r.target)
    setPath([])
    setPathState('idle')
  }, [])

  const handleCorrect = useCallback((p: number[]) => {
    busyRef.current = true
    const reaction = Date.now() - roundBornRef.current
    const speedBonus = Math.max(0, Math.floor(((SPEED_CAP_MS - Math.min(reaction, SPEED_CAP_MS)) / SPEED_CAP_MS) * 40))
    const efficiencyBonus = Math.max(0, 9 - p.length) * 4
    const tier = Math.floor(roundNumRef.current / 3)
    const pts = 50 + tier * 10 + speedBonus + efficiencyBonus + streakRef.current * 3
    scoreRef.current += pts
    setScore(scoreRef.current)
    streakRef.current++
    setStreak(streakRef.current)
    solvedRef.current++
    setSolved(solvedRef.current)
    setPathState('correct')
    snd('correct')
    vibrate([10, 20, 10])
    setPopup(`+${pts}`)
    setTimeout(() => setPopup(null), 700)
    setTimeout(() => {
      if (!isRunning.current) return
      roundNumRef.current++
      setRound(roundNumRef.current)
      nextRound()
      busyRef.current = false
    }, 500)
  }, [nextRound])

  const handleWrong = useCallback(() => {
    mistakesRef.current++
    setMistakes(mistakesRef.current)
    setPathState('wrong')
    streakRef.current = 0
    setStreak(0)
    snd('wrong')
    vibrate(35)
    setShake(x => x + 1)
    busyRef.current = true
    setTimeout(() => {
      pathRef.current = []
      setPath([])
      setPathState('idle')
      busyRef.current = false
    }, 450)
  }, [])

  const startPath = useCallback((idx: number) => {
    if (!isRunning.current || busyRef.current) return
    draggingRef.current = true
    pathRef.current = [idx]
    setPath([idx])
    setPathState('idle')
    snd('add', gridValRef.current[idx] ?? 0)
    vibrate(8)
  }, [])

  const extendPath = useCallback((idx: number) => {
    if (!draggingRef.current) return
    const p = pathRef.current
    if (p.includes(idx)) return
    const last = p[p.length - 1]
    if (last === undefined || !isAdjacent(last, idx, sizeRef.current)) return
    const next = [...p, idx]
    pathRef.current = next
    setPath(next)
    const sum = next.reduce((s, i) => s + (gridValRef.current[i] ?? 0), 0)
    snd('add', sum)
    vibrate(6)
  }, [])

  const releasePath = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    const p = pathRef.current
    if (p.length === 0 || busyRef.current) return
    const sum = p.reduce((s, i) => s + (gridValRef.current[i] ?? 0), 0)
    if (sum === targetRef.current) handleCorrect(p)
    else handleWrong()
  }, [handleCorrect, handleWrong])

  const start = useCallback(() => {
    scoreRef.current = 0; streakRef.current = 0; solvedRef.current = 0; mistakesRef.current = 0
    roundNumRef.current = 1; prevSizeRef.current = 0
    setScore(0); setStreak(0); setSolved(0); setMistakes(0); setRound(1); setPopup(null); setFlash(null)
    setTimeLeft(SESSION_SECONDS)
    sessionEndRef.current = Date.now() + SESSION_SECONDS * 1000
    isRunning.current = true
    busyRef.current = false
    setPhase('play')
    nextRound()
  }, [nextRound])

  // Session countdown
  useEffect(() => {
    if (phase !== 'play') return
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((sessionEndRef.current - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) { clearInterval(iv); doEnd() }
    }, 250)
    return () => clearInterval(iv)
  }, [phase, doEnd])

  // Native touch handlers on the grid container (need non-passive preventDefault)
  useEffect(() => {
    const container = gridContainerRef.current
    if (!container || phase !== 'play') return

    const idxFromPoint = (x: number, y: number): number | null => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null
      const attr = el?.closest('[data-idx]')?.getAttribute('data-idx')
      return attr != null ? Number(attr) : null
    }
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]; if (!t) return
      e.preventDefault()
      const idx = idxFromPoint(t.clientX, t.clientY)
      if (idx != null) startPath(idx)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return
      e.preventDefault()
      const t = e.touches[0]; if (!t) return
      const idx = idxFromPoint(t.clientX, t.clientY)
      if (idx != null) extendPath(idx)
    }
    const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); releasePath() }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd, { passive: false })
    window.addEventListener('mouseup', releasePath)
    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('mouseup', releasePath)
    }
  }, [phase, startPath, extendPath, releasePath])

  useEffect(() => () => { isRunning.current = false }, [])

  const best = highScores['sum-path'] ?? 0
  const xp = Math.floor(score * 0.45)
  const currentSum = path.reduce((s, i) => s + (gridVals[i] ?? 0), 0)

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,26px)', gap: 4 }}>
          {PREVIEW.map((v, i) => (
            <div key={i} style={{
              width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800,
              background: PREVIEW_PATH.has(i) ? '#E9B213' : 'white',
              color: PREVIEW_PATH.has(i) ? '#16130E' : '#1A1A2E',
              boxShadow: PREVIEW_PATH.has(i) ? '0 0 10px #E9B213' : '0 1px 3px rgba(0,0,0,0.08)',
            }}>{v}</div>
          ))}
        </div>
        <div style={{
          position: 'absolute', top: -10, right: -34, background: '#1A1A2E', color: BG, borderRadius: 10,
          padding: '3px 8px', fontSize: 12, fontWeight: 900,
        }}>{PREVIEW_TARGET}</div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>SUM PATH</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>DRAG A PATH THAT HITS THE TARGET</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('sum-path')) start(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', background: BG, position: 'relative', fontFamily: 'system-ui,sans-serif' }}>
      <HowToPlayOverlay bg={BG} accent="#1A1A2E" bullets={TUTORIALS['sum-path']} onStart={() => { markTutorialSeen('sum-path'); start() }} />
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>TIME'S UP</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>SOLVED</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{solved}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>MISTAKES</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{mistakes}</p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{xp}</p>
      {score > 0 && score >= best && <p style={{ fontSize: 11, color: '#E9B213', fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <motion.button whileTap={{ scale: 0.96 }} onClick={start}
          style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 14, padding: '15px 32px', fontSize: 14, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.1em' }}>
          PLAY AGAIN
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onExit}
          style={{ background: 'none', color: '#AAA', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: '15px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          HOME
        </motion.button>
      </div>
    </div>
  )

  const cell = Math.min(58, Math.floor(300 / gridSize) - 6)
  const sumColor = pathState === 'wrong' ? RED : currentSum === target && path.length > 0 ? GREEN : GOLD

  return (
    <div style={{ width: '100%', height: '100%', background: BOARD_BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px 2px', flexShrink: 0 }}>
        <button onClick={() => {
          if (isRunning.current) {
            isRunning.current = false
            if (scoreRef.current > 0) {
              addXp(Math.floor(scoreRef.current * 0.45))
              setHighScore('sum-path', scoreRef.current)
            }
          }
          onExit()
        }} style={{ background: 'none', border: 'none', color: '#665F4E', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#8A8266', margin: 0 }}>TIME</p>
          <p style={{ fontSize: 17, fontWeight: 900, color: timeLeft <= 20 ? RED : BG, margin: 0, lineHeight: 1.1 }}>{formatTime(timeLeft)}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#8A8266', margin: 0 }}>ROUND</p>
          <p style={{ fontSize: 17, fontWeight: 900, color: BG, margin: 0, lineHeight: 1.1 }}>{round}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 18px 6px', flexShrink: 0 }}>
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#8A8266', margin: 0 }}>SCORE</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: BG, margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
        </div>
        <div style={{
          background: '#1A1A2E', borderRadius: 12, padding: '5px 14px', textAlign: 'center',
          boxShadow: `0 0 12px ${GOLD}55`, border: `1.5px solid ${GOLD}`,
        }}>
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', color: GOLD, margin: 0 }}>TARGET</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: GOLD, margin: 0, lineHeight: 1.1 }}>{target}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#8A8266', margin: 0 }}>SUM</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: sumColor, margin: 0, lineHeight: 1.1 }}>{currentSum}</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, position: 'relative' }}>
        <AnimatePresence>
          {flash && (
            <motion.p key={flash} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '6%', fontSize: 15, fontWeight: 900, color: GOLD, letterSpacing: '0.1em', margin: 0 }}>
              {flash}
            </motion.p>
          )}
          {popup && (
            <motion.p key={popup + round} initial={{ y: 6, opacity: 0, scale: 0.8 }} animate={{ y: -40, opacity: 1, scale: 1.15 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '14%', fontSize: 20, fontWeight: 900, color: GREEN, margin: 0 }}>
              {popup}
            </motion.p>
          )}
        </AnimatePresence>
        {streak > 1 && <p style={{ fontSize: 11, fontWeight: 900, color: '#C4B5FD', letterSpacing: '0.1em', margin: 0, position: 'absolute', top: '2%' }}>STREAK ×{streak}</p>}

        <motion.div
          key={shake}
          ref={gridContainerRef}
          animate={pathState === 'wrong' ? { x: [0, -8, 8, -6, 6, 0] } : {}}
          transition={{ duration: 0.35 }}
          style={{
            display: 'grid', gridTemplateColumns: `repeat(${gridSize}, ${cell}px)`, gap: 5, touchAction: 'none',
          }}
        >
          {gridVals.map((v, i) => {
            const inPath = path.includes(i)
            const isLast = path.length > 0 && path[path.length - 1] === i
            let bg = '#231F17', color = GOLD, ring = 'none'
            if (inPath) {
              if (pathState === 'correct') { bg = GREEN; color = '#16130E'; ring = `0 0 14px ${GREEN}` }
              else if (pathState === 'wrong') { bg = RED; color = '#16130E'; ring = `0 0 14px ${RED}` }
              else { bg = GOLD; color = '#16130E'; ring = isLast ? `0 0 10px ${GOLD}` : 'none' }
            }
            return (
              <div
                key={i}
                data-idx={i}
                onMouseDown={() => startPath(i)}
                onMouseEnter={() => extendPath(i)}
                onDragStart={e => e.preventDefault()}
                style={{
                  width: cell, height: cell, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: cell > 44 ? 18 : 14, fontWeight: 800, cursor: 'pointer',
                  background: bg, color, boxShadow: ring,
                  transition: 'background 0.12s, box-shadow 0.12s',
                }}
              >{v}</div>
            )
          })}
        </motion.div>

        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#665F4E', margin: 0 }}>DRAG THROUGH ADJACENT CELLS · RELEASE TO SUBMIT</p>
      </div>
    </div>
  )
}
