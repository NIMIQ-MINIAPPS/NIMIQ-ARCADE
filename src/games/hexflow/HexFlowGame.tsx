import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'

const BG = '#FFF9E8'
const BOARD_BG = '#0B1420'
const ACCENT = '#22D3EE'
const DIM_FILL = '#17212F'
const DIM_STROKE = '#2A3648'
const LIT_FILL = '#0E4C5C'
const LIT_STROKE = '#22D3EE'
const STUB_DIM = '#3A4658'
const STUB_LIT = '#67E8F9'
const SOURCE_FILL = '#0A6E7C'
const SOURCE_STROKE = '#A5F3FC'
const OUTLET_LIT_STROKE = '#67E8F9'
const OUTLET_DIM_STROKE = '#64748B'

const SESSION_SECONDS = 150

// ── hex axial math ──────────────────────────────────────────────────────────
// Edge index 0..5 corresponds to angles 0,60,120,180,240,300 (matching the
// hex vertex formula `a = PI/3*i - PI/6` used across GameIllustration.tsx),
// so neighbor axial offsets below are ordered to line up with those angles.
interface Axial { q: number; r: number }
const EDGE_DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]

function cellKey(q: number, r: number): string {
  return `${q},${r}`
}

function cellsInRadius(radius: number): Axial[] {
  const out: Axial[] = []
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius)
    const r2 = Math.min(radius, -q + radius)
    for (let r = r1; r <= r2; r++) out.push({ q, r })
  }
  return out
}

function axialToPixel(q: number, r: number, cellR: number): { x: number; y: number } {
  return { x: cellR * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r), y: cellR * 1.5 * r }
}

function cellRadiusFor(boardRadius: number): number {
  if (boardRadius <= 2) return 27
  if (boardRadius <= 3) return 20
  if (boardRadius <= 4) return 16
  return 13
}

// ── tile model ───────────────────────────────────────────────────────────────
interface Tile {
  key: string
  q: number
  r: number
  base: number[]
  turns: number
  isSource: boolean
  isOutlet: boolean
}

function effectiveEdges(tile: Tile): Set<number> {
  const s = new Set<number>()
  for (const e of tile.base) s.add((e + tile.turns) % 6)
  return s
}

function computeLit(tiles: Record<string, Tile>, sourceKey: string): Set<string> {
  const lit = new Set<string>()
  const source = tiles[sourceKey]
  if (!source) return lit
  lit.add(sourceKey)
  const queue: string[] = [sourceKey]
  while (queue.length > 0) {
    const ck = queue.shift() as string
    const tile = tiles[ck]
    if (!tile) continue
    const edges = effectiveEdges(tile)
    for (const e of edges) {
      const [dq, dr] = EDGE_DIRS[e]
      const nk = cellKey(tile.q + dq, tile.r + dr)
      if (lit.has(nk)) continue
      const ntile = tiles[nk]
      if (!ntile) continue
      const back = (e + 3) % 6
      if (effectiveEdges(ntile).has(back)) {
        lit.add(nk)
        queue.push(nk)
      }
    }
  }
  return lit
}

// Randomized spanning tree over the whole board (rooted at source), capped at
// degree 3 per cell where possible so shapes read as end/curve/T pipes. Every
// board cell ends up with >=1 connection — this is what guarantees the puzzle
// is solvable once we scramble rotations, since the "solved" shape already
// connects source to every other cell (outlets included).
function buildSpanningTree(cells: Axial[], keys: Set<string>, sourceKey: string): Map<string, Set<number>> {
  const treeEdges = new Map<string, Set<number>>(cells.map(c => [cellKey(c.q, c.r), new Set<number>()]))
  const inTree = new Set<string>([sourceKey])
  interface FrontierEdge { fromKey: string; e: number; toKey: string; toQ: number; toR: number }
  const frontier: FrontierEdge[] = []
  const pushFrontier = (q: number, r: number) => {
    const fromKey = cellKey(q, r)
    for (let e = 0; e < 6; e++) {
      const [dq, dr] = EDGE_DIRS[e]
      const toQ = q + dq, toR = r + dr, toKey = cellKey(toQ, toR)
      if (keys.has(toKey) && !inTree.has(toKey)) frontier.push({ fromKey, e, toKey, toQ, toR })
    }
  }
  const [sq, sr] = sourceKey.split(',').map(Number)
  pushFrontier(sq, sr)

  while (frontier.length > 0) {
    const validIdxs: number[] = []
    for (let i = 0; i < frontier.length; i++) {
      if ((treeEdges.get(frontier[i].fromKey)?.size ?? 0) < 3) validIdxs.push(i)
    }
    const idx = validIdxs.length > 0 ? validIdxs[Math.floor(Math.random() * validIdxs.length)] : Math.floor(Math.random() * frontier.length)
    const edge = frontier[idx]
    frontier.splice(idx, 1)
    if (inTree.has(edge.toKey)) continue
    inTree.add(edge.toKey)
    treeEdges.get(edge.fromKey)?.add(edge.e)
    treeEdges.get(edge.toKey)?.add((edge.e + 3) % 6)
    pushFrontier(edge.toQ, edge.toR)
  }
  return treeEdges
}

function bfsDistances(treeEdges: Map<string, Set<number>>, sourceKey: string): Map<string, number> {
  const dist = new Map<string, number>([[sourceKey, 0]])
  const queue: string[] = [sourceKey]
  while (queue.length > 0) {
    const ck = queue.shift() as string
    const edges = treeEdges.get(ck)
    if (!edges) continue
    const [cq, cr] = ck.split(',').map(Number)
    for (const e of edges) {
      const [dq, dr] = EDGE_DIRS[e]
      const nk = cellKey(cq + dq, cr + dr)
      if (!dist.has(nk)) { dist.set(nk, (dist.get(ck) ?? 0) + 1); queue.push(nk) }
    }
  }
  return dist
}

function levelParams(level: number): { radius: number; outlets: number } {
  const radius = Math.min(2 + Math.floor((level - 1) / 4), 6)
  const cellCount = 3 * radius * radius + 3 * radius + 1
  const maxOutlets = Math.max(2, cellCount - 4)
  const outlets = Math.min(2 + Math.floor((level - 1) / 2), maxOutlets)
  return { radius, outlets }
}

function genLevel(radius: number, outletCount: number): { tiles: Record<string, Tile>; source: string; outlets: string[] } {
  const cells = cellsInRadius(radius)
  const keys = new Set(cells.map(c => cellKey(c.q, c.r)))
  const sourceKey = cellKey(0, 0)
  const treeEdges = buildSpanningTree(cells, keys, sourceKey)

  const dist = bfsDistances(treeEdges, sourceKey)
  const candidates = cells
    .map(c => cellKey(c.q, c.r))
    .filter(k => k !== sourceKey)
    .sort((a, b) => (dist.get(b) ?? 0) - (dist.get(a) ?? 0))
  const count = Math.min(outletCount, candidates.length)
  const outletKeys: string[] = []
  for (let i = 0; i < count; i++) {
    const idx = Math.min(Math.floor((i * candidates.length) / count), candidates.length - 1)
    outletKeys.push(candidates[idx])
  }

  const tiles: Record<string, Tile> = {}
  for (const c of cells) {
    const k = cellKey(c.q, c.r)
    const base = Array.from(treeEdges.get(k) ?? new Set<number>())
    const isSource = k === sourceKey
    tiles[k] = {
      key: k, q: c.q, r: c.r, base,
      turns: isSource ? 0 : Math.floor(Math.random() * 6),
      isSource, isOutlet: outletKeys.includes(k),
    }
  }

  // Defensive: guarantee the scrambled board isn't already fully solved.
  if (outletKeys.length > 0) {
    let guard = 0
    let litNow = computeLit(tiles, sourceKey)
    while (outletKeys.every(k => litNow.has(k)) && guard < 20) {
      const rotatable = Object.keys(tiles).filter(k => !tiles[k].isSource)
      const pick = rotatable[Math.floor(Math.random() * rotatable.length)]
      tiles[pick] = { ...tiles[pick], turns: (tiles[pick].turns + 1) % 6 }
      litNow = computeLit(tiles, sourceKey)
      guard++
    }
  }

  return { tiles, source: sourceKey, outlets: outletKeys }
}

// ── sound ────────────────────────────────────────────────────────────────────
let _ac: AudioContext | null = null
function snd(type: 'rotate' | 'connect' | 'levelup' | 'over') {
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
    if (type === 'rotate')  n(520, t, 0.05, 0.05, 'square')
    if (type === 'connect') [740, 980].forEach((f, i) => n(f, t + i * 0.04, 0.08, 0.055))
    if (type === 'levelup') [600, 800, 1050, 1350].forEach((f, i) => n(f, t + i * 0.06, 0.11, 0.07))
    if (type === 'over')    { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

function fmtTime(s: number): string {
  const clamped = Math.max(0, s)
  const m = Math.floor(clamped / 60)
  const sec = clamped % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── tile rendering (shared by preview + board) ──────────────────────────────
function HexTile({ tile, pos, cellR, isLit, onRotate }: {
  tile: Tile
  pos: { x: number; y: number }
  cellR: number
  isLit: boolean
  onRotate?: (key: string) => void
}) {
  const edges = Array.from(effectiveEdges(tile))
  const hexPts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${(cellR * 0.94 * Math.cos(a)).toFixed(1)},${(cellR * 0.94 * Math.sin(a)).toFixed(1)}`
  }).join(' ')
  const glow = isLit || tile.isSource
  const fill = tile.isSource ? SOURCE_FILL : isLit ? LIT_FILL : DIM_FILL
  const stroke = tile.isSource ? SOURCE_STROKE : isLit ? LIT_STROKE : DIM_STROKE
  const stubColor = glow ? STUB_LIT : STUB_DIM
  const canTap = !tile.isSource && !!onRotate

  return (
    <g transform={`translate(${pos.x},${pos.y})`}>
      <g
        onClick={canTap ? () => onRotate?.(tile.key) : undefined}
        style={{
          transform: `rotate(${tile.turns * 60}deg)`,
          transformOrigin: '0px 0px',
          transition: 'transform 0.18s cubic-bezier(0.22,0.9,0.32,1)',
          cursor: canTap ? 'pointer' : 'default',
        }}
      >
        <polygon
          points={hexPts}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.4}
          style={glow ? { filter: 'drop-shadow(0 0 5px rgba(103,232,249,0.55))' } : undefined}
        />
        {edges.map(e => {
          const a = (Math.PI / 3) * e
          const x2 = Math.cos(a) * cellR * 0.86
          const y2 = Math.sin(a) * cellR * 0.86
          return (
            <line key={e} x1={0} y1={0} x2={x2} y2={y2}
              stroke={stubColor} strokeWidth={Math.max(3, cellR * 0.22)} strokeLinecap="round" />
          )
        })}
        {edges.length > 0 && <circle r={Math.max(2.5, cellR * 0.15)} fill={stubColor} />}
      </g>
      {tile.isSource && (
        <motion.circle
          r={cellR * 0.37}
          fill="none"
          stroke={SOURCE_STROKE}
          strokeWidth={2}
          style={{ transformOrigin: '0px 0px' }}
          animate={{ scale: [0.7, 1.3, 0.7], opacity: [0.85, 0.15, 0.85] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {tile.isOutlet && (
        <polygon
          points={`0,${-cellR * 0.4} ${cellR * 0.27},0 0,${cellR * 0.4} ${-cellR * 0.27},0`}
          fill={isLit ? 'rgba(103,232,249,0.4)' : 'rgba(148,163,184,0.12)'}
          stroke={isLit ? OUTLET_LIT_STROKE : OUTLET_DIM_STROKE}
          strokeWidth={1.5}
          style={isLit ? { filter: 'drop-shadow(0 0 6px rgba(103,232,249,0.85))' } : undefined}
        />
      )}
    </g>
  )
}

function computeLayout(tiles: Record<string, Tile>, cellR: number): { positions: Record<string, { x: number; y: number }>; viewBox: string } {
  const values = Object.values(tiles)
  if (values.length === 0) return { positions: {}, viewBox: '0 0 10 10' }
  const positions: Record<string, { x: number; y: number }> = {}
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const t of values) {
    const p = axialToPixel(t.q, t.r, cellR)
    positions[t.key] = p
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  const pad = cellR + 8
  return { positions, viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}` }
}

// ── static start-screen preview: a tiny already-solved pipe chain ──────────
const PREVIEW_CELLR = 15
function buildPreviewTiles(): Record<string, Tile> {
  const chain: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: 1 }, { q: 1, r: 2 }]
  const edgeToNext = [0, 1, 1]
  const tiles: Record<string, Tile> = {}
  for (const c of chain) tiles[cellKey(c.q, c.r)] = { key: cellKey(c.q, c.r), q: c.q, r: c.r, base: [], turns: 0, isSource: false, isOutlet: false }
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i], b = chain[i + 1], e = edgeToNext[i]
    tiles[cellKey(a.q, a.r)].base.push(e)
    tiles[cellKey(b.q, b.r)].base.push((e + 3) % 6)
  }
  tiles[cellKey(0, 0)].isSource = true
  tiles[cellKey(1, 2)].isOutlet = true
  return tiles
}
const PREVIEW_TILES = buildPreviewTiles()
const PREVIEW_SOURCE = cellKey(0, 0)
const PREVIEW_LIT = computeLit(PREVIEW_TILES, PREVIEW_SOURCE)
const PREVIEW_LAYOUT = computeLayout(PREVIEW_TILES, PREVIEW_CELLR)

// ── main component ──────────────────────────────────────────────────────────
export default function HexFlowGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [rotTotal, setRotTotal] = useState(0)
  const [levelsSolved, setLevelsSolved] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SESSION_SECONDS)
  const [tiles, setTiles] = useState<Record<string, Tile>>({})
  const [sourceKey, setSourceKey] = useState('')
  const [outlets, setOutlets] = useState<string[]>([])
  const [boardRadius, setBoardRadius] = useState(2)
  const [flash, setFlash] = useState<string | null>(null)

  const levelRef = useRef(1)
  const scoreRef = useRef(0)
  const rotationsTotalRef = useRef(0)
  const rotationsThisLevelRef = useRef(0)
  const levelsSolvedRef = useRef(0)
  const timeLeftRef = useRef(SESSION_SECONDS)
  const levelStartRef = useRef(0)
  const litOutletsSeenRef = useRef(0)
  const solvingRef = useRef(false)
  const isRunning = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)

  const doEnd = useCallback(() => {
    isRunning.current = false
    clearInterval(timerRef.current)
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.2))
    setHighScore('hex-flow', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const loadLevel = useCallback((lvl: number) => {
    const { radius, outlets: outCount } = levelParams(lvl)
    const gen = genLevel(radius, outCount)
    setBoardRadius(radius)
    setTiles(gen.tiles)
    setSourceKey(gen.source)
    setOutlets(gen.outlets)
    rotationsThisLevelRef.current = 0
    litOutletsSeenRef.current = 0
    levelStartRef.current = Date.now()
    solvingRef.current = false
  }, [])

  const start = useCallback(() => {
    levelRef.current = 1; setLevel(1)
    scoreRef.current = 0; setScore(0)
    rotationsTotalRef.current = 0; setRotTotal(0)
    levelsSolvedRef.current = 0; setLevelsSolved(0)
    timeLeftRef.current = SESSION_SECONDS; setTimeLeft(SESSION_SECONDS)
    setFlash(null)
    isRunning.current = true
    loadLevel(1)
    setPhase('play')
  }, [loadLevel])

  useEffect(() => {
    if (phase !== 'play') return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1
      setTimeLeft(timeLeftRef.current)
      if (timeLeftRef.current <= 0) doEnd()
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase, doEnd])

  useEffect(() => () => { isRunning.current = false; clearInterval(timerRef.current) }, [])

  const rotateTile = useCallback((k: string) => {
    if (!isRunning.current || solvingRef.current) return
    let didRotate = false
    setTiles(prev => {
      const t = prev[k]
      if (!t || t.isSource) return prev
      didRotate = true
      return { ...prev, [k]: { ...t, turns: t.turns + 1 } }
    })
    if (didRotate) {
      rotationsThisLevelRef.current++
      rotationsTotalRef.current++
      setRotTotal(rotationsTotalRef.current)
      snd('rotate'); vibrate(8)
    }
  }, [])

  const lit = useMemo(() => (sourceKey ? computeLit(tiles, sourceKey) : new Set<string>()), [tiles, sourceKey])

  useEffect(() => {
    if (phase !== 'play' || !sourceKey || solvingRef.current || outlets.length === 0) return
    const litOutletCount = outlets.filter(k => lit.has(k)).length
    if (litOutletCount > litOutletsSeenRef.current) {
      litOutletsSeenRef.current = litOutletCount
      if (litOutletCount < outlets.length) { snd('connect'); vibrate(6) }
    }
    if (litOutletCount === outlets.length) {
      solvingRef.current = true
      const elapsedSec = (Date.now() - levelStartRef.current) / 1000
      const rotUsed = rotationsThisLevelRef.current
      const base = 100 + levelRef.current * 25
      const speedBonus = Math.max(0, Math.round(50 - elapsedSec * 2.5))
      const efficiencyBonus = Math.max(0, Math.round(60 - rotUsed * 3))
      const gained = base + speedBonus + efficiencyBonus
      scoreRef.current += gained
      setScore(scoreRef.current)
      levelsSolvedRef.current += 1
      setLevelsSolved(levelsSolvedRef.current)
      snd('levelup'); vibrate([15, 30, 15])
      setFlash(`LEVEL ${levelRef.current} CLEAR +${gained}`)
      setTimeout(() => {
        setFlash(null)
        if (!isRunning.current) return
        levelRef.current += 1
        setLevel(levelRef.current)
        loadLevel(levelRef.current)
      }, 1100)
    }
  }, [lit, outlets, phase, sourceKey, loadLevel])

  const best = highScores['hex-flow'] ?? 0
  const xp = Math.floor(scoreRef.current * 0.2)

  const layout = useMemo(() => computeLayout(tiles, cellRadiusFor(boardRadius)), [tiles, boardRadius])
  const litOutletCount = outlets.filter(k => lit.has(k)).length

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <div style={{ background: BOARD_BG, borderRadius: 16, padding: '10px 14px' }}>
        <svg viewBox={PREVIEW_LAYOUT.viewBox} width={130} height={92}>
          {Object.values(PREVIEW_TILES).map(t => (
            <HexTile key={t.key} tile={t} pos={PREVIEW_LAYOUT.positions[t.key]} cellR={PREVIEW_CELLR} isLit={PREVIEW_LIT.has(t.key)} />
          ))}
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>HEX FLOW</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>ROTATE PIPES · CONNECT EVERY OUTLET</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('hex-flow')) start(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', background: BG, position: 'relative', fontFamily: 'system-ui,sans-serif' }}>
      <HowToPlayOverlay bg={BG} accent="#1A1A2E" textColor="#1A1A2E" mutedColor="#999" bullets={TUTORIALS['hex-flow']} onStart={() => { markTutorialSeen('hex-flow'); start() }} />
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: ACCENT, letterSpacing: '0.22em', margin: 0 }}>TIME'S UP</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>LEVELS</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{levelsSolved}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>ROTATIONS</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{rotationsTotalRef.current}</p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{xp}</p>
      {scoreRef.current > 0 && scoreRef.current >= best && <p style={{ fontSize: 11, color: ACCENT, fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>}
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

  return (
    <div style={{ width: '100%', height: '100%', background: BOARD_BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px 4px', flexShrink: 0 }}>
        <button onClick={() => {
          if (isRunning.current) {
            isRunning.current = false
            clearInterval(timerRef.current)
            if (scoreRef.current > 0) {
              addXp(Math.floor(scoreRef.current * 0.2))
              setHighScore('hex-flow', scoreRef.current)
            }
          }
          onExit()
        }}
          style={{ background: 'none', border: 'none', color: '#5B6577', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#5B6577', margin: 0 }}>LEVEL</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#E7F6FA', margin: 0, lineHeight: 1.1 }}>{level}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#5B6577', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#E7F6FA', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#5B6577', margin: 0 }}>ROT</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#E7F6FA', margin: 0, lineHeight: 1.1 }}>{rotTotal}</p>
          </div>
        </div>
        <p style={{ fontSize: 15, fontWeight: 900, color: timeLeft <= 20 ? '#FCA5A5' : '#7DD3FC', margin: 0, minWidth: 40, textAlign: 'right' }}>{fmtTime(timeLeft)}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, height: 16, flexShrink: 0 }}>
        {outlets.map(k => (
          <div key={k} style={{
            width: 8, height: 8, borderRadius: 2, transform: 'rotate(45deg)',
            background: lit.has(k) ? STUB_LIT : 'rgba(148,163,184,0.18)',
            boxShadow: lit.has(k) ? '0 0 6px rgba(103,232,249,0.8)' : 'none',
          }} />
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: 8 }}>
        <AnimatePresence>
          {flash && (
            <motion.p key={flash} initial={{ scale: 0.6, opacity: 0, y: 6 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '6%', fontSize: 14, fontWeight: 900, color: ACCENT, letterSpacing: '0.06em', margin: 0, whiteSpace: 'nowrap' }}>
              {flash}
            </motion.p>
          )}
        </AnimatePresence>
        <p style={{ position: 'absolute', bottom: '4%', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#5B6577', margin: 0 }}>
          {litOutletCount}/{outlets.length} OUTLETS CONNECTED
        </p>

        <svg viewBox={layout.viewBox} style={{ width: '100%', maxWidth: 340, touchAction: 'manipulation' }}>
          {Object.values(tiles).map(t => {
            const pos = layout.positions[t.key]
            if (!pos) return null
            return <HexTile key={t.key} tile={t} pos={pos} cellR={cellRadiusFor(boardRadius)} isLit={lit.has(t.key)} onRotate={rotateTile} />
          })}
        </svg>
      </div>
    </div>
  )
}
