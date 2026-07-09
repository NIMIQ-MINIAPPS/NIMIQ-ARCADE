import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'

const BG = '#FFF9E8'
const W = 390, H = 580
type Size = 'large' | 'medium' | 'small'
const SIZE_CFG: Record<Size, { r: number; pts: number; splitInto: Size | null }> = {
  large: { r: 34, pts: 10, splitInto: 'medium' },
  medium: { r: 20, pts: 25, splitInto: 'small' },
  small: { r: 11, pts: 50, splitInto: null },
}

interface Asteroid { id: number; x: number; y: number; vx: number; vy: number; size: Size; rot: number; rotSpeed: number; shape: number[] }
interface Bullet { id: number; x: number; y: number; vx: number; vy: number; life: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }

let _id = 0
function wrap(v: number, max: number) { return ((v % max) + max) % max }

function makeAsteroid(size: Size, x: number, y: number, level: number): Asteroid {
  const speed = (0.6 + Math.random() * 1.2) * (1 + level * 0.06)
  const a = Math.random() * Math.PI * 2
  const shape = Array.from({ length: 9 }, () => 0.72 + Math.random() * 0.34)
  return { id: ++_id, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size, rot: 0, rotSpeed: (Math.random() - 0.5) * 0.05, shape }
}

function spawnField(level: number): Asteroid[] {
  const n = Math.min(3 + level, 18)
  const out: Asteroid[] = []
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0
    do { x = Math.random() * W; y = Math.random() * H } while (Math.hypot(x - W / 2, y - H / 2) < 100)
    out.push(makeAsteroid('large', x, y, level))
  }
  return out
}

let _ac: AudioContext | null = null
function snd(type: 'shoot' | 'explode' | 'hurt' | 'levelup' | 'over') {
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
    if (type === 'shoot')   n(760, t, 0.05, 0.03, 'square')
    if (type === 'explode') { n(200, t, 0.12, 0.1, 'sawtooth'); n(130, t + 0.08, 0.16, 0.08, 'square') }
    if (type === 'hurt')    n(180, t, 0.22, 0.15, 'sawtooth')
    if (type === 'levelup') [600, 800, 1050, 1350].forEach((f, i) => n(f, t + i * 0.06, 0.11, 0.07))
    if (type === 'over')    { n(160, t, 0.5, 0.16, 'sawtooth'); n(100, t + 0.35, 0.4, 0.12, 'square') }
  } catch {/**/}
}

export default function AsteroidFieldGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(3)
  const [levelMsg, setLevelMsg] = useState<string | null>(null)

  const ship = useRef({ x: W / 2, y: H / 2, angle: -Math.PI / 2, vx: 0, vy: 0 })
  const target = useRef<{ x: number; y: number } | null>(null)
  const asteroids = useRef<Asteroid[]>([])
  const bullets = useRef<Bullet[]>([])
  const parts = useRef<Particle[]>([])
  const alive = useRef(false), raf = useRef(0), shootT = useRef(0), invulnT = useRef(0)
  const scoreRef = useRef(0), levelRef = useRef(1), livesRef = useRef(3)

  const burst = useCallback((x: number, y: number, color: string, n = 12) => {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i + Math.random() * 0.4
      const spd = 1 + Math.random() * 3
      parts.current.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 30, maxLife: 30, color })
    }
  }, [])

  const doEnd = useCallback(() => {
    alive.current = false
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.35))
    setHighScore('asteroid-field', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const loop = useCallback(() => {
    if (!alive.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) { raf.current = requestAnimationFrame(loop); return }

    const s = ship.current
    if (target.current) {
      const dx = target.current.x - s.x, dy = target.current.y - s.y
      const desired = Math.atan2(dy, dx)
      let diff = desired - s.angle
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      s.angle += diff * 0.15
      const speed = 1.4 + levelRef.current * 0.05
      s.vx += Math.cos(s.angle) * 0.05 * speed
      s.vy += Math.sin(s.angle) * 0.05 * speed
    }
    s.vx *= 0.985; s.vy *= 0.985
    s.x = wrap(s.x + s.vx, W); s.y = wrap(s.y + s.vy, H)
    if (invulnT.current > 0) invulnT.current--

    shootT.current++
    if (shootT.current % 14 === 0) {
      bullets.current.push({ id: ++_id, x: s.x, y: s.y, vx: Math.cos(s.angle) * 7, vy: Math.sin(s.angle) * 7, life: 55 })
      snd('shoot')
    }
    bullets.current = bullets.current.map(b => ({ ...b, x: wrap(b.x + b.vx, W), y: wrap(b.y + b.vy, H), life: b.life - 1 })).filter(b => b.life > 0)

    asteroids.current.forEach(a => { a.x = wrap(a.x + a.vx, W); a.y = wrap(a.y + a.vy, H); a.rot += a.rotSpeed })

    bullets.current = bullets.current.filter(b => {
      for (let i = asteroids.current.length - 1; i >= 0; i--) {
        const a = asteroids.current[i]; const cfg = SIZE_CFG[a.size]
        if (Math.hypot(b.x - a.x, b.y - a.y) < cfg.r) {
          snd('explode'); burst(a.x, a.y, '#C4B5FD', a.size === 'large' ? 16 : 10)
          scoreRef.current += cfg.pts * levelRef.current; setScore(scoreRef.current)
          asteroids.current.splice(i, 1)
          if (cfg.splitInto) {
            for (let k = 0; k < 2; k++) asteroids.current.push(makeAsteroid(cfg.splitInto, a.x, a.y, levelRef.current))
          }
          return false
        }
      }
      return true
    })

    if (invulnT.current <= 0) {
      for (const a of asteroids.current) {
        if (Math.hypot(s.x - a.x, s.y - a.y) < SIZE_CFG[a.size].r + 10) {
          livesRef.current--; setLives(livesRef.current)
          snd('hurt'); vibrate(35); burst(s.x, s.y, '#FF6B6B', 16)
          if (livesRef.current <= 0) { doEnd(); return }
          s.x = W / 2; s.y = H / 2; s.vx = 0; s.vy = 0; invulnT.current = 120
          break
        }
      }
    }

    if (asteroids.current.length === 0) {
      const bonus = 200 + levelRef.current * 60
      scoreRef.current += bonus; setScore(scoreRef.current)
      levelRef.current++; setLevel(levelRef.current)
      snd('levelup'); vibrate([15, 30, 15])
      setLevelMsg(`LEVEL ${levelRef.current} · +${bonus}`)
      setTimeout(() => setLevelMsg(null), 1400)
      asteroids.current = spawnField(levelRef.current)
    }

    parts.current = parts.current.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1 })).filter(p => p.life > 0)

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0C0A18'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 53) % W, (i * 97) % H, 1, 1)

    parts.current.forEach(p => { ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill() })
    ctx.globalAlpha = 1

    ctx.strokeStyle = '#C4B5FD'; ctx.lineWidth = 1.5
    asteroids.current.forEach(a => {
      const r = SIZE_CFG[a.size].r
      ctx.beginPath()
      a.shape.forEach((m, i) => {
        const ang = (Math.PI * 2 / a.shape.length) * i + a.rot
        const px = a.x + Math.cos(ang) * r * m, py = a.y + Math.sin(ang) * r * m
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      })
      ctx.closePath(); ctx.stroke()
    })

    ctx.fillStyle = '#4CC9F0'
    bullets.current.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill() })

    if (invulnT.current <= 0 || Math.floor(invulnT.current / 6) % 2 === 0) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle)
      ctx.strokeStyle = '#E9B213'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, 9); ctx.lineTo(-5, 0); ctx.lineTo(-10, -9); ctx.closePath(); ctx.stroke()
      if (shootT.current % 14 < 4) { ctx.strokeStyle = '#FDBA74'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-16, 0); ctx.stroke() }
      ctx.restore()
    }

    raf.current = requestAnimationFrame(loop)
  }, [burst, doEnd])

  useEffect(() => {
    if (phase !== 'play') { cancelAnimationFrame(raf.current); return }
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    alive.current = true
    raf.current = requestAnimationFrame(loop)
    return () => { alive.current = false; cancelAnimationFrame(raf.current) }
  }, [phase, loop])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || phase !== 'play') return
    const move = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect()
      target.current = { x: (clientX - r.left) * (W / r.width), y: (clientY - r.top) * (H / r.height) }
    }
    const onM = (e: MouseEvent) => move(e.clientX, e.clientY)
    const onT = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY) }
    const onUp = () => { target.current = null }
    canvas.addEventListener('mousedown', onM)
    canvas.addEventListener('mousemove', onM)
    canvas.addEventListener('mouseup', onUp)
    canvas.addEventListener('touchstart', onT, { passive: false })
    canvas.addEventListener('touchmove', onT, { passive: false })
    canvas.addEventListener('touchend', onUp)
    return () => {
      canvas.removeEventListener('mousedown', onM); canvas.removeEventListener('mousemove', onM); canvas.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('touchstart', onT); canvas.removeEventListener('touchmove', onT); canvas.removeEventListener('touchend', onUp)
    }
  }, [phase])

  const startGame = useCallback(() => {
    ship.current = { x: W / 2, y: H / 2, angle: -Math.PI / 2, vx: 0, vy: 0 }
    target.current = null; bullets.current = []; parts.current = []
    scoreRef.current = 0; levelRef.current = 1; livesRef.current = 3; invulnT.current = 60
    asteroids.current = spawnField(1)
    setScore(0); setLevel(1); setLives(3); setLevelMsg(null)
    setPhase('play')
  }, [])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current) }, [])

  const best = highScores['asteroid-field'] ?? 0

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <svg width={160} height={130} viewBox="0 0 160 130">
        <rect width={160} height={130} rx={16} fill="#0C0A18" />
        <polygon points="30,20 45,15 55,25 50,38 35,40 22,32" fill="none" stroke="#C4B5FD" strokeWidth="1.5" />
        <polygon points="110,20 122,15 132,23 130,36 115,38 105,28" fill="none" stroke="#C4B5FD" strokeWidth="1.5" />
        <polygon points="80,85 72,100 88,100" fill="none" stroke="#E9B213" strokeWidth="2" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>ASTEROID FIELD</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>DRAG TO STEER · AUTO-FIRE</p>
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0C0A18', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 6px', flexShrink: 0 }}>
        <button onClick={() => { alive.current = false; onExit() }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>LEVEL</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#C4B5FD', margin: 0, lineHeight: 1.1 }}>{level}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < lives ? '#E9B213' : 'rgba(255,255,255,0.1)' }} />)}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', touchAction: 'none' }} />
        <AnimatePresence>
          {levelMsg && (
            <motion.div key={levelMsg} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.3, opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#C4B5FD', letterSpacing: '0.1em', filter: 'drop-shadow(0 2px 14px rgba(196,181,253,0.7))', margin: 0, textAlign: 'center' }}>{levelMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
