import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'

const BG = '#FFF9E8'
const W = 385, COLS = 7
const CELL = W / COLS

type LaneType = 'safe' | 'road' | 'river' | 'goal'
interface Hazard { x: number; width: number; speed: number; color: string }
interface Lane { type: LaneType; hazards: Hazard[] }

function levelParams(level: number) {
  const roadLanes = Math.min(2 + Math.floor(level / 2), 5)
  const riverLanes = Math.min(2 + Math.floor(level / 2), 4)
  const speedMul = 1 + level * 0.12
  return { roadLanes, riverLanes, speedMul }
}

function buildLanes(level: number): Lane[] {
  const { roadLanes, riverLanes, speedMul } = levelParams(level)
  const lanes: Lane[] = [{ type: 'safe', hazards: [] }]
  for (let i = 0; i < roadLanes; i++) {
    const dir = i % 2 === 0 ? 1 : -1
    const speed = (0.8 + Math.random() * 0.7) * speedMul * dir
    const gap = Math.max(90, 150 - level * 6)
    const hazards: Hazard[] = []
    let x = Math.random() * gap
    while (x < W + gap) { hazards.push({ x: dir > 0 ? x - gap : W - x, width: 38, speed, color: ['#FF6B6B', '#F5B942', '#A78BFA'][hazards.length % 3] }); x += gap }
    lanes.push({ type: 'road', hazards })
  }
  lanes.push({ type: 'safe', hazards: [] })
  for (let i = 0; i < riverLanes; i++) {
    const dir = i % 2 === 0 ? 1 : -1
    const speed = (0.5 + Math.random() * 0.5) * speedMul * dir
    const gap = Math.max(70, 120 - level * 4)
    const hazards: Hazard[] = []
    let x = Math.random() * gap
    while (x < W + gap) { hazards.push({ x: dir > 0 ? x - gap : W - x, width: 58, speed, color: '#8B5A2B' }); x += gap }
    lanes.push({ type: 'river', hazards })
  }
  lanes.push({ type: 'goal', hazards: [] })
  return lanes
}

let _ac: AudioContext | null = null
function snd(type: 'hop' | 'hurt' | 'goal' | 'levelup' | 'over') {
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
    if (type === 'hop')     n(600, t, 0.05, 0.03, 'triangle')
    if (type === 'hurt')    n(180, t, 0.22, 0.15, 'sawtooth')
    if (type === 'goal')    [700, 950, 1200].forEach((f, i) => n(f, t + i * 0.05, 0.1, 0.07))
    if (type === 'levelup') [600, 800, 1050, 1350].forEach((f, i) => n(f, t + i * 0.06, 0.11, 0.07))
    if (type === 'over')    { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

export default function FrogCrossGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(3)
  const [levelMsg, setLevelMsg] = useState<string | null>(null)

  const lanes = useRef<Lane[]>([])
  const frog = useRef({ col: 3, row: 0, dispX: 0, dispY: 0 })
  const maxRowReached = useRef(0)
  const alive = useRef(false), raf = useRef(0)
  const scoreRef = useRef(0), levelRef = useRef(1), livesRef = useRef(3)
  const cellH = useRef(48)

  const doEnd = useCallback(() => {
    alive.current = false
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.35))
    setHighScore('frog-cross', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const respawn = useCallback(() => {
    livesRef.current--; setLives(livesRef.current)
    snd('hurt'); vibrate(35)
    if (livesRef.current <= 0) { doEnd(); return }
    frog.current.col = 3; frog.current.row = 0
  }, [doEnd])

  const nextLevel = useCallback(() => {
    const bonus = 150 + levelRef.current * 40
    scoreRef.current += bonus; setScore(scoreRef.current)
    levelRef.current++; setLevel(levelRef.current)
    snd('levelup'); vibrate([15, 30, 15])
    setLevelMsg(`LEVEL ${levelRef.current} · +${bonus}`)
    setTimeout(() => setLevelMsg(null), 1400)
    lanes.current = buildLanes(levelRef.current)
    frog.current.col = 3; frog.current.row = 0
    maxRowReached.current = 0
    const H = Math.min(560, lanes.current.length * 50)
    cellH.current = H / lanes.current.length
  }, [])

  const loop = useCallback(() => {
    if (!alive.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) { raf.current = requestAnimationFrame(loop); return }

    lanes.current.forEach(lane => {
      lane.hazards.forEach(hz => {
        hz.x += hz.speed
        if (hz.speed > 0 && hz.x > W) hz.x = -hz.width
        if (hz.speed < 0 && hz.x < -hz.width) hz.x = W
      })
    })

    const f = frog.current
    const lane = lanes.current[f.row]
    if (lane?.type === 'road') {
      const fx = f.col * CELL + CELL / 2
      if (lane.hazards.some(hz => fx > hz.x && fx < hz.x + hz.width)) { respawn(); }
    } else if (lane?.type === 'river') {
      const fx = f.col * CELL + CELL / 2
      const log = lane.hazards.find(hz => fx > hz.x - 4 && fx < hz.x + hz.width + 4)
      if (!log) { respawn() }
      else {
        f.col = Math.max(0, Math.min(COLS - 1, f.col + log.speed / CELL))
        if (f.col <= 0.1 || f.col >= COLS - 1.1) respawn()
      }
    }

    f.dispX += (f.col * CELL + CELL / 2 - f.dispX) * 0.35
    f.dispY += (f.row * cellH.current + cellH.current / 2 - f.dispY) * 0.35

    const dpr = window.devicePixelRatio || 1
    const H = lanes.current.length * cellH.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    lanes.current.forEach((l, i) => {
      const y = H - (i + 1) * cellH.current
      ctx.fillStyle = l.type === 'road' ? '#1B1B2E' : l.type === 'river' ? '#123048' : l.type === 'goal' ? '#12331F' : '#161425'
      ctx.fillRect(0, y, W, cellH.current)
      l.hazards.forEach(hz => {
        ctx.fillStyle = hz.color
        ctx.beginPath(); ctx.roundRect(hz.x, y + cellH.current * 0.18, hz.width, cellH.current * 0.64, 6); ctx.fill()
      })
    })

    const fx = f.dispX, fy = H - f.dispY - cellH.current
    ctx.fillStyle = '#86EFAC'
    ctx.beginPath(); ctx.arc(fx, fy + cellH.current / 2, cellH.current * 0.3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1A1A2E'
    ctx.beginPath(); ctx.arc(fx - 6, fy + cellH.current / 2 - 6, 3, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(fx + 6, fy + cellH.current / 2 - 6, 3, 0, Math.PI * 2); ctx.fill()

    if (f.row >= lanes.current.length - 1) { snd('goal'); nextLevel() }

    raf.current = requestAnimationFrame(loop)
  }, [respawn, nextLevel])

  useEffect(() => {
    if (phase !== 'play') { cancelAnimationFrame(raf.current); return }
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    const H = lanes.current.length * cellH.current
    canvas.width = W * dpr; canvas.height = H * dpr
    alive.current = true
    raf.current = requestAnimationFrame(loop)
    return () => { alive.current = false; cancelAnimationFrame(raf.current) }
  }, [phase, loop])

  const move = useCallback((dc: number, dr: number) => {
    if (!alive.current) return
    const f = frog.current
    const nr = Math.max(0, Math.min(lanes.current.length - 1, f.row + dr))
    const nc = Math.max(0, Math.min(COLS - 1, f.col + dc))
    if (nr === f.row && nc === f.col) return
    f.row = nr; f.col = nc
    snd('hop'); vibrate(6)
    if (f.row > maxRowReached.current) {
      maxRowReached.current = f.row
      scoreRef.current += 5; setScore(scoreRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'play') return
    let sx = 0, sy = 0
    const onStart = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY }
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0)
      else move(0, dy > 0 ? -1 : 1)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') move(0, 1)
      if (e.key === 'ArrowDown') move(0, -1)
      if (e.key === 'ArrowLeft') move(-1, 0)
      if (e.key === 'ArrowRight') move(1, 0)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd); window.removeEventListener('keydown', onKey) }
  }, [phase, move])

  const startGame = useCallback(() => {
    scoreRef.current = 0; levelRef.current = 1; livesRef.current = 3; maxRowReached.current = 0
    lanes.current = buildLanes(1)
    const H = Math.min(560, lanes.current.length * 50)
    cellH.current = H / lanes.current.length
    frog.current = { col: 3, row: 0, dispX: 3 * CELL + CELL / 2, dispY: cellH.current / 2 }
    setScore(0); setLevel(1); setLives(3); setLevelMsg(null)
    setPhase('play')
  }, [])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current) }, [])

  const best = highScores['frog-cross'] ?? 0

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <svg width={60} height={60} viewBox="0 0 60 60">
        <circle cx={30} cy={32} r={18} fill="#86EFAC" />
        <circle cx={22} cy={22} r={4} fill="#1A1A2E" /><circle cx={38} cy={22} r={4} fill="#1A1A2E" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>FROG CROSS</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>SWIPE TO HOP · REACH THE TOP</p>
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
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>LEVEL</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{levelRef.current}</p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{Math.floor(scoreRef.current * 0.35)}</p>
      {scoreRef.current > 0 && scoreRef.current >= best && <p style={{ fontSize: 11, color: '#E9B213', fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>}
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#12101E', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 6px', flexShrink: 0 }}>
        <button onClick={() => { alive.current = false; onExit() }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>LEVEL</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#86EFAC', margin: 0, lineHeight: 1.1 }}>{level}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < lives ? '#86EFAC' : 'rgba(255,255,255,0.1)' }} />)}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', touchAction: 'none' }} />
        <AnimatePresence>
          {levelMsg && (
            <motion.div key={levelMsg} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.3, opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#86EFAC', letterSpacing: '0.1em', filter: 'drop-shadow(0 2px 14px rgba(134,239,172,0.7))', margin: 0, textAlign: 'center' }}>{levelMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,52px)', gridTemplateRows: 'repeat(3,52px)', gap: 4, justifyContent: 'center', padding: '8px 0 16px', flexShrink: 0 }}>
        <div /><button onClick={() => move(0, 1)} style={dpadStyle}>▲</button><div />
        <button onClick={() => move(-1, 0)} style={dpadStyle}>◀</button><div /><button onClick={() => move(1, 0)} style={dpadStyle}>▶</button>
        <div /><button onClick={() => move(0, -1)} style={dpadStyle}>▼</button><div />
      </div>
    </div>
  )
}

const dpadStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer' }
