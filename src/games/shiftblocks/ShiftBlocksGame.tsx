import { useState, useRef, useCallback, useEffect } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'

const BG = '#FFF9E8'
const BOARD_BG = '#16130E'
const CELL_BG = '#211D15'
const CELL_BORDER = 'rgba(255,255,255,0.05)'
const BLOCK_COLOR = '#4A4436'
const BLOCK_BORDER = '#655C46'
const GOAL_FROM = '#FFE27A'
const GOAL_TO = '#F5A623'
const SELECTED_RING = '#7DD3FC'
const EXIT_COLOR = '#FFD54A'
const SESSION_SECONDS = 150
const GAP = 4
const BOARD_MAX_PX = 300

type Axis = 'h' | 'v'
type Side = 'left' | 'right' | 'top' | 'bottom'

interface BlockDef {
  id: string
  x: number
  y: number
  w: number
  h: number
  axis: Axis
  goal?: boolean
}

interface ExitDef {
  x: number
  y: number
  side: Side
}

interface LevelDef {
  cols: number
  rows: number
  blocks: BlockDef[]
  exit: ExitDef
  par: number
}

// ---- hand-authored level pool (every level verified solvable by construction) ----
const LEVEL_POOL: LevelDef[] = [
  {
    cols: 5, rows: 5, par: 2,
    exit: { x: 4, y: 2, side: 'right' },
    blocks: [
      { id: 'goal', x: 1, y: 2, w: 2, h: 1, axis: 'h', goal: true },
      { id: 'o1', x: 3, y: 1, w: 1, h: 2, axis: 'v' },
      { id: 'd1', x: 0, y: 0, w: 1, h: 2, axis: 'v' },
    ],
  },
  {
    cols: 5, rows: 5, par: 3,
    exit: { x: 4, y: 1, side: 'right' },
    blocks: [
      { id: 'goal', x: 0, y: 1, w: 2, h: 1, axis: 'h', goal: true },
      { id: 'o1', x: 2, y: 0, w: 1, h: 2, axis: 'v' },
      { id: 'o2', x: 3, y: 1, w: 1, h: 2, axis: 'v' },
      { id: 'd1', x: 0, y: 3, w: 2, h: 1, axis: 'h' },
    ],
  },
  {
    cols: 5, rows: 5, par: 3,
    exit: { x: 2, y: 4, side: 'bottom' },
    blocks: [
      { id: 'goal', x: 2, y: 0, w: 1, h: 2, axis: 'v', goal: true },
      { id: 'o1', x: 1, y: 2, w: 2, h: 1, axis: 'h' },
      { id: 'o2', x: 2, y: 3, w: 2, h: 1, axis: 'h' },
      { id: 'd1', x: 4, y: 0, w: 1, h: 2, axis: 'v' },
    ],
  },
  {
    cols: 6, rows: 6, par: 3,
    exit: { x: 5, y: 3, side: 'right' },
    blocks: [
      { id: 'goal', x: 1, y: 3, w: 2, h: 1, axis: 'h', goal: true },
      { id: 'o1', x: 3, y: 2, w: 1, h: 2, axis: 'v' },
      { id: 'o2', x: 4, y: 3, w: 1, h: 2, axis: 'v' },
      { id: 'd1', x: 0, y: 0, w: 2, h: 1, axis: 'h' },
      { id: 'd2', x: 0, y: 4, w: 1, h: 2, axis: 'v' },
    ],
  },
  {
    cols: 6, rows: 6, par: 4,
    exit: { x: 3, y: 5, side: 'bottom' },
    blocks: [
      { id: 'goal', x: 3, y: 0, w: 1, h: 2, axis: 'v', goal: true },
      { id: 'o1', x: 2, y: 2, w: 2, h: 1, axis: 'h' },
      { id: 'o2', x: 3, y: 3, w: 2, h: 1, axis: 'h' },
      { id: 'o3', x: 2, y: 4, w: 2, h: 1, axis: 'h' },
      { id: 'd1', x: 5, y: 0, w: 1, h: 2, axis: 'v' },
    ],
  },
  {
    cols: 6, rows: 6, par: 4,
    exit: { x: 5, y: 4, side: 'right' },
    blocks: [
      { id: 'goal', x: 0, y: 4, w: 2, h: 1, axis: 'h', goal: true },
      { id: 'o1', x: 2, y: 3, w: 1, h: 2, axis: 'v' },
      { id: 'o2', x: 3, y: 4, w: 1, h: 2, axis: 'v' },
      { id: 'o3', x: 4, y: 3, w: 1, h: 2, axis: 'v' },
      { id: 'd1', x: 4, y: 0, w: 2, h: 1, axis: 'h' },
    ],
  },
  {
    cols: 7, rows: 7, par: 5,
    exit: { x: 3, y: 6, side: 'bottom' },
    blocks: [
      { id: 'goal', x: 3, y: 0, w: 1, h: 2, axis: 'v', goal: true },
      { id: 'o1', x: 2, y: 2, w: 2, h: 1, axis: 'h' },
      { id: 'o2', x: 3, y: 3, w: 2, h: 1, axis: 'h' },
      { id: 'o3', x: 2, y: 4, w: 2, h: 1, axis: 'h' },
      { id: 'o4', x: 3, y: 5, w: 2, h: 1, axis: 'h' },
      { id: 'd1', x: 6, y: 0, w: 1, h: 2, axis: 'v' },
      { id: 'd2', x: 0, y: 5, w: 2, h: 1, axis: 'h' },
    ],
  },
  {
    cols: 7, rows: 7, par: 5,
    exit: { x: 6, y: 3, side: 'right' },
    blocks: [
      { id: 'goal', x: 0, y: 3, w: 2, h: 1, axis: 'h', goal: true },
      { id: 'o1', x: 2, y: 2, w: 1, h: 2, axis: 'v' },
      { id: 'o2', x: 3, y: 3, w: 1, h: 2, axis: 'v' },
      { id: 'o3', x: 4, y: 2, w: 1, h: 2, axis: 'v' },
      { id: 'o4', x: 5, y: 3, w: 1, h: 2, axis: 'v' },
      { id: 'd1', x: 0, y: 0, w: 2, h: 1, axis: 'h' },
      { id: 'd2', x: 0, y: 5, w: 1, h: 2, axis: 'v' },
    ],
  },
]

function cloneLevel(lv: LevelDef): LevelDef {
  return { ...lv, blocks: lv.blocks.map(b => ({ ...b })), exit: { ...lv.exit } }
}

// Deterministically-safe procedural growth: never places a new block on the goal's
// travel row/column, so every hand-authored solution path stays intact.
function extendLevel(base: LevelDef, growth: number): LevelDef {
  const MAX_DIM = 9
  const cols = Math.min(MAX_DIM, base.cols + growth)
  const rows = Math.min(MAX_DIM, base.rows + growth)
  const blocks = base.blocks.map(b => ({ ...b }))
  const goal = blocks.find(b => b.goal)
  if (!goal) return { cols, rows, blocks, exit: { ...base.exit }, par: base.par }

  const exit: ExitDef = { ...base.exit }
  if (exit.side === 'right') exit.x = cols - 1
  if (exit.side === 'bottom') exit.y = rows - 1

  const criticalRow = goal.axis === 'h' ? goal.y : -1
  const criticalCol = goal.axis === 'v' ? goal.x : -1
  const occupied = (x: number, y: number) => blocks.some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)

  const extraCount = Math.min(4, growth + 1)
  let placed = 0
  let attempts = 0
  while (placed < extraCount && attempts < 80) {
    attempts++
    const axis: Axis = Math.random() < 0.5 ? 'h' : 'v'
    const w = axis === 'h' ? 2 : 1
    const h = axis === 'v' ? 2 : 1
    const x = Math.floor(Math.random() * (cols - w + 1))
    const y = Math.floor(Math.random() * (rows - h + 1))
    if (criticalCol >= x && criticalCol <= x + w - 1) continue
    if (criticalRow >= y && criticalRow <= y + h - 1) continue
    let free = true
    for (let cx = x; cx < x + w && free; cx++) {
      for (let cy = y; cy < y + h && free; cy++) {
        if (occupied(cx, cy)) free = false
      }
    }
    if (!free) continue
    blocks.push({ id: `ext-${growth}-${placed}`, x, y, w, h, axis })
    placed++
  }
  return { cols, rows, blocks, exit, par: base.par }
}

function levelForIndex(index: number): LevelDef {
  const cycle = Math.floor(index / LEVEL_POOL.length)
  const base = LEVEL_POOL[index % LEVEL_POOL.length]
  if (cycle === 0) return cloneLevel(base)
  return extendLevel(base, cycle)
}

function rectsOverlap(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
}

function computeMaxSlide(block: BlockDef, dir: 1 | -1, blocks: BlockDef[], cols: number, rows: number): number {
  let dist = 0
  while (true) {
    const next = dist + 1
    const nx = block.axis === 'h' ? block.x + dir * next : block.x
    const ny = block.axis === 'v' ? block.y + dir * next : block.y
    if (nx < 0 || ny < 0 || nx + block.w > cols || ny + block.h > rows) break
    let blocked = false
    for (const other of blocks) {
      if (other.id === block.id) continue
      if (rectsOverlap(nx, ny, block.w, block.h, other.x, other.y, other.w, other.h)) { blocked = true; break }
    }
    if (blocked) break
    dist = next
  }
  return dist
}

function goalCoversExit(goal: BlockDef, exit: ExitDef): boolean {
  return exit.x >= goal.x && exit.x < goal.x + goal.w && exit.y >= goal.y && exit.y < goal.y + goal.h
}

function getCellSize(cols: number): number {
  return Math.max(24, Math.min(54, Math.floor((BOARD_MAX_PX - (cols - 1) * GAP) / cols)))
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

let _ac: AudioContext | null = null
function snd(type: 'slide' | 'clear' | 'blocked' | 'over') {
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
    if (type === 'slide')   n(340, t, 0.09, 0.05, 'triangle')
    if (type === 'blocked') n(150, t, 0.12, 0.09, 'square')
    if (type === 'clear')   [600, 800, 1050, 1350].forEach((f, i) => n(f, t + i * 0.06, 0.12, 0.08))
    if (type === 'over')    { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

export default function ShiftBlocksGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')

  const [level, setLevel] = useState<LevelDef>(() => levelForIndex(0))
  const [blocks, setBlocks] = useState<BlockDef[]>(() => level.blocks.map(b => ({ ...b })))
  const [selected, setSelected] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragPx, setDragPx] = useState(0)
  const [levelIndex, setLevelIndex] = useState(0)
  const [levelMoves, setLevelMoves] = useState(0)
  const [totalMoves, setTotalMoves] = useState(0)
  const [score, setScore] = useState(0)
  const [levelsSolved, setLevelsSolved] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SESSION_SECONDS)
  const [solvedFlash, setSolvedFlash] = useState(false)
  const [shakeToken, setShakeToken] = useState(0)

  const levelRef = useRef(level)
  const blocksRef = useRef(blocks)
  const selectedRef = useRef<string | null>(null)
  const levelIndexRef = useRef(0)
  const levelMovesRef = useRef(0)
  const totalMovesRef = useRef(0)
  const scoreRef = useRef(0)
  const levelsSolvedRef = useRef(0)
  const timeLeftRef = useRef(SESSION_SECONDS)
  const initialBlocksRef = useRef<BlockDef[]>(blocks.map(b => ({ ...b })))
  const levelStartRef = useRef(0)
  const isRunning = useRef(false)
  const sessionActive = useRef(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const sessionTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)

  const setSelectedBoth = useCallback((id: string | null) => { selectedRef.current = id; setSelected(id) }, [])

  const doEnd = useCallback(() => {
    if (!sessionActive.current) return
    sessionActive.current = false
    isRunning.current = false
    clearInterval(sessionTimer.current)
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.25))
    setHighScore('shift-blocks', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const shakeBoard = useCallback(() => {
    snd('blocked'); vibrate(20)
    setShakeToken(t => t + 1)
  }, [])

  const goToNextLevel = useCallback(() => {
    const nextIndex = levelIndexRef.current + 1
    levelIndexRef.current = nextIndex; setLevelIndex(nextIndex)
    const lv = levelForIndex(nextIndex)
    levelRef.current = lv; setLevel(lv)
    const initBlocks = lv.blocks.map(b => ({ ...b }))
    blocksRef.current = initBlocks; setBlocks(initBlocks)
    initialBlocksRef.current = initBlocks.map(b => ({ ...b }))
    levelMovesRef.current = 0; setLevelMoves(0)
    levelStartRef.current = Date.now()
    setSelectedBoth(null)
    isRunning.current = true
  }, [setSelectedBoth])

  const handleLevelSolved = useCallback(() => {
    isRunning.current = false
    snd('clear'); vibrate([15, 30, 15])
    const elapsedS = (Date.now() - levelStartRef.current) / 1000
    const par = levelRef.current.par
    const moveBonus = Math.max(0, (par * 2 - levelMovesRef.current)) * 15
    const timeBonus = Math.max(0, Math.floor(30 - elapsedS)) * 3
    const gained = 200 + moveBonus + timeBonus
    scoreRef.current += gained; setScore(scoreRef.current)
    levelsSolvedRef.current += 1; setLevelsSolved(levelsSolvedRef.current)
    setSolvedFlash(true)
    setTimeout(() => {
      setSolvedFlash(false)
      if (!sessionActive.current) return
      goToNextLevel()
    }, 850)
  }, [goToNextLevel])

  const commitMove = useCallback((id: string, cellsMoved: number) => {
    if (!isRunning.current || cellsMoved === 0) return
    const cur = blocksRef.current
    const next = cur.map(b => b.id === id
      ? { ...b, x: b.axis === 'h' ? b.x + cellsMoved : b.x, y: b.axis === 'v' ? b.y + cellsMoved : b.y }
      : b)
    blocksRef.current = next
    setBlocks(next)
    levelMovesRef.current += 1; setLevelMoves(levelMovesRef.current)
    totalMovesRef.current += 1; setTotalMoves(totalMovesRef.current)
    snd('slide'); vibrate(8)

    const goal = next.find(b => b.goal)
    if (goal && goalCoversExit(goal, levelRef.current.exit)) {
      handleLevelSolved()
    }
  }, [handleLevelSolved])

  const start = useCallback(() => {
    scoreRef.current = 0; totalMovesRef.current = 0; levelsSolvedRef.current = 0; levelIndexRef.current = 0
    setScore(0); setTotalMoves(0); setLevelsSolved(0); setLevelIndex(0)
    const lv = levelForIndex(0)
    levelRef.current = lv; setLevel(lv)
    const initBlocks = lv.blocks.map(b => ({ ...b }))
    blocksRef.current = initBlocks; setBlocks(initBlocks)
    initialBlocksRef.current = initBlocks.map(b => ({ ...b }))
    levelMovesRef.current = 0; setLevelMoves(0)
    levelStartRef.current = Date.now()
    timeLeftRef.current = SESSION_SECONDS; setTimeLeft(SESSION_SECONDS)
    setSelectedBoth(null); setSolvedFlash(false)
    isRunning.current = true
    sessionActive.current = true
    setPhase('play')
  }, [setSelectedBoth])

  const resetLevel = useCallback(() => {
    if (!isRunning.current) return
    const init = initialBlocksRef.current.map(b => ({ ...b }))
    blocksRef.current = init; setBlocks(init)
    totalMovesRef.current = Math.max(0, totalMovesRef.current - levelMovesRef.current); setTotalMoves(totalMovesRef.current)
    levelMovesRef.current = 0; setLevelMoves(0)
    levelStartRef.current = Date.now()
    setSelectedBoth(null)
  }, [setSelectedBoth])

  // session countdown
  useEffect(() => {
    if (phase !== 'play') return
    sessionTimer.current = setInterval(() => {
      timeLeftRef.current -= 1
      if (timeLeftRef.current <= 0) {
        timeLeftRef.current = 0
        setTimeLeft(0)
        doEnd()
        return
      }
      setTimeLeft(timeLeftRef.current)
    }, 1000)
    return () => clearInterval(sessionTimer.current)
  }, [phase, doEnd])

  useEffect(() => () => { isRunning.current = false; sessionActive.current = false; clearInterval(sessionTimer.current) }, [])

  const onBlockPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>, block: BlockDef) => {
    if (!isRunning.current) return
    e.preventDefault(); e.stopPropagation()
    setSelectedBoth(block.id)

    const lv = levelRef.current
    const maxNeg = computeMaxSlide(block, -1, blocksRef.current, lv.cols, lv.rows)
    const maxPos = computeMaxSlide(block, 1, blocksRef.current, lv.cols, lv.rows)
    const step = getCellSize(lv.cols) + GAP
    const startX = e.clientX, startY = e.clientY
    let currentPx = 0
    let maxRawMove = 0

    setDragId(block.id); setDragPx(0)

    const move = (ev: PointerEvent) => {
      const raw = block.axis === 'h' ? ev.clientX - startX : ev.clientY - startY
      maxRawMove = Math.max(maxRawMove, Math.abs(raw))
      const clamped = Math.max(-maxNeg * step, Math.min(maxPos * step, raw))
      currentPx = clamped
      setDragPx(clamped)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragId(null); setDragPx(0)
      const cellsMoved = Math.round(currentPx / step)
      if (cellsMoved !== 0) {
        commitMove(block.id, cellsMoved)
      } else if (maxRawMove > 10) {
        shakeBoard()
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [commitMove, setSelectedBoth, shakeBoard])

  const onBoardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isRunning.current) return
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return
    const lv = levelRef.current
    const step = getCellSize(lv.cols) + GAP
    const cellX = Math.floor((e.clientX - rect.left) / step)
    const cellY = Math.floor((e.clientY - rect.top) / step)
    const sel = blocksRef.current.find(b => b.id === selectedRef.current)
    if (!sel) return

    let dir: 1 | -1 | 0 = 0
    let inLine = false
    if (sel.axis === 'h' && cellY === sel.y) {
      inLine = true
      dir = cellX < sel.x ? -1 : cellX >= sel.x + sel.w ? 1 : 0
    } else if (sel.axis === 'v' && cellX === sel.x) {
      inLine = true
      dir = cellY < sel.y ? -1 : cellY >= sel.y + sel.h ? 1 : 0
    }

    if (!inLine) { setSelectedBoth(null); return }
    if (dir === 0) { setSelectedBoth(null); return }

    const maxSlide = computeMaxSlide(sel, dir, blocksRef.current, lv.cols, lv.rows)
    if (maxSlide > 0) {
      commitMove(sel.id, dir * maxSlide)
    } else {
      shakeBoard()
    }
  }, [commitMove, setSelectedBoth, shakeBoard])

  const best = highScores['shift-blocks'] ?? 0
  const xp = Math.floor(score * 0.25)

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>

      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(5,24px)', gridTemplateRows: 'repeat(4,24px)', gap: 3, padding: 6, background: BOARD_BG, borderRadius: 10 }}>
        {Array.from({ length: 20 }, (_, i) => <div key={i} style={{ width: 24, height: 24, borderRadius: 5, background: CELL_BG }} />)}
        <div style={{ position: 'absolute', left: 6 + 2 * 27, top: 6 + 1 * 27, width: 24 * 2 + 3, height: 24, borderRadius: 5, background: '#3a3428', border: `1.5px solid ${BLOCK_BORDER}` }} />
        <div style={{ position: 'absolute', left: 6 + 0, top: 6 + 2 * 27, width: 24, height: 24 * 2 + 3, borderRadius: 5, background: '#3a3428', border: `1.5px solid ${BLOCK_BORDER}` }} />
        <div style={{ position: 'absolute', left: 6 + 3 * 27, top: 6 + 3 * 27, width: 24 * 2 + 3, height: 24, borderRadius: 5, background: `linear-gradient(135deg, ${GOAL_FROM}, ${GOAL_TO})`, boxShadow: `0 0 10px ${EXIT_COLOR}` }} />
        <div style={{ position: 'absolute', right: -6, top: 6 + 3 * 27, width: 6, height: 24, borderRadius: '0 4px 4px 0', background: EXIT_COLOR, boxShadow: `0 0 8px ${EXIT_COLOR}` }} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>SHIFT BLOCKS</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>SLIDE THE GOLD BLOCK TO THE EXIT</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={start}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>SESSION OVER</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>LEVELS</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{levelsSolved}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>MOVES</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{totalMoves}</p>
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

  const cellSize = getCellSize(level.cols)
  const step = cellSize + GAP
  const boardWidth = level.cols * cellSize + (level.cols - 1) * GAP
  const boardHeight = level.rows * cellSize + (level.rows - 1) * GAP

  const exitStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = { position: 'absolute', background: EXIT_COLOR, boxShadow: `0 0 10px ${EXIT_COLOR}` }
    if (level.exit.side === 'right') return { ...base, right: -6, top: level.exit.y * step, width: 6, height: cellSize, borderRadius: '0 4px 4px 0' }
    if (level.exit.side === 'left') return { ...base, left: -6, top: level.exit.y * step, width: 6, height: cellSize, borderRadius: '4px 0 0 4px' }
    if (level.exit.side === 'top') return { ...base, top: -6, left: level.exit.x * step, height: 6, width: cellSize, borderRadius: '4px 4px 0 0' }
    return { ...base, bottom: -6, left: level.exit.x * step, height: 6, width: cellSize, borderRadius: '0 0 4px 4px' }
  })()

  return (
    <div style={{ width: '100%', height: '100%', background: BOARD_BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px 2px', flexShrink: 0 }}>
        <button onClick={() => { sessionActive.current = false; isRunning.current = false; clearInterval(sessionTimer.current); onExit() }} style={{ background: 'none', border: 'none', color: '#8A8270', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#8A8270', margin: 0 }}>TIME</p>
          <p style={{ fontSize: 15, fontWeight: 900, color: timeLeft <= 20 ? '#FF6B6B' : BG, margin: 0, lineHeight: 1.1 }}>{formatTime(timeLeft)}</p>
        </div>
        <button onClick={resetLevel} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: BG, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', borderRadius: 10, padding: '7px 12px', cursor: 'pointer' }}>
          RESET
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, padding: '4px 0 10px', flexShrink: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#8A8270', margin: 0 }}>SCORE</p>
          <p style={{ fontSize: 17, fontWeight: 900, color: BG, margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#8A8270', margin: 0 }}>MOVES</p>
          <p style={{ fontSize: 17, fontWeight: 900, color: BG, margin: 0, lineHeight: 1.1 }}>{levelMoves}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#8A8270', margin: 0 }}>LEVEL</p>
          <p style={{ fontSize: 17, fontWeight: 900, color: BG, margin: 0, lineHeight: 1.1 }}>{levelIndex + 1}</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <AnimatePresence>
          {solvedFlash && (
            <motion.div key={levelIndex} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, scale: 1.1 }}
              style={{ position: 'absolute', top: '14%', zIndex: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: EXIT_COLOR, letterSpacing: '0.1em', margin: 0, textShadow: `0 0 14px ${EXIT_COLOR}` }}>LEVEL CLEAR</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          key={shakeToken}
          animate={shakeToken > 0 ? { x: [0, -7, 7, -5, 5, 0] } : {}}
          transition={{ duration: 0.32 }}
          style={{ position: 'relative' }}
        >
          <div
            ref={boardRef}
            onClick={onBoardClick}
            style={{ position: 'relative', width: boardWidth, height: boardHeight, touchAction: 'none' }}
          >
            {Array.from({ length: level.cols * level.rows }, (_, i) => {
              const cx = i % level.cols, cy = Math.floor(i / level.cols)
              return (
                <div key={i} style={{
                  position: 'absolute', left: cx * step, top: cy * step, width: cellSize, height: cellSize,
                  borderRadius: 7, background: CELL_BG, border: `1px solid ${CELL_BORDER}`,
                }} />
              )
            })}

            <div style={exitStyle} />

            {blocks.map(b => {
              const isDragging = dragId === b.id
              const isSelected = selected === b.id
              const baseLeft = b.x * step
              const baseTop = b.y * step
              const left = isDragging && b.axis === 'h' ? baseLeft + dragPx : baseLeft
              const top = isDragging && b.axis === 'v' ? baseTop + dragPx : baseTop
              const w = b.w * cellSize + (b.w - 1) * GAP
              const h = b.h * cellSize + (b.h - 1) * GAP
              return (
                <motion.div
                  key={b.id}
                  onPointerDown={e => onBlockPointerDown(e, b)}
                  onClick={e => e.stopPropagation()}
                  animate={{ left, top }}
                  transition={isDragging ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', width: w, height: h, borderRadius: 9,
                    background: b.goal ? `linear-gradient(135deg, ${GOAL_FROM}, ${GOAL_TO})` : BLOCK_COLOR,
                    border: `2px solid ${isSelected ? SELECTED_RING : b.goal ? '#FFE9A8' : BLOCK_BORDER}`,
                    boxShadow: b.goal ? `0 0 16px rgba(245,166,35,0.55)` : isSelected ? `0 0 0 2px rgba(125,211,252,0.35)` : '0 2px 6px rgba(0,0,0,0.4)',
                    touchAction: 'none', cursor: 'grab', zIndex: b.goal ? 5 : isDragging ? 10 : 1,
                  }}
                />
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
