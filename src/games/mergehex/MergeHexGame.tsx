import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TouchEvent as ReactTouchEvent } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'

const BG = '#FFF9E8'
const BOARD_BG = '#0C0A06'

// ---------------------------------------------------------------------------
// Hex geometry (cube coordinates, radius-2 hexagon = 19 cells, pointy-top)
// ---------------------------------------------------------------------------

interface Cube { x: number; y: number; z: number }
interface Tile extends Cube { id: number; value: number }

const RADIUS = 2
const HEX_R = 34
const TILE_W = HEX_R * Math.sqrt(3)
const TILE_H = HEX_R * 2
const HEX_CLIP = 'polygon(50% 0%, 75% 25%, 75% 75%, 50% 100%, 25% 75%, 25% 25%)'

function cellKey(c: Cube) { return `${c.x},${c.y},${c.z}` }

const CELLS: Cube[] = (() => {
  const arr: Cube[] = []
  for (let x = -RADIUS; x <= RADIUS; x++) {
    const y1 = Math.max(-RADIUS, -x - RADIUS)
    const y2 = Math.min(RADIUS, -x + RADIUS)
    for (let y = y1; y <= y2; y++) arr.push({ x, y, z: -x - y })
  }
  return arr
})()

function hexCenter(c: Cube) {
  const px = HEX_R * Math.sqrt(3) * (c.x + c.z / 2)
  const py = HEX_R * 1.5 * c.z
  return { px, py }
}

const CENTERS = CELLS.map(hexCenter)
const MIN_PX = Math.min(...CENTERS.map(p => p.px))
const MIN_PY = Math.min(...CENTERS.map(p => p.py))
const OFFSET_X = -MIN_PX + TILE_W / 2
const OFFSET_Y = -MIN_PY + HEX_R
const BOARD_W = Math.max(...CENTERS.map(p => p.px)) - MIN_PX + TILE_W
const BOARD_H = Math.max(...CENTERS.map(p => p.py)) - MIN_PY + HEX_R * 2

// 6 axial directions in cube space, and their approximate screen angle (deg)
// for pointy-top hex layout — used to snap swipe gestures to a direction.
const DIRS: Cube[] = [
  { x: 1, y: -1, z: 0 },
  { x: 1, y: 0, z: -1 },
  { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 },
  { x: -1, y: 0, z: 1 },
  { x: 0, y: -1, z: 1 },
]
const DIR_ANGLES = [0, -60, -120, 180, 120, 60]

function computeLines(dir: Cube): Cube[][] {
  const invariantAxis: 'x' | 'y' | 'z' = dir.x === 0 ? 'x' : dir.y === 0 ? 'y' : 'z'
  const sortAxis: 'x' | 'y' | 'z' = invariantAxis !== 'x' ? 'x' : 'y'
  const groups = new Map<number, Cube[]>()
  for (const c of CELLS) {
    const key = c[invariantAxis]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  const lines: Cube[][] = []
  groups.forEach(g => {
    g.sort((a, b) => (dir[sortAxis] > 0 ? b[sortAxis] - a[sortAxis] : a[sortAxis] - b[sortAxis]))
    lines.push(g)
  })
  return lines
}
const LINES_BY_DIR: Cube[][][] = DIRS.map(computeLines)

function emptyCells(tiles: Tile[]): Cube[] {
  const occupied = new Set(tiles.map(cellKey))
  return CELLS.filter(c => !occupied.has(cellKey(c)))
}

let _uid = 1
const nextId = () => _uid++

function spawnTile(tiles: Tile[]): Tile[] {
  const empties = emptyCells(tiles)
  if (empties.length === 0) return tiles
  const cell = empties[Math.floor(Math.random() * empties.length)]
  const fillRatio = tiles.length / CELLS.length
  const fourChance = fillRatio > 0.7 ? 0.06 : 0.1
  const value = Math.random() < fourChance ? 4 : 2
  return [...tiles, { id: nextId(), x: cell.x, y: cell.y, z: cell.z, value }]
}

interface MoveResult { tiles: Tile[]; scoreGain: number; changed: boolean; maxMerge: number; mergeCount: number }

function applyMove(tiles: Tile[], dirIndex: number): MoveResult {
  const byKey = new Map(tiles.map(t => [cellKey(t), t]))
  const newTiles: Tile[] = []
  let scoreGain = 0, changed = false, maxMerge = 0, mergeCount = 0

  for (const line of LINES_BY_DIR[dirIndex]) {
    const occupied = line.map(pos => byKey.get(cellKey(pos))).filter((t): t is Tile => !!t)
    const merged: Tile[] = []
    let i = 0
    while (i < occupied.length) {
      const cur = occupied[i]
      const nxt = occupied[i + 1]
      if (nxt && nxt.value === cur.value) {
        const newVal = cur.value * 2
        merged.push({ id: cur.id, value: newVal, x: cur.x, y: cur.y, z: cur.z })
        scoreGain += newVal
        maxMerge = Math.max(maxMerge, newVal)
        mergeCount++
        i += 2
      } else {
        merged.push({ ...cur })
        i += 1
      }
    }
    merged.forEach((t, idx) => {
      const pos = line[idx]
      if (t.x !== pos.x || t.y !== pos.y || t.z !== pos.z) changed = true
      t.x = pos.x; t.y = pos.y; t.z = pos.z
    })
    if (merged.length !== occupied.length) changed = true
    newTiles.push(...merged)
  }
  return { tiles: newTiles, scoreGain, changed, maxMerge, mergeCount }
}

function canMove(tiles: Tile[]): boolean {
  if (emptyCells(tiles).length > 0) return true
  for (let d = 0; d < 6; d++) if (applyMove(tiles, d).changed) return true
  return false
}

const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  2:    { bg: '#3A2E1F', fg: '#D9C9A8' },
  4:    { bg: '#4A3820', fg: '#E8D4A8' },
  8:    { bg: '#6B4E23', fg: '#FFE9BE' },
  16:   { bg: '#8A6226', fg: '#FFF2CC' },
  32:   { bg: '#AD7A24', fg: '#FFF6DD' },
  64:   { bg: '#CC9420', fg: '#FFFFFF' },
  128:  { bg: '#E3AC1C', fg: '#FFFFFF' },
  256:  { bg: '#F0C020', fg: '#2A1E08' },
  512:  { bg: '#FFD23F', fg: '#2A1E08' },
  1024: { bg: '#FFDE6E', fg: '#2A1E08' },
  2048: { bg: '#FFEA9E', fg: '#2A1E08' },
  4096: { bg: '#FFF6D2', fg: '#2A1E08' },
}
function tileColor(v: number) { return TILE_COLORS[v] ?? { bg: '#FFFDF5', fg: '#2A1E08' } }
function tileFontSize(v: number) { return v < 100 ? 19 : v < 1000 ? 16 : v < 10000 ? 13 : 11 }

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

let _ac: AudioContext | null = null
function snd(type: 'merge' | 'invalid' | 'over') {
  if (soundMuted) return
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const n = (f: number, at: number, d: number, v: number, o: OscillatorType = 'sine') => {
      const osc = c.createOscillator(), g = c.createGain()
      osc.type = o; osc.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.001, at + d)
      osc.connect(g); g.connect(c.destination); osc.start(at); osc.stop(at + d)
    }
    if (type === 'merge')   [520, 700, 940].forEach((f, i) => n(f, t + i * 0.045, 0.11, 0.07))
    if (type === 'invalid') n(160, t, 0.09, 0.05, 'sawtooth')
    if (type === 'over')    { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MergeHexGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [tiles, setTiles] = useState<Tile[]>([])
  const [score, setScore] = useState(0)
  const [highestTile, setHighestTile] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [popup, setPopup] = useState<{ id: number; text: string } | null>(null)

  const tilesRef = useRef<Tile[]>([])
  const scoreRef = useRef(0)
  const highestRef = useRef(0)
  const busyRef = useRef(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const popupId = useRef(0)

  const doEnd = useCallback(() => {
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.15))
    setHighScore('merge-hex', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const startGame = useCallback(() => {
    let t: Tile[] = []
    t = spawnTile(t)
    t = spawnTile(t)
    tilesRef.current = t
    scoreRef.current = 0
    highestRef.current = t.reduce((m, x) => Math.max(m, x.value), 0)
    busyRef.current = false
    touchStart.current = null
    setTiles(t); setScore(0); setHighestTile(highestRef.current); setMoveCount(0); setPopup(null)
    setPhase('play')
  }, [])

  const move = useCallback((dirIndex: number) => {
    if (phase !== 'play' || busyRef.current) return
    const result = applyMove(tilesRef.current, dirIndex)
    if (!result.changed) {
      snd('invalid'); vibrate(6)
      return
    }
    busyRef.current = true
    const spawned = spawnTile(result.tiles)
    tilesRef.current = spawned
    scoreRef.current += result.scoreGain
    const newHighest = spawned.reduce((m, x) => Math.max(m, x.value), highestRef.current)
    highestRef.current = newHighest

    setTiles(spawned); setScore(scoreRef.current); setHighestTile(newHighest)
    setMoveCount(m => m + 1)

    if (result.mergeCount > 0) {
      snd('merge')
      vibrate(result.maxMerge >= 128 ? [20, 30, 20] : result.maxMerge >= 32 ? 18 : 10)
      popupId.current++
      const id = popupId.current
      setPopup({ id, text: `+${result.scoreGain}` })
      setTimeout(() => setPopup(p => (p && p.id === id ? null : p)), 700)
    } else {
      vibrate(5)
    }

    setTimeout(() => {
      busyRef.current = false
      if (!canMove(tilesRef.current)) doEnd()
    }, 160)
  }, [phase, doEnd])

  useEffect(() => {
    if (phase !== 'play') return
    const KEY_DIR: Record<string, number> = {
      ArrowRight: 0, d: 0, D: 0,
      ArrowUp: 1, e: 1, E: 1,
      q: 2, Q: 2,
      ArrowLeft: 3, a: 3, A: 3,
      ArrowDown: 4, z: 4, Z: 4,
      c: 5, C: 5,
    }
    const handler = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key]
      if (dir !== undefined) { e.preventDefault(); move(dir) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, move])

  const handleTouchStart = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }, [])

  const handleTouchEnd = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.hypot(dx, dy) < 24) return
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    let best = 0, bestDiff = Infinity
    DIR_ANGLES.forEach((a, i) => {
      let diff = Math.abs(angle - a)
      if (diff > 180) diff = 360 - diff
      if (diff < bestDiff) { bestDiff = diff; best = i }
    })
    move(best)
  }, [move])

  const best = highScores['merge-hex'] ?? 0
  const xp = Math.floor(score * 0.15)

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <div style={{ display: 'flex', gap: 6 }}>
        {[2, 4, 8].map(v => {
          const c = tileColor(v)
          return (
            <div key={v} style={{ width: 44, height: 50, clipPath: HEX_CLIP, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontWeight: 900, color: c.fg, fontSize: 16 }}>{v}</span>
            </div>
          )
        })}
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>MERGE HEX</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>2048 ON A HEXAGONAL GRID</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={startGame}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>GAME OVER</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>HIGHEST TILE</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{highestTile.toLocaleString()}</p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{xp}</p>
      {score > 0 && score >= best && <p style={{ fontSize: 11, color: '#E9B213', fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <motion.button whileTap={{ scale: 0.96 }} onClick={startGame}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 4px', flexShrink: 0 }}>
        <button onClick={() => { busyRef.current = true; onExit() }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>SCORE</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: '#FFE9BE', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>BEST TILE</p>
          <div style={{ padding: '2px 10px', borderRadius: 8, background: tileColor(highestTile).bg }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: tileColor(highestTile).fg }}>{highestTile}</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, position: 'relative' }}>
        <AnimatePresence>
          {popup && (
            <motion.p key={popup.id} initial={{ y: 6, opacity: 0, scale: 0.8 }} animate={{ y: -34, opacity: 1, scale: 1.15 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '14%', fontSize: 16, fontWeight: 900, color: '#FFD23F', letterSpacing: '0.04em', margin: 0, pointerEvents: 'none' }}>
              {popup.text}
            </motion.p>
          )}
        </AnimatePresence>

        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ position: 'relative', width: BOARD_W, height: BOARD_H, touchAction: 'none' }}
        >
          {CELLS.map(c => {
            const { px, py } = hexCenter(c)
            return (
              <div key={cellKey(c)} style={{
                position: 'absolute', left: px + OFFSET_X - TILE_W / 2, top: py + OFFSET_Y - TILE_H / 2,
                width: TILE_W, height: TILE_H, clipPath: HEX_CLIP, background: 'rgba(255,255,255,0.04)',
              }} />
            )
          })}
          <AnimatePresence>
            {tiles.map(t => {
              const { px, py } = hexCenter(t)
              const col = tileColor(t.value)
              const left = px + OFFSET_X - TILE_W / 2
              const top = py + OFFSET_Y - TILE_H / 2
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, scale: 0.3, left, top }}
                  animate={{ opacity: 1, scale: 1, left, top }}
                  exit={{ opacity: 0, scale: 0.15 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  style={{
                    position: 'absolute', width: TILE_W, height: TILE_H, clipPath: HEX_CLIP,
                    background: col.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: t.value >= 128 ? `0 0 16px ${col.bg}aa` : 'none',
                  }}
                >
                  <span style={{ fontWeight: 900, color: col.fg, fontSize: tileFontSize(t.value) }}>{t.value}</span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {moveCount < 3 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', margin: 0, textAlign: 'center', maxWidth: 240 }}>
              SWIPE IN ANY OF 6 DIRECTIONS TO SLIDE &amp; MERGE TILES
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
