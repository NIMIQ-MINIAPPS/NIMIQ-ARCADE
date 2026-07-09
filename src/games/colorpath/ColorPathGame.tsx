import { useState, useRef, useCallback, useEffect } from 'react'
import type { PointerEvent as RPE } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'

const START_BG = '#FFF9E8'
const PAGE_BG = '#16130E'
const TEXT_LIGHT = '#F5F1E6'
const TEXT_MUTED = '#8A8578'
const GAP = 3
const SESSION_MS = 100_000
const COLORS = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#A78BFA', '#6BCB77', '#FF9F6B', '#54A0FF', '#FF6FB5', '#2EE6D6']

interface Point { r: number; c: number }
interface PairDef { color: number; a: Point; b: Point }
interface LevelData { size: number; pairs: PairDef[] }

const DIRS: Point[] = [{ r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }]

function key(p: Point) { return `${p.r},${p.c}` }
function inBounds(p: Point, size: number) { return p.r >= 0 && p.r < size && p.c >= 0 && p.c < size }
function isAdjacent(a: Point, b: Point) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1 }
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function allCells(size: number): Point[] {
  const out: Point[] = []
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) out.push({ r, c })
  return out
}

function randomWalk(start: Point, size: number, used: Set<string>, minLen: number, maxLen: number): Point[] | null {
  const path: Point[] = [start]
  const local = new Set(used)
  local.add(key(start))
  while (path.length < maxLen) {
    const cur = path[path.length - 1]
    const options = shuffle(DIRS.map(d => ({ r: cur.r + d.r, c: cur.c + d.c })).filter(p => inBounds(p, size) && !local.has(key(p))))
    if (options.length === 0) break
    const next = options[0]
    path.push(next)
    local.add(key(next))
    if (path.length >= minLen && Math.random() < 0.4) break
  }
  return path.length >= minLen ? path : null
}

function generateLevelAttempt(size: number, pairsCount: number): PairDef[] | null {
  const used = new Set<string>()
  const pairs: PairDef[] = []
  const minLen = 3
  const maxLen = Math.max(4, Math.floor(size * 1.6))
  for (let i = 0; i < pairsCount; i++) {
    const free = shuffle(allCells(size).filter(p => !used.has(key(p))))
    let path: Point[] | null = null
    for (const start of free) {
      path = randomWalk(start, size, used, minLen, maxLen)
      if (path) break
    }
    if (!path) return null
    path.forEach(p => used.add(key(p)))
    pairs.push({ color: i, a: path[0], b: path[path.length - 1] })
  }
  return pairs
}

function trivialLevel(size: number, pairsCount: number): PairDef[] {
  const n = Math.min(pairsCount, size)
  const pairs: PairDef[] = []
  for (let i = 0; i < n; i++) pairs.push({ color: i, a: { r: i, c: 0 }, b: { r: i, c: size - 1 } })
  return pairs
}

function buildLevel(size: number, pairsCount: number): LevelData {
  for (let attempt = 0; attempt < 50; attempt++) {
    const pairs = generateLevelAttempt(size, pairsCount)
    if (pairs) return { size, pairs }
  }
  if (pairsCount > 3) return buildLevel(size, pairsCount - 1)
  return { size, pairs: trivialLevel(size, pairsCount) }
}

function sizeForLevel(lv: number) { return Math.min(5 + Math.floor((lv - 1) / 3), 8) }
function pairsForLevel(lv: number, size: number) {
  const cap = Math.max(3, Math.floor((size * size) / 6))
  return Math.min(3 + (lv - 1), cap, COLORS.length)
}
function cellPxFor(size: number) { return Math.max(28, Math.min(56, Math.floor((320 - GAP * (size - 1)) / size))) }

function cellFromXY(clientX: number, clientY: number, rect: DOMRect, size: number, cellPx: number): Point | null {
  const x = clientX - rect.left
  const y = clientY - rect.top
  const col = Math.floor(x / (cellPx + GAP))
  const row = Math.floor(y / (cellPx + GAP))
  if (row < 0 || row >= size || col < 0 || col >= size) return null
  return { r: row, c: col }
}

function findDotAt(pt: Point, pairs: PairDef[]): number | null {
  for (const pr of pairs) {
    if ((pt.r === pr.a.r && pt.c === pr.a.c) || (pt.r === pr.b.r && pt.c === pr.b.c)) return pr.color
  }
  return null
}

function ownerOfCell(pt: Point, paths: Record<number, Point[]>, exclude: number): number | null {
  for (const k of Object.keys(paths)) {
    const pid = Number(k)
    if (pid === exclude) continue
    if (paths[pid].some(p => p.r === pt.r && p.c === pt.c)) return pid
  }
  return null
}

let _ac: AudioContext | null = null
function snd(type: 'connect' | 'levelup' | 'invalid' | 'over') {
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
    if (type === 'connect') [520, 780].forEach((f, i) => n(f, t + i * 0.04, 0.09, 0.07))
    if (type === 'levelup') [600, 800, 1050, 1350].forEach((f, i) => n(f, t + i * 0.06, 0.11, 0.07))
    if (type === 'invalid') n(180, t, 0.16, 0.12, 'sawtooth')
    if (type === 'over') { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

export default function ColorPathGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [level, setLevel] = useState<LevelData>(() => buildLevel(sizeForLevel(1), pairsForLevel(1, sizeForLevel(1))))
  const [levelNum, setLevelNum] = useState(1)
  const [levelsCleared, setLevelsCleared] = useState(0)
  const [score, setScore] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(SESSION_MS / 1000))
  const [paths, setPaths] = useState<Record<number, Point[]>>({})
  const [confirmed, setConfirmed] = useState<number[]>([])
  const [dragging, setDragging] = useState<number | null>(null)
  const [flashCell, setFlashCell] = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const [lastLevelScore, setLastLevelScore] = useState(0)

  const levelRef = useRef<LevelData>(level)
  const pathsRef = useRef<Record<number, Point[]>>(paths)
  const confirmedRef = useRef<Set<number>>(new Set())
  const draggingRef = useRef<number | null>(null)
  const scoreRef = useRef(0)
  const levelNumRef = useRef(1)
  const levelsClearedRef = useRef(0)
  const mistakesRef = useRef(0)
  const remainingMsRef = useRef(SESSION_MS)
  const pausedRef = useRef(false)
  const isRunningRef = useRef(false)
  const levelStartRef = useRef(Date.now())

  const doEnd = useCallback(() => {
    isRunningRef.current = false
    snd('over')
    vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.3))
    setHighScore('color-path', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  useEffect(() => {
    if (phase !== 'play') return
    const iv = setInterval(() => {
      if (pausedRef.current || !isRunningRef.current) return
      remainingMsRef.current -= 200
      if (remainingMsRef.current <= 0) {
        remainingMsRef.current = 0
        setSecondsLeft(0)
        doEnd()
        return
      }
      setSecondsLeft(Math.ceil(remainingMsRef.current / 1000))
    }, 200)
    return () => clearInterval(iv)
  }, [phase, doEnd])

  useEffect(() => () => { isRunningRef.current = false }, [])

  const advanceLevel = useCallback(() => {
    if (!isRunningRef.current) return
    levelNumRef.current += 1
    setLevelNum(levelNumRef.current)
    const size = sizeForLevel(levelNumRef.current)
    const pairsCount = pairsForLevel(levelNumRef.current, size)
    const lvl = buildLevel(size, pairsCount)
    levelRef.current = lvl
    setLevel(lvl)
    pathsRef.current = {}
    setPaths({})
    confirmedRef.current = new Set()
    setConfirmed([])
    mistakesRef.current = 0
    draggingRef.current = null
    setDragging(null)
    levelStartRef.current = Date.now()
    pausedRef.current = false
  }, [])

  const handleLevelClear = useCallback(() => {
    pausedRef.current = true
    const pairsCount = levelRef.current.pairs.length
    const elapsed = (Date.now() - levelStartRef.current) / 1000
    const targetTime = pairsCount * 6
    const speedBonus = Math.max(0, Math.round((targetTime - elapsed) * 5))
    const mistakeBonus = mistakesRef.current === 0 ? 60 : Math.max(0, 60 - mistakesRef.current * 20)
    const base = 100 * pairsCount
    const total = base + speedBonus + mistakeBonus
    scoreRef.current += total
    setScore(scoreRef.current)
    levelsClearedRef.current += 1
    setLevelsCleared(levelsClearedRef.current)
    setLastLevelScore(total)
    snd('levelup')
    vibrate([15, 30, 15])
    setCelebrate(true)
    setTimeout(() => {
      setCelebrate(false)
      advanceLevel()
    }, 950)
  }, [advanceLevel])

  const completePair = useCallback((pairId: number) => {
    confirmedRef.current.add(pairId)
    setConfirmed(Array.from(confirmedRef.current))
    draggingRef.current = null
    setDragging(null)
    snd('connect')
    vibrate(15)
    if (confirmedRef.current.size === levelRef.current.pairs.length) {
      handleLevelClear()
    }
  }, [handleLevelClear])

  const triggerInvalid = useCallback((pairId: number, pt: Point) => {
    snd('invalid')
    vibrate(20)
    mistakesRef.current += 1
    setFlashCell(key(pt))
    setTimeout(() => setFlashCell(null), 220)
    const path = pathsRef.current[pairId] ?? []
    const startDot = path[0]
    const resetPath = startDot ? [startDot] : []
    const next = { ...pathsRef.current, [pairId]: resetPath }
    pathsRef.current = next
    setPaths(next)
  }, [])

  const handlePointerDown = useCallback((e: RPE<HTMLDivElement>) => {
    if (pausedRef.current || !isRunningRef.current) return
    const size = levelRef.current.size
    const cellPx = cellPxFor(size)
    const rect = e.currentTarget.getBoundingClientRect()
    const pt = cellFromXY(e.clientX, e.clientY, rect, size, cellPx)
    if (!pt) return
    const pairId = findDotAt(pt, levelRef.current.pairs)
    if (pairId == null || confirmedRef.current.has(pairId)) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {/* noop */}
    const next = { ...pathsRef.current, [pairId]: [pt] }
    pathsRef.current = next
    setPaths(next)
    draggingRef.current = pairId
    setDragging(pairId)
  }, [])

  const handlePointerMove = useCallback((e: RPE<HTMLDivElement>) => {
    const pairId = draggingRef.current
    if (pairId == null || pausedRef.current || !isRunningRef.current) return
    const size = levelRef.current.size
    const cellPx = cellPxFor(size)
    const rect = e.currentTarget.getBoundingClientRect()
    const pt = cellFromXY(e.clientX, e.clientY, rect, size, cellPx)
    if (!pt) return
    const path = pathsRef.current[pairId] ?? []
    const last = path[path.length - 1]
    if (last && last.r === pt.r && last.c === pt.c) return
    if (path.length >= 2) {
      const prev = path[path.length - 2]
      if (prev.r === pt.r && prev.c === pt.c) {
        const next = { ...pathsRef.current, [pairId]: path.slice(0, -1) }
        pathsRef.current = next
        setPaths(next)
        return
      }
    }
    if (!last || !isAdjacent(last, pt)) return
    if (path.some(p => p.r === pt.r && p.c === pt.c)) return
    const owner = ownerOfCell(pt, pathsRef.current, pairId)
    const otherDot = findDotAt(pt, levelRef.current.pairs)
    if (owner != null || (otherDot != null && otherDot !== pairId)) {
      triggerInvalid(pairId, pt)
      return
    }
    const nextPath = [...path, pt]
    const nextPaths = { ...pathsRef.current, [pairId]: nextPath }
    pathsRef.current = nextPaths
    setPaths(nextPaths)
    const pairDef = levelRef.current.pairs.find(p => p.color === pairId)
    if (pairDef) {
      const startPt = nextPath[0]
      const otherEnd = (startPt.r === pairDef.a.r && startPt.c === pairDef.a.c) ? pairDef.b : pairDef.a
      if (pt.r === otherEnd.r && pt.c === otherEnd.c) completePair(pairId)
    }
  }, [completePair, triggerInvalid])

  const handlePointerUp = useCallback((e: RPE<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {/* noop */}
    draggingRef.current = null
    setDragging(null)
  }, [])

  const start = useCallback(() => {
    scoreRef.current = 0; setScore(0)
    levelNumRef.current = 1; setLevelNum(1)
    levelsClearedRef.current = 0; setLevelsCleared(0)
    mistakesRef.current = 0
    const size = sizeForLevel(1)
    const pairsCount = pairsForLevel(1, size)
    const lvl = buildLevel(size, pairsCount)
    levelRef.current = lvl
    setLevel(lvl)
    pathsRef.current = {}
    setPaths({})
    confirmedRef.current = new Set()
    setConfirmed([])
    draggingRef.current = null
    setDragging(null)
    remainingMsRef.current = SESSION_MS
    setSecondsLeft(Math.ceil(SESSION_MS / 1000))
    pausedRef.current = false
    isRunningRef.current = true
    levelStartRef.current = Date.now()
    setCelebrate(false)
    setPhase('play')
  }, [])

  const best = highScores['color-path'] ?? 0
  const xp = Math.floor(score * 0.3)

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: START_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <div style={{ width: 92, height: 92, borderRadius: 16, background: PAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={72} height={72} viewBox="0 0 72 72">
          <circle cx={12} cy={12} r={5} fill={COLORS[0]} />
          <circle cx={60} cy={12} r={5} fill={COLORS[0]} />
          <polyline points="12,12 12,36 60,36 60,12" fill="none" stroke={COLORS[0]} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={12} cy={60} r={5} fill={COLORS[1]} />
          <circle cx={60} cy={60} r={5} fill={COLORS[1]} />
          <polyline points="12,60 36,60 36,48 60,48 60,60" fill="none" stroke={COLORS[1]} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>COLOR PATH</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>CONNECT DOTS WITHOUT CROSSING</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={start}
        style={{ background: '#1A1A2E', color: START_BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: START_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>TIME'S UP</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{score.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>LEVELS</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{levelsCleared}</p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{xp}</p>
      {score > 0 && score >= best && <p style={{ fontSize: 11, color: '#E9B213', fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <motion.button whileTap={{ scale: 0.96 }} onClick={start}
          style={{ background: '#1A1A2E', color: START_BG, border: 'none', borderRadius: 14, padding: '15px 32px', fontSize: 14, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.1em' }}>
          PLAY AGAIN
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onExit}
          style={{ background: 'none', color: '#AAA', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: '15px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          HOME
        </motion.button>
      </div>
    </div>
  )

  const size = level.size
  const cellPx = cellPxFor(size)
  const boardWidth = size * cellPx + (size - 1) * GAP
  const pairsCount = level.pairs.length

  return (
    <div style={{ width: '100%', height: '100%', background: PAGE_BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 4px', flexShrink: 0 }}>
        <button onClick={() => { isRunningRef.current = false; onExit() }} style={{ background: 'none', border: 'none', color: '#5A5648', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: TEXT_MUTED, margin: 0 }}>LEVEL</p>
            <p style={{ fontSize: 17, fontWeight: 900, color: TEXT_LIGHT, margin: 0, lineHeight: 1.1 }}>{levelNum}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: TEXT_MUTED, margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 17, fontWeight: 900, color: TEXT_LIGHT, margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: TEXT_MUTED, margin: 0 }}>TIME</p>
          <p style={{ fontSize: 17, fontWeight: 900, color: secondsLeft <= 15 ? '#FF6B6B' : TEXT_LIGHT, margin: 0, lineHeight: 1.1 }}>{secondsLeft}s</p>
        </div>
      </div>

      <div style={{ textAlign: 'center', height: 18, flexShrink: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#6BCB77', margin: 0 }}>{confirmed.length}/{pairsCount} PAIRS</p>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ position: 'relative', width: boardWidth, height: boardWidth, touchAction: 'none', userSelect: 'none' }}
        >
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${size}, ${cellPx}px)`, gridTemplateRows: `repeat(${size}, ${cellPx}px)`, gap: GAP }}>
            {Array.from({ length: size * size }, (_, i) => {
              const r = Math.floor(i / size), c = i % size
              const isFlash = flashCell === `${r},${c}`
              return <div key={i} style={{ borderRadius: 6, background: isFlash ? 'rgba(255,90,90,0.55)' : 'rgba(255,255,255,0.045)', transition: 'background 0.15s' }} />
            })}
          </div>
          <svg width={boardWidth} height={boardWidth} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {Object.keys(paths).map(k => {
              const pid = Number(k)
              const pts = paths[pid]
              if (!pts || pts.length < 2) return null
              const isConfirmed = confirmed.includes(pid)
              const isActive = dragging === pid
              const color = COLORS[pid % COLORS.length]
              const pointsAttr = pts.map(p => `${p.c * (cellPx + GAP) + cellPx / 2},${p.r * (cellPx + GAP) + cellPx / 2}`).join(' ')
              return (
                <polyline key={pid} points={pointsAttr} fill="none" stroke={color}
                  strokeWidth={isActive ? cellPx * 0.38 : cellPx * 0.32} strokeLinecap="round" strokeLinejoin="round"
                  opacity={isConfirmed ? 1 : 0.9}
                  style={{ filter: isConfirmed || isActive ? `drop-shadow(0 0 4px ${color})` : undefined }}
                />
              )
            })}
            {level.pairs.map(pr => {
              const isConfirmed = confirmed.includes(pr.color)
              const color = COLORS[pr.color % COLORS.length]
              return [pr.a, pr.b].map((pt, idx) => (
                <circle key={`${pr.color}-${idx}`}
                  cx={pt.c * (cellPx + GAP) + cellPx / 2} cy={pt.r * (cellPx + GAP) + cellPx / 2}
                  r={cellPx * 0.32}
                  fill={color}
                  stroke={isConfirmed ? '#fff' : 'rgba(255,255,255,0.55)'}
                  strokeWidth={isConfirmed ? 2.5 : 1.5}
                />
              ))
            })}
          </svg>
        </div>

        <AnimatePresence>
          {celebrate && (
            <motion.div key="celebrate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i / 12) * Math.PI * 2
                const dist = 74
                const color = COLORS[i % COLORS.length]
                return (
                  <motion.span key={i}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
                    animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 1 }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: color }}
                  />
                )
              })}
              <motion.p initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', fontSize: 16, fontWeight: 900, color: TEXT_LIGHT, letterSpacing: '0.08em', textAlign: 'center', margin: 0 }}>
                LEVEL {levelNum} CLEAR!<br /><span style={{ color: '#6BCB77' }}>+{lastLevelScore}</span>
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
