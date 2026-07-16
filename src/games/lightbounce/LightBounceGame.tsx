import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gem, ArrowRight, RotateCcw } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'

const BG = '#FFF9E8'
const BOARD_BG = '#0C0A06'
const SESSION_SECONDS = 150
const BEAM_COLOR = '#7DD3FC'
const BEAM_COLOR_SOLVED = '#FDE68A'
const MIRROR_COLOR = '#93C5FD'

// 0 = right, 1 = down, 2 = left, 3 = up
type Dir = 0 | 1 | 2 | 3
type Mirror = '/' | '\\'
const DIR_VEC: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]]

function reflectDir(dir: Dir, mirror: Mirror): Dir {
  const slash: Record<Dir, Dir> = { 0: 3, 3: 0, 2: 1, 1: 2 }
  const backslash: Record<Dir, Dir> = { 0: 1, 1: 0, 2: 3, 3: 2 }
  return mirror === '/' ? slash[dir] : backslash[dir]
}

interface LevelSeed {
  size: number
  source: { r: number; c: number; dir: Dir }
  walls: [number, number][]
  crystals: [number, number][]
  mirrorBudget: number
  minMirrors: number
}

interface LevelDef {
  size: number
  source: { r: number; c: number; dir: Dir }
  walls: [number, number][]
  crystals: [number, number][]
  mirrorBudget: number
}

// Hand-authored levels, each verified solvable within its mirror budget.
const LEVEL_POOL: LevelSeed[] = [
  { size: 5, source: { r: 2, c: 0, dir: 0 }, walls: [], crystals: [[0, 4]], mirrorBudget: 2, minMirrors: 1 },
  { size: 5, source: { r: 4, c: 0, dir: 0 }, walls: [], crystals: [[2, 3], [1, 1]], mirrorBudget: 3, minMirrors: 2 },
  { size: 5, source: { r: 0, c: 0, dir: 0 }, walls: [], crystals: [[1, 1], [2, 3]], mirrorBudget: 3, minMirrors: 2 },
  { size: 6, source: { r: 3, c: 0, dir: 0 }, walls: [[3, 4], [1, 2]], crystals: [[3, 2], [0, 5]], mirrorBudget: 3, minMirrors: 2 },
  { size: 6, source: { r: 5, c: 0, dir: 0 }, walls: [[1, 4]], crystals: [[5, 3], [3, 2], [3, 1]], mirrorBudget: 3, minMirrors: 2 },
  { size: 7, source: { r: 6, c: 0, dir: 0 }, walls: [[1, 5]], crystals: [[6, 4], [3, 3], [3, 2]], mirrorBudget: 3, minMirrors: 2 },
  { size: 7, source: { r: 0, c: 0, dir: 0 }, walls: [[0, 5]], crystals: [[0, 3], [4, 4], [5, 6]], mirrorBudget: 2, minMirrors: 2 },
  { size: 7, source: { r: 3, c: 0, dir: 0 }, walls: [[1, 2]], crystals: [[3, 2], [2, 3], [1, 5]], mirrorBudget: 2, minMirrors: 2 },
]

function rotateSeed(seed: LevelSeed, times: number): LevelSeed {
  let cur = seed
  for (let i = 0; i < times; i++) {
    const s = cur.size
    const rp = ([r, c]: [number, number]): [number, number] => [c, s - 1 - r]
    const [sr, sc] = rp([cur.source.r, cur.source.c])
    cur = {
      size: s,
      source: { r: sr, c: sc, dir: ((cur.source.dir + 1) % 4) as Dir },
      walls: cur.walls.map(rp),
      crystals: cur.crystals.map(rp),
      mirrorBudget: cur.mirrorBudget,
      minMirrors: cur.minMirrors,
    }
  }
  return cur
}

function genLevel(index: number): LevelDef {
  const seed = LEVEL_POOL[index % LEVEL_POOL.length]
  const cycle = Math.floor(index / LEVEL_POOL.length)
  const rotated = rotateSeed(seed, cycle % 4)
  const slack = rotated.mirrorBudget - rotated.minMirrors
  const reduction = Math.min(cycle, slack)
  return {
    size: rotated.size,
    source: rotated.source,
    walls: rotated.walls,
    crystals: rotated.crystals,
    mirrorBudget: rotated.mirrorBudget - reduction,
  }
}

interface BeamResult {
  path: { r: number; c: number }[]
  hit: Set<string>
  exitDir: Dir | null
}

function simulateBeam(level: LevelDef, mirrors: Record<string, Mirror>): BeamResult {
  const wallSet = new Set(level.walls.map(([r, c]) => `${r}_${c}`))
  const crystalSet = new Set(level.crystals.map(([r, c]) => `${r}_${c}`))
  const hit = new Set<string>()
  const path: { r: number; c: number }[] = []
  let r = level.source.r, c = level.source.c, dir = level.source.dir
  let steps = 0
  let exitDir: Dir | null = null
  const maxSteps = level.size * level.size * 4
  while (r >= 0 && r < level.size && c >= 0 && c < level.size && steps < maxSteps) {
    const key = `${r}_${c}`
    if (wallSet.has(key)) break
    path.push({ r, c })
    if (crystalSet.has(key)) hit.add(key)
    const m = mirrors[key]
    if (m) dir = reflectDir(dir, m)
    const [dr, dc] = DIR_VEC[dir]
    const nr = r + dr, nc = c + dc
    if (nr < 0 || nr >= level.size || nc < 0 || nc >= level.size) exitDir = dir
    r = nr; c = nc
    steps++
  }
  return { path, hit, exitDir }
}

function cellKey(r: number, c: number) { return `${r}_${c}` }

let _ac: AudioContext | null = null
function snd(type: 'place' | 'remove' | 'blocked' | 'crystal' | 'clear' | 'over') {
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
    if (type === 'place')   n(520, t, 0.08, 0.06, 'triangle')
    if (type === 'remove')  n(340, t, 0.07, 0.05, 'triangle')
    if (type === 'blocked') n(160, t, 0.12, 0.09, 'square')
    if (type === 'crystal') [880, 1180].forEach((f, i) => n(f, t + i * 0.04, 0.09, 0.06))
    if (type === 'clear')   [600, 800, 1050, 1350].forEach((f, i) => n(f, t + i * 0.06, 0.12, 0.08))
    if (type === 'over')    { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function LightBounceGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [level, setLevel] = useState<LevelDef>(() => genLevel(0))
  const [mirrors, setMirrors] = useState<Record<string, Mirror>>({})
  const [score, setScore] = useState(0)
  const [levelsSolved, setLevelsSolved] = useState(0)
  const [totalMoves, setTotalMoves] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SESSION_SECONDS)
  const [flash, setFlash] = useState<string | null>(null)
  const [solvedGlow, setSolvedGlow] = useState(false)

  const scoreRef = useRef(0), levelsSolvedRef = useRef(0), totalMovesRef = useRef(0)
  const levelIndexRef = useRef(0), timeLeftRef = useRef(SESSION_SECONDS)
  const levelStartRef = useRef(0), prevHitCountRef = useRef(0)
  const isRunning = useRef(false), solvedHandledRef = useRef(false)
  const sessionTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)

  const simResult = useMemo(() => simulateBeam(level, mirrors), [level, mirrors])
  const solved = level.crystals.length > 0 && level.crystals.every(([r, c]) => simResult.hit.has(cellKey(r, c)))
  const usedMirrors = Object.keys(mirrors).length

  const doEnd = useCallback(() => {
    isRunning.current = false
    clearInterval(sessionTimer.current)
    clearTimeout(advanceTimer.current)
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.3))
    setHighScore('light-bounce', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const loadLevel = useCallback((index: number) => {
    const lvl = genLevel(index)
    setLevel(lvl)
    setMirrors({})
    prevHitCountRef.current = 0
    solvedHandledRef.current = false
    levelStartRef.current = Date.now()
  }, [])

  const start = useCallback(() => {
    scoreRef.current = 0; levelsSolvedRef.current = 0; totalMovesRef.current = 0
    levelIndexRef.current = 0; timeLeftRef.current = SESSION_SECONDS
    setScore(0); setLevelsSolved(0); setTotalMoves(0); setTimeLeft(SESSION_SECONDS)
    setFlash(null); setSolvedGlow(false)
    isRunning.current = true
    loadLevel(0)
    setPhase('play')
    clearInterval(sessionTimer.current)
    sessionTimer.current = setInterval(() => {
      timeLeftRef.current -= 1
      setTimeLeft(timeLeftRef.current)
      if (timeLeftRef.current <= 0) doEnd()
    }, 1000)
  }, [doEnd, loadLevel])

  useEffect(() => () => {
    isRunning.current = false
    clearInterval(sessionTimer.current)
    clearTimeout(advanceTimer.current)
  }, [])

  // Beam-hit-crystal feedback whenever the live path newly touches a crystal.
  useEffect(() => {
    if (phase !== 'play') return
    const n = simResult.hit.size
    if (n > prevHitCountRef.current) { snd('crystal'); vibrate(6) }
    prevHitCountRef.current = n
  }, [simResult, phase])

  // Level-clear celebration + advance.
  useEffect(() => {
    if (phase !== 'play' || !solved || solvedHandledRef.current) return
    solvedHandledRef.current = true
    const unused = level.mirrorBudget - usedMirrors
    const elapsedSec = (Date.now() - levelStartRef.current) / 1000
    const speedBonus = Math.max(0, Math.round(40 - elapsedSec * 2))
    const pts = 150 + unused * 40 + speedBonus + levelsSolvedRef.current * 15
    scoreRef.current += pts; setScore(scoreRef.current)
    levelsSolvedRef.current += 1; setLevelsSolved(levelsSolvedRef.current)
    snd('clear'); vibrate([15, 30, 15])
    setSolvedGlow(true)
    setFlash(`LEVEL CLEAR +${pts}`)
    clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      if (!isRunning.current) return
      setFlash(null); setSolvedGlow(false)
      loadLevel(levelIndexRef.current + 1)
      levelIndexRef.current += 1
    }, 900)
  }, [solved, phase, level, usedMirrors, loadLevel])

  const isSpecialCell = useCallback((r: number, c: number) => {
    if (level.source.r === r && level.source.c === c) return true
    if (level.walls.some(([wr, wc]) => wr === r && wc === c)) return true
    if (level.crystals.some(([cr, cc]) => cr === r && cc === c)) return true
    return false
  }, [level])

  const tapCell = useCallback((r: number, c: number) => {
    if (!isRunning.current || solved || isSpecialCell(r, c)) return
    const key = cellKey(r, c)
    setMirrors(prev => {
      const cur = prev[key]
      if (!cur) {
        if (Object.keys(prev).length >= level.mirrorBudget) { snd('blocked'); vibrate(15); return prev }
        totalMovesRef.current++; setTotalMoves(totalMovesRef.current)
        snd('place'); vibrate(8)
        return { ...prev, [key]: '/' }
      }
      if (cur === '/') {
        totalMovesRef.current++; setTotalMoves(totalMovesRef.current)
        snd('place'); vibrate(8)
        return { ...prev, [key]: '\\' }
      }
      totalMovesRef.current++; setTotalMoves(totalMovesRef.current)
      snd('remove'); vibrate(6)
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [level, solved, isSpecialCell])

  const resetLevel = useCallback(() => {
    if (!isRunning.current) return
    setMirrors({})
    prevHitCountRef.current = 0
    levelStartRef.current = Date.now()
    snd('remove'); vibrate(10)
  }, [])

  const best = highScores['light-bounce'] ?? 0
  const xp = Math.floor(score * 0.3)

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>

      <svg width={130} height={80} viewBox="0 0 130 80">
        <line x1={8} y1={40} x2={62} y2={40} stroke={BEAM_COLOR} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
        <line x1={62} y1={40} x2={62} y2={14} stroke={BEAM_COLOR} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
        <line x1={62} y1={14} x2={112} y2={14} stroke={BEAM_COLOR} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
        <line x1={50} y1={52} x2={74} y2={28} stroke={MIRROR_COLOR} strokeWidth={4} strokeLinecap="round" />
        <circle cx={12} cy={40} r={6} fill="#1A1A2E" />
        <path d="M 8 40 L 18 36 L 18 44 Z" fill="#1A1A2E" />
        <g transform="translate(112,14)">
          <path d="M0 -9 L7 0 L0 9 L-7 0 Z" fill={BEAM_COLOR_SOLVED} opacity={0.95} />
        </g>
      </svg>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>LIGHT BOUNCE</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>ANGLE MIRRORS TO LIGHT EVERY CRYSTAL</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('light-bounce')) start(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', background: BG, position: 'relative', fontFamily: 'system-ui,sans-serif' }}>
      <HowToPlayOverlay bg={BG} accent="#1A1A2E" textColor="#1A1A2E" mutedColor="#999" bullets={TUTORIALS['light-bounce']} onStart={() => { markTutorialSeen('light-bounce'); start() }} />
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#7DD3FC', letterSpacing: '0.22em', margin: 0 }}>TIME'S UP</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>LEVELS</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{levelsSolvedRef.current}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>MOVES</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{totalMovesRef.current}</p>
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

  const cellPx = Math.min(48, Math.floor(300 / level.size))
  const gridPx = level.size * cellPx
  const crystalsHit = level.crystals.filter(([r, c]) => simResult.hit.has(cellKey(r, c))).length

  const points = simResult.path.map(({ r, c }) => [(c + 0.5) * cellPx, (r + 0.5) * cellPx] as [number, number])
  if (simResult.exitDir !== null && points.length > 0) {
    const [dr, dc] = DIR_VEC[simResult.exitDir]
    const [lx, ly] = points[points.length - 1]
    points.push([lx + dc * cellPx * 0.85, ly + dr * cellPx * 0.85])
  }
  const polylinePts = points.map(p => p.join(',')).join(' ')

  return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px 4px', flexShrink: 0 }}>
        <button onClick={() => {
          if (isRunning.current) {
            isRunning.current = false
            clearInterval(sessionTimer.current)
            clearTimeout(advanceTimer.current)
            if (scoreRef.current > 0) {
              addXp(Math.floor(scoreRef.current * 0.3))
              setHighScore('light-bounce', scoreRef.current)
            }
          }
          onExit()
        }} style={{ background: 'none', border: 'none', color: '#CCC', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>LEVEL</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{levelsSolved + 1}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>MOVES</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{totalMoves}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>TIME</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: timeLeft <= 20 ? '#FF6B6B' : '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{fmtTime(timeLeft)}</p>
          </div>
        </div>
        <button onClick={resetLevel} style={{ background: 'none', border: 'none', color: '#BBB', cursor: 'pointer', padding: 4, display: 'flex' }} title="Reset level">
          <RotateCcw size={18} />
        </button>
      </div>

      <div style={{ textAlign: 'center', height: 18, flexShrink: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#BBB', margin: 0 }}>
          CRYSTALS {crystalsHit}/{level.crystals.length} &nbsp;·&nbsp; MIRRORS {usedMirrors}/{level.mirrorBudget}
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, position: 'relative', background: BOARD_BG }}>
        <AnimatePresence>
          {flash && (
            <motion.p key={flash} initial={{ scale: 0.6, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: -60 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '18%', fontSize: 15, fontWeight: 900, color: BEAM_COLOR_SOLVED, letterSpacing: '0.08em', margin: 0, whiteSpace: 'nowrap' }}>
              {flash}
            </motion.p>
          )}
        </AnimatePresence>

        <div style={{ position: 'relative', width: gridPx, height: gridPx }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${level.size}, ${cellPx}px)`, gridTemplateRows: `repeat(${level.size}, ${cellPx}px)`, gap: 0 }}>
            {Array.from({ length: level.size * level.size }, (_, i) => {
              const r = Math.floor(i / level.size), c = i % level.size
              const isSource = level.source.r === r && level.source.c === c
              const isWall = level.walls.some(([wr, wc]) => wr === r && wc === c)
              const isCrystal = level.crystals.some(([cr, cc]) => cr === r && cc === c)
              const crystalHit = isCrystal && simResult.hit.has(cellKey(r, c))
              const mirror = mirrors[cellKey(r, c)]
              return (
                <div key={i} onClick={() => tapCell(r, c)} style={{
                  width: cellPx, height: cellPx, boxSizing: 'border-box',
                  border: '1px solid rgba(255,255,255,0.05)',
                  background: isWall ? '#26201A' : isSource ? 'rgba(253,230,138,0.10)' : 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isSource || isWall || isCrystal ? 'default' : 'pointer',
                  position: 'relative',
                }}>
                  {isWall && <div style={{ width: '70%', height: '70%', borderRadius: 3, background: 'repeating-linear-gradient(45deg,#38312570,#38312570 4px,#1a150f70 4px,#1a150f70 8px)' }} />}
                  {isSource && (
                    <div style={{ transform: `rotate(${level.source.dir * 90}deg)`, color: BEAM_COLOR_SOLVED, display: 'flex' }}>
                      <ArrowRight size={Math.round(cellPx * 0.5)} />
                    </div>
                  )}
                  {isCrystal && (
                    <div style={{
                      color: crystalHit ? BEAM_COLOR_SOLVED : '#7C8AA0',
                      filter: crystalHit ? `drop-shadow(0 0 6px ${BEAM_COLOR_SOLVED})` : 'none',
                      transition: 'color 0.2s, filter 0.2s', display: 'flex',
                    }}>
                      <Gem size={Math.round(cellPx * 0.5)} />
                    </div>
                  )}
                  {mirror && !isSource && !isWall && !isCrystal && (
                    <svg width={cellPx} height={cellPx} style={{ position: 'absolute', inset: 0 }}>
                      {mirror === '/'
                        ? <line x1={cellPx * 0.15} y1={cellPx * 0.85} x2={cellPx * 0.85} y2={cellPx * 0.15} stroke={MIRROR_COLOR} strokeWidth={Math.max(3, cellPx * 0.09)} strokeLinecap="round" />
                        : <line x1={cellPx * 0.15} y1={cellPx * 0.15} x2={cellPx * 0.85} y2={cellPx * 0.85} stroke={MIRROR_COLOR} strokeWidth={Math.max(3, cellPx * 0.09)} strokeLinecap="round" />}
                    </svg>
                  )}
                </div>
              )
            })}
          </div>

          <svg width={gridPx} height={gridPx} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
            <polyline points={polylinePts} fill="none" stroke={solvedGlow ? BEAM_COLOR_SOLVED : BEAM_COLOR} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={0.25} />
            <polyline points={polylinePts} fill="none" stroke={solvedGlow ? BEAM_COLOR_SOLVED : BEAM_COLOR} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
          </svg>
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#5B5646', margin: 0 }}>TAP AN EMPTY CELL TO CYCLE MIRRORS</p>
      </div>
    </div>
  )
}
