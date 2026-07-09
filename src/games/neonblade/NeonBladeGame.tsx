import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'

const BG = '#FFF9E8'
const W = 390, H = 580
const COLORS = ['#93DCFF', '#C4B5FD', '#86EFAC', '#FDBA74', '#FCA5A5', '#FCD34D']
const COMBO_WINDOW = 700

interface Obj { id: number; x: number; y: number; vx: number; vy: number; r: number; bomb: boolean; color: string; sliced: boolean; rot: number; rotSpeed: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }
interface TrailPt { x: number; y: number; t: number }

let _id = 0
function stageOf(score: number) { return Math.min(1 + Math.floor(score / 300), 10) }
function spawnRate(stage: number) { return Math.max(500, 1100 - stage * 60) }
function bombChance(stage: number) { return Math.min(0.12 + stage * 0.02, 0.32) }

let _ac: AudioContext | null = null
function snd(type: 'slice' | 'bomb' | 'miss' | 'combo' | 'over') {
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
    if (type === 'slice') n(700 + Math.random() * 200, t, 0.06, 0.05, 'triangle')
    if (type === 'bomb')  { n(160, t, 0.3, 0.18, 'sawtooth') }
    if (type === 'miss')  n(200, t, 0.15, 0.1, 'sawtooth')
    if (type === 'combo') [700, 950, 1250].forEach((f, i) => n(f, t + i * 0.05, 0.09, 0.06))
    if (type === 'over')  { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

export default function NeonBladeGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [lives, setLives] = useState(3)
  const [comboFlash, setComboFlash] = useState<string | null>(null)

  const objs = useRef<Obj[]>([])
  const parts = useRef<Particle[]>([])
  const trail = useRef<TrailPt[]>([])
  const alive = useRef(false), raf = useRef(0)
  const scoreRef = useRef(0), livesRef = useRef(3), comboRef = useRef(0), lastSlice = useRef(0)
  const spawnTimer = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)
  const dragging = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  const burst = useCallback((x: number, y: number, color: string, n = 12) => {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i + Math.random() * 0.4
      const spd = 1.5 + Math.random() * 3
      parts.current.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 26, maxLife: 26, color })
    }
  }, [])

  const doEnd = useCallback(() => {
    alive.current = false; clearTimeout(spawnTimer.current)
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.3))
    setHighScore('neon-blade', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const spawnObj = useCallback(() => {
    const stage = stageOf(scoreRef.current)
    const bomb = Math.random() < bombChance(stage)
    const x = 40 + Math.random() * (W - 80)
    const vy = -(9 + Math.random() * 2.5 + stage * 0.15)
    const vx = (Math.random() - 0.5) * 2.4
    objs.current.push({ id: ++_id, x, y: H + 20, vx, vy, r: bomb ? 20 : 22, bomb, color: bomb ? '#2A2A2A' : COLORS[Math.floor(Math.random() * COLORS.length)], sliced: false, rot: 0, rotSpeed: (Math.random() - 0.5) * 0.1 })
  }, [])

  const scheduleSpawn = useCallback(() => {
    const stage = stageOf(scoreRef.current)
    spawnTimer.current = setTimeout(() => {
      if (!alive.current) return
      spawnObj()
      scheduleSpawn()
    }, spawnRate(stage))
  }, [spawnObj])

  const loop = useCallback(() => {
    if (!alive.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) { raf.current = requestAnimationFrame(loop); return }

    objs.current.forEach(o => { o.x += o.vx; o.y += o.vy; o.vy += 0.22; o.rot += o.rotSpeed })
    objs.current = objs.current.filter(o => {
      if (o.y > H + 60) {
        if (!o.sliced && !o.bomb) {
          livesRef.current--; setLives(livesRef.current)
          comboRef.current = 0; setCombo(0)
          snd('miss'); vibrate(20)
          if (livesRef.current <= 0) doEnd()
        }
        return false
      }
      return true
    })

    trail.current = trail.current.filter(p => Date.now() - p.t < 160)
    parts.current = parts.current.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.15, life: p.life - 1 })).filter(p => p.life > 0)

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#171334'); grad.addColorStop(1, '#0B0920')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

    parts.current.forEach(p => { ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill() })
    ctx.globalAlpha = 1

    objs.current.forEach(o => {
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot)
      if (o.bomb) {
        ctx.fillStyle = '#1A1A1A'
        ctx.beginPath(); ctx.arc(0, 0, o.r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#FF6B6B'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(0, 0, o.r, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = '#FF6B6B'; ctx.fillRect(-2, -o.r - 8, 4, 8)
      } else {
        ctx.shadowColor = o.color; ctx.shadowBlur = 10
        ctx.fillStyle = o.color
        ctx.beginPath(); ctx.arc(0, 0, o.r, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.beginPath(); ctx.arc(-o.r * 0.3, -o.r * 0.3, o.r * 0.35, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    })

    if (trail.current.length > 1) {
      ctx.strokeStyle = '#93DCFF'; ctx.lineWidth = 4; ctx.lineCap = 'round'
      ctx.shadowColor = '#93DCFF'; ctx.shadowBlur = 10
      ctx.beginPath()
      trail.current.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y) })
      ctx.stroke(); ctx.shadowBlur = 0
    }

    raf.current = requestAnimationFrame(loop)
  }, [doEnd])

  useEffect(() => {
    if (phase !== 'play') { cancelAnimationFrame(raf.current); return }
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    alive.current = true
    raf.current = requestAnimationFrame(loop)
    return () => { alive.current = false; cancelAnimationFrame(raf.current) }
  }, [phase, loop])

  const trySlice = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    for (const o of objs.current) {
      if (o.sliced) continue
      const dx = x2 - x1, dy = y2 - y1
      const len2 = dx * dx + dy * dy
      let t = len2 > 0 ? ((o.x - x1) * dx + (o.y - y1) * dy) / len2 : 0
      t = Math.max(0, Math.min(1, t))
      const cx = x1 + dx * t, cy = y1 + dy * t
      if (Math.hypot(o.x - cx, o.y - cy) < o.r + 6) {
        o.sliced = true
        if (o.bomb) {
          scoreRef.current = Math.max(0, scoreRef.current - 100); setScore(scoreRef.current)
          comboRef.current = 0; setCombo(0)
          snd('bomb'); vibrate([30, 20, 30])
          burst(o.x, o.y, '#FF6B6B', 18)
        } else {
          const now = Date.now()
          if (now - lastSlice.current < COMBO_WINDOW) comboRef.current++
          else comboRef.current = 1
          lastSlice.current = now
          setCombo(comboRef.current)
          const pts = 15 * comboRef.current
          scoreRef.current += pts; setScore(scoreRef.current)
          snd('slice'); vibrate(8)
          burst(o.x, o.y, o.color, 10)
          if (comboRef.current > 0 && comboRef.current % 5 === 0) {
            snd('combo'); vibrate([10, 15, 10])
            setComboFlash(`COMBO ×${comboRef.current}`)
            setTimeout(() => setComboFlash(null), 800)
          }
        }
      }
    }
  }, [burst])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || phase !== 'play') return
    const getPos = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect()
      return { x: (clientX - r.left) * (W / r.width), y: (clientY - r.top) * (H / r.height) }
    }
    const onDown = (clientX: number, clientY: number) => { dragging.current = true; last.current = getPos(clientX, clientY) }
    const onMove = (clientX: number, clientY: number) => {
      if (!dragging.current || !last.current) return
      const p = getPos(clientX, clientY)
      trail.current.push({ x: p.x, y: p.y, t: Date.now() })
      trySlice(last.current.x, last.current.y, p.x, p.y)
      last.current = p
    }
    const onUp = () => { dragging.current = false; last.current = null }
    const onM = (e: MouseEvent) => { if (e.buttons === 1) onMove(e.clientX, e.clientY); }
    const onMD = (e: MouseEvent) => onDown(e.clientX, e.clientY)
    const onT = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY) }
    const onTS = (e: TouchEvent) => { e.preventDefault(); onDown(e.touches[0].clientX, e.touches[0].clientY) }
    canvas.addEventListener('mousedown', onMD)
    canvas.addEventListener('mousemove', onM)
    canvas.addEventListener('mouseup', onUp)
    canvas.addEventListener('touchstart', onTS, { passive: false })
    canvas.addEventListener('touchmove', onT, { passive: false })
    canvas.addEventListener('touchend', onUp)
    return () => {
      canvas.removeEventListener('mousedown', onMD); canvas.removeEventListener('mousemove', onM); canvas.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onT); canvas.removeEventListener('touchend', onUp)
    }
  }, [phase, trySlice])

  const startGame = useCallback(() => {
    objs.current = []; parts.current = []; trail.current = []
    scoreRef.current = 0; livesRef.current = 3; comboRef.current = 0; lastSlice.current = 0
    setScore(0); setLives(3); setCombo(0); setComboFlash(null)
    alive.current = true
    clearTimeout(spawnTimer.current)
    scheduleSpawn()
    setPhase('play')
  }, [scheduleSpawn])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current); clearTimeout(spawnTimer.current) }, [])

  const best = highScores['neon-blade'] ?? 0

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <svg width={160} height={100} viewBox="0 0 160 100">
        <rect width={160} height={100} rx={16} fill="#171334" />
        <circle cx={50} cy={45} r={18} fill="#93DCFF" opacity={0.85} />
        <circle cx={110} cy={30} r={14} fill="#C4B5FD" opacity={0.85} />
        <path d="M20,90 L80,20 L140,75" stroke="#FDE68A" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity={0.9} />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>NEON BLADE</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>SWIPE TO SLICE · AVOID BOMBS</p>
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
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{Math.floor(scoreRef.current * 0.3)}</p>
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0B0920', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 6px', flexShrink: 0 }}>
        <button onClick={() => { alive.current = false; onExit() }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>SCORE</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < lives ? '#93DCFF' : 'rgba(255,255,255,0.1)' }} />)}
        </div>
      </div>
      {combo > 1 && <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 900, color: '#C4B5FD', margin: '2px 0 0', letterSpacing: '0.1em' }}>COMBO ×{combo}</p>}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', touchAction: 'none' }} />
        <AnimatePresence>
          {comboFlash && (
            <motion.div key={comboFlash} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.3, opacity: 0 }}
              style={{ position: 'absolute', top: '30%', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#FDE68A', letterSpacing: '0.1em', filter: 'drop-shadow(0 2px 14px rgba(253,230,138,0.7))', margin: 0 }}>{comboFlash}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
