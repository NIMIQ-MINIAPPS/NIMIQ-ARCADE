import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import LivesHearts from '../../components/games/LivesHearts'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'

const BG = '#FFF9E8'
const W = 385, COLS = 7
const CELL = W / COLS
// Endless mode: the board is an infinite vertical scroll rather than a fixed
// per-level grid. CELL_H/VIEW_ROWS define a fixed-size camera viewport that
// scrolls up over an ever-growing `lanes` array instead of a rebuilt board.
const CELL_H = 50
const VIEW_ROWS = 11
const AHEAD_BUFFER = VIEW_ROWS + 8
const START_LIVES = 3

type LaneType = 'safe' | 'road' | 'river'
interface Hazard { x: number; width: number; speed: number; color: string }
interface Lane { type: LaneType; hazards: Hazard[] }

// Same per-lane difficulty math as before (speed/gap scaling), just driven
// by continuous distance travelled instead of a discrete "level" counter so
// difficulty ramps smoothly with no jumps/resets.
function laneParamsForDistance(distanceLevel: number) {
  const speedMul = 1 + distanceLevel * 0.12
  const gapRoad = Math.max(90, 150 - distanceLevel * 6)
  const gapRiver = Math.max(70, 120 - distanceLevel * 4)
  return { speedMul, gapRoad, gapRiver }
}

function genRoadLane(distanceLevel: number, dirIndex: number): Lane {
  const { speedMul, gapRoad } = laneParamsForDistance(distanceLevel)
  const dir = dirIndex % 2 === 0 ? 1 : -1
  const speed = (0.8 + Math.random() * 0.7) * speedMul * dir
  const hazards: Hazard[] = []
  let x = Math.random() * gapRoad
  while (x < W + gapRoad) {
    hazards.push({ x: dir > 0 ? x - gapRoad : W - x, width: 38, speed, color: ['#FF6B6B', '#F5B942', '#A78BFA'][hazards.length % 3] })
    x += gapRoad
  }
  return { type: 'road', hazards }
}

function genRiverLane(distanceLevel: number, dirIndex: number): Lane {
  const { speedMul, gapRiver } = laneParamsForDistance(distanceLevel)
  const dir = dirIndex % 2 === 0 ? 1 : -1
  const speed = (0.5 + Math.random() * 0.5) * speedMul * dir
  const hazards: Hazard[] = []
  let x = Math.random() * gapRiver
  while (x < W + gapRiver) {
    hazards.push({ x: dir > 0 ? x - gapRiver : W - x, width: 58, speed, color: ['#8B5A2B', '#7A4A22'][hazards.length % 2] })
    x += gapRiver
  }
  return { type: 'river', hazards }
}

interface LaneGenState { next: 'road' | 'river'; remaining: number; dirCounter: number }

function drawCar(ctx: CanvasRenderingContext2D, hz: Hazard, y: number, h: number) {
  const bodyH = h * 0.6, bodyY = y + h * 0.2
  ctx.fillStyle = hz.color
  ctx.beginPath(); ctx.roundRect(hz.x, bodyY, hz.width, bodyH, 6); ctx.fill()
  // cabin/window strip
  ctx.fillStyle = 'rgba(20,20,32,0.55)'
  const winInset = hz.width * 0.16
  ctx.beginPath(); ctx.roundRect(hz.x + winInset, bodyY + bodyH * 0.1, hz.width - winInset * 2, bodyH * 0.42, 3); ctx.fill()
  // wheels
  ctx.fillStyle = '#15151F'
  const wheelR = Math.max(2, h * 0.09)
  const wheelY = bodyY + bodyH - wheelR * 0.6
  ctx.beginPath(); ctx.arc(hz.x + hz.width * 0.22, wheelY, wheelR, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(hz.x + hz.width * 0.78, wheelY, wheelR, 0, Math.PI * 2); ctx.fill()
  // head/tail light in direction of travel
  const lightX = hz.speed > 0 ? hz.x + hz.width - 4 : hz.x + 4
  ctx.fillStyle = hz.speed > 0 ? '#FFF3B0' : '#FF4D4D'
  ctx.beginPath(); ctx.arc(lightX, bodyY + bodyH * 0.5, 2.2, 0, Math.PI * 2); ctx.fill()
}

function drawLog(ctx: CanvasRenderingContext2D, hz: Hazard, y: number, h: number) {
  const bodyH = h * 0.6, bodyY = y + h * 0.2
  const capR = bodyH * 0.46
  ctx.fillStyle = hz.color || '#8B5A2B'
  ctx.beginPath(); ctx.roundRect(hz.x, bodyY, hz.width, bodyH, bodyH / 2); ctx.fill()
  // wood-grain lines
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = 1.3
  for (let g = 0; g < 3; g++) {
    const gy = bodyY + bodyH * (0.3 + g * 0.22)
    ctx.beginPath()
    ctx.moveTo(hz.x + capR, gy)
    ctx.quadraticCurveTo(hz.x + hz.width * 0.5, gy + (g % 2 === 0 ? 2 : -2), hz.x + hz.width - capR, gy)
    ctx.stroke()
  }
  // cut end-caps
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.beginPath(); ctx.ellipse(hz.x + capR, bodyY + bodyH / 2, capR, bodyH / 2, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(hz.x + hz.width - capR, bodyY + bodyH / 2, capR, bodyH / 2, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.ellipse(hz.x + capR, bodyY + bodyH / 2, capR, bodyH / 2, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(hz.x + hz.width - capR, bodyY + bodyH / 2, capR, bodyH / 2, 0, 0, Math.PI * 2); ctx.stroke()
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
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [rows, setRows] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [levelMsg, setLevelMsg] = useState<string | null>(null)

  const lanes = useRef<Lane[]>([{ type: 'safe', hazards: [] }])
  const genState = useRef<LaneGenState>({ next: 'road', remaining: 0, dirCounter: 0 })
  const frog = useRef({ col: 3, row: 0, dispX: 0, dispY: 0 })
  const maxRowReached = useRef(0)
  const cameraY = useRef(0)
  const alive = useRef(false), raf = useRef(0)
  const scoreRef = useRef(0), livesRef = useRef(START_LIVES)

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

  // Procedurally appends exactly one lane to the end of the endless track,
  // reusing the same road/river hazard generation as before but driven by a
  // persistent block-cycle state (safe -> road block -> safe -> river block
  // -> ...) instead of a per-level rebuild.
  const appendLane = useCallback(() => {
    const row = lanes.current.length
    const distanceLevel = row / 12
    const st = genState.current
    if (st.remaining <= 0) {
      lanes.current.push({ type: 'safe', hazards: [] })
      const blockLen = st.next === 'road'
        ? Math.min(2 + Math.floor(distanceLevel / 2), 7)
        : Math.min(2 + Math.floor(distanceLevel / 2), 6)
      st.remaining = Math.max(1, blockLen)
      st.dirCounter = 0
      return
    }
    const lane = st.next === 'road' ? genRoadLane(distanceLevel, st.dirCounter) : genRiverLane(distanceLevel, st.dirCounter)
    lanes.current.push(lane)
    st.dirCounter++
    st.remaining--
    if (st.remaining === 0) st.next = st.next === 'road' ? 'river' : 'road'
  }, [])

  const ensureLanesAhead = useCallback(() => {
    const target = frog.current.row + AHEAD_BUFFER
    while (lanes.current.length <= target) appendLane()
  }, [appendLane])

  const loop = useCallback(() => {
    if (!alive.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) { raf.current = requestAnimationFrame(loop); return }

    ensureLanesAhead()

    const f = frog.current
    // Smoothly scroll the camera up so the frog stays a few rows above the
    // bottom of the viewport once it advances past the start.
    const targetCam = Math.max(0, (f.row - 4) * CELL_H)
    cameraY.current += (targetCam - cameraY.current) * 0.08

    const camLaneIdx = Math.max(0, Math.floor(cameraY.current / CELL_H) - 1)
    const lastLaneIdx = Math.min(lanes.current.length - 1, camLaneIdx + VIEW_ROWS + 2)

    // Only animate hazards currently in (or near) the viewport — lanes that
    // have scrolled far behind are effectively recycled: they stay in memory
    // (cheap POJOs) but stop costing any per-frame work.
    for (let i = camLaneIdx; i <= lastLaneIdx; i++) {
      lanes.current[i].hazards.forEach(hz => {
        hz.x += hz.speed
        if (hz.speed > 0 && hz.x > W) hz.x = -hz.width
        if (hz.speed < 0 && hz.x < -hz.width) hz.x = W
      })
    }

    const lane = lanes.current[f.row]
    if (lane?.type === 'road') {
      const fx = f.col * CELL + CELL / 2
      if (lane.hazards.some(hz => fx > hz.x && fx < hz.x + hz.width)) { respawn() }
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
    f.dispY += (f.row * CELL_H + CELL_H / 2 - f.dispY) * 0.35

    const dpr = window.devicePixelRatio || 1
    const canvasH = VIEW_ROWS * CELL_H
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#161425'
    ctx.fillRect(0, 0, W, canvasH)

    for (let i = camLaneIdx; i <= lastLaneIdx; i++) {
      const l = lanes.current[i]
      const y = canvasH - (i + 1) * CELL_H + cameraY.current
      if (y > canvasH || y + CELL_H < 0) continue
      ctx.fillStyle = l.type === 'road' ? '#1B1B2E' : l.type === 'river' ? '#123048' : '#161425'
      ctx.fillRect(0, y, W, CELL_H)
      l.hazards.forEach(hz => {
        if (l.type === 'road') drawCar(ctx, hz, y, CELL_H)
        else if (l.type === 'river') drawLog(ctx, hz, y, CELL_H)
      })
    }

    const fx = f.dispX, fy = canvasH - f.dispY + cameraY.current
    ctx.fillStyle = '#86EFAC'
    ctx.beginPath(); ctx.arc(fx, fy, CELL_H * 0.3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1A1A2E'
    ctx.beginPath(); ctx.arc(fx - 6, fy - 6, 3, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(fx + 6, fy - 6, 3, 0, Math.PI * 2); ctx.fill()

    raf.current = requestAnimationFrame(loop)
  }, [respawn, ensureLanesAhead])

  useEffect(() => {
    if (phase !== 'play') { cancelAnimationFrame(raf.current); return }
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = (VIEW_ROWS * CELL_H) * dpr
    alive.current = true
    raf.current = requestAnimationFrame(loop)
    return () => { alive.current = false; cancelAnimationFrame(raf.current) }
  }, [phase, loop])

  const move = useCallback((dc: number, dr: number) => {
    if (!alive.current) return
    const f = frog.current
    if (dr > 0) ensureLanesAhead()
    const nr = Math.max(0, f.row + dr)
    const nc = Math.max(0, Math.min(COLS - 1, f.col + dc))
    if (nr === f.row && nc === f.col) return
    f.row = nr; f.col = nc
    snd('hop'); vibrate(6)
    if (f.row > maxRowReached.current) {
      maxRowReached.current = f.row
      scoreRef.current += 5
      setScore(scoreRef.current)
      setRows(maxRowReached.current)
      // Distance milestone — celebratory bonus, doesn't rebuild/reset anything.
      if (maxRowReached.current > 0 && maxRowReached.current % 20 === 0) {
        const bonus = 100 + maxRowReached.current * 2
        scoreRef.current += bonus
        setScore(scoreRef.current)
        snd('levelup'); vibrate([15, 30, 15])
        setLevelMsg(`+${bonus} · ROW ${maxRowReached.current}`)
        setTimeout(() => setLevelMsg(null), 1400)
      }
    }
  }, [ensureLanesAhead])

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
    scoreRef.current = 0; livesRef.current = START_LIVES; maxRowReached.current = 0
    lanes.current = [{ type: 'safe', hazards: [] }]
    genState.current = { next: 'road', remaining: 0, dirCounter: 0 }
    cameraY.current = 0
    frog.current = { col: 3, row: 0, dispX: 3 * CELL + CELL / 2, dispY: CELL_H / 2 }
    ensureLanesAhead()
    setScore(0); setRows(0); setLives(START_LIVES); setLevelMsg(null)
    setPhase('play')
  }, [ensureLanesAhead])

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
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('frog-cross')) startGame(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', position: 'relative', fontFamily: 'system-ui,sans-serif' }}>
      <HowToPlayOverlay bg={BG} accent="#1A1A2E" bullets={TUTORIALS['frog-cross']}
        onStart={() => { markTutorialSeen('frog-cross'); startGame() }} />
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>GAME OVER</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>ROWS</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{maxRowReached.current}</p>
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
        <button
          onClick={() => {
            if (alive.current) {
              alive.current = false
              cancelAnimationFrame(raf.current)
              if (scoreRef.current > 0) { addXp(Math.floor(scoreRef.current * 0.35)); setHighScore('frog-cross', scoreRef.current) }
            }
            onExit()
          }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>ROWS</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#86EFAC', margin: 0, lineHeight: 1.1 }}>{rows}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <LivesHearts lives={lives} maxLives={START_LIVES} color="#FF6B6B" />
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
        <div /><button onClick={() => move(0, 1)} style={dpadStyle}><ChevronUp size={22} /></button><div />
        <button onClick={() => move(-1, 0)} style={dpadStyle}><ChevronLeft size={22} /></button><div /><button onClick={() => move(1, 0)} style={dpadStyle}><ChevronRight size={22} /></button>
        <div /><button onClick={() => move(0, -1)} style={dpadStyle}><ChevronDown size={22} /></button><div />
      </div>
    </div>
  )
}

const dpadStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
