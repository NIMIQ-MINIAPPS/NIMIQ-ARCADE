import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'

const W = 380, H = 560, BLOCK_H = 24
const HUE_START = 43

interface Block { x: number; y: number; w: number; hue: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; r: number }
interface Firefly { x: number; y: number; phase: number; speed: number }

let _ac: AudioContext | null = null
function snd(type: 'place' | 'perfect' | 'gust' | 'over') {
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
    if (type === 'place')   n(440, t, 0.07, 0.06, 'triangle')
    if (type === 'perfect') [660, 880, 1100, 1400].forEach((f, i) => n(f, t + i * 0.05, 0.11, 0.07))
    if (type === 'gust')    n(300, t, 0.3, 0.05, 'sine')
    if (type === 'over')    { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function lerpHex(c1: string, c2: string, t: number) {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const [r1, g1, b1] = p(c1), [r2, g2, b2] = p(c2)
  const r = Math.round(lerp(r1, r2, t)), g = Math.round(lerp(g1, g2, t)), b = Math.round(lerp(b1, b2, t))
  return `rgb(${r},${g},${b})`
}

export default function TowerStackGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [height, setHeight] = useState(0)
  const [streak, setStreak] = useState(0)
  const [gustMsg, setGustMsg] = useState<string | null>(null)

  const tower = useRef<Block[]>([])
  const moving = useRef({ x: 0, w: 200, dir: 3 })
  const raf = useRef(0), alive = useRef(false)
  const scoreRef = useRef(0), heightRef = useRef(0), streakRef = useRef(0)
  const cameraY = useRef(0)
  const parts = useRef<Particle[]>([])
  const fireflies = useRef<Firefly[]>(Array.from({ length: 24 }, (_, i) => ({ x: (i * 53) % W, y: (i * 97) % H, phase: Math.random() * Math.PI * 2, speed: 0.2 + Math.random() * 0.3 })))
  const gustUntil = useRef(0)
  const lastGustFloor = useRef(0)

  const burst = useCallback((x: number, y: number, color: string, n = 10) => {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i + Math.random() * 0.4
      const spd = 1 + Math.random() * 2.4
      parts.current.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 1, life: 30, maxLife: 30, color, r: 1.5 + Math.random() * 2 })
    }
  }, [])

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const t = Math.min(heightRef.current / 50, 1)
    const topCol = lerpHex('#2B2350', '#050410', t)
    const botCol = lerpHex('#120E24', '#020103', t)
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, topCol); grad.addColorStop(1, botCol)
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

    // Stars — density grows with height
    const starCount = Math.floor(20 + t * 60)
    for (let i = 0; i < starCount; i++) {
      const sx = (i * 71) % W, sy = (i * 113 + heightRef.current * 4) % H
      ctx.globalAlpha = 0.15 + (i % 5) * 0.08
      ctx.fillStyle = 'white'
      ctx.fillRect(sx, sy, i % 7 === 0 ? 1.6 : 0.9, i % 7 === 0 ? 1.6 : 0.9)
    }
    ctx.globalAlpha = 1

    // Aurora ribbon past floor 25
    if (heightRef.current >= 25) {
      const auroraT = Math.min((heightRef.current - 25) / 25, 1)
      ctx.strokeStyle = `rgba(134,239,172,${0.08 + auroraT * 0.14})`
      ctx.lineWidth = 18
      ctx.beginPath()
      const now = Date.now() * 0.0006
      for (let x = 0; x <= W; x += 10) {
        const y = 90 + Math.sin(x * 0.02 + now) * 26
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // Fireflies
    fireflies.current.forEach(f => {
      f.phase += 0.02 * f.speed
      const fx = f.x + Math.sin(f.phase) * 14
      const fy = ((f.y - cameraY.current * 0.3) % H + H) % H
      ctx.globalAlpha = 0.25 + Math.sin(f.phase * 2) * 0.15
      ctx.fillStyle = '#FDBA74'
      ctx.beginPath(); ctx.arc(fx, fy, 1.3, 0, Math.PI * 2); ctx.fill()
    })
    ctx.globalAlpha = 1

    const cam = cameraY.current
    tower.current.forEach((b) => {
      ctx.fillStyle = `hsl(${b.hue}, 55%, 55%)`
      ctx.fillRect(b.x, b.y - cam, b.w, BLOCK_H - 1)
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(b.x, b.y - cam, b.w, 3)
      ctx.strokeStyle = `hsl(${b.hue}, 40%, 35%)`
      ctx.lineWidth = 0.5
      ctx.strokeRect(b.x, b.y - cam, b.w, BLOCK_H - 1)
    })

    // Particles
    parts.current.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y - cam, p.r, 0, Math.PI * 2); ctx.fill()
    })
    ctx.globalAlpha = 1

    if (alive.current) {
      const m = moving.current
      const y = H - (tower.current.length + 1) * BLOCK_H - cam
      const gusting = Date.now() < gustUntil.current
      ctx.fillStyle = gusting ? '#93DCFF' : '#E9B213'
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = gusting ? 14 : 6
      ctx.fillRect(m.x, y, m.w, BLOCK_H - 1)
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.fillRect(m.x, y, m.w, 3)
    }
  }, [])

  const gameLoop = useCallback(() => {
    if (!alive.current) return
    const m = moving.current
    const gusting = Date.now() < gustUntil.current
    m.x += m.dir * (gusting ? 1.7 : 1)
    if (m.x + m.w > W) { m.x = W - m.w; m.dir = -Math.abs(m.dir) }
    if (m.x < 0) { m.x = 0; m.dir = Math.abs(m.dir) }
    const towerTop = tower.current.length > 0 ? tower.current[tower.current.length - 1].y - BLOCK_H : H - BLOCK_H
    if (towerTop < H * 0.4) cameraY.current = (H - BLOCK_H) - towerTop - H * 0.6

    if (heightRef.current > 0 && heightRef.current % 12 === 0 && heightRef.current !== lastGustFloor.current && Date.now() > gustUntil.current) {
      lastGustFloor.current = heightRef.current
      gustUntil.current = Date.now() + 2400
      snd('gust'); setGustMsg('WIND GUST'); setTimeout(() => setGustMsg(null), 1400)
    }

    parts.current = parts.current.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.1, life: p.life - 1 })).filter(p => p.life > 0)

    draw()
    raf.current = requestAnimationFrame(gameLoop)
  }, [draw])

  const doEnd = useCallback(() => {
    alive.current = false
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.6))
    setHighScore('tower-stack', scoreRef.current)
    setScore(scoreRef.current); draw()
    setPhase('over')
  }, [addXp, setHighScore, draw])

  const dropBlock = useCallback(() => {
    if (!alive.current) return
    const m = moving.current
    const y = H - (tower.current.length + 1) * BLOCK_H
    const hue = (HUE_START + tower.current.length * 7) % 360
    if (tower.current.length === 0) {
      tower.current.push({ x: m.x, y, w: m.w, hue })
      heightRef.current++; setHeight(heightRef.current)
      streakRef.current++; setStreak(streakRef.current)
      scoreRef.current += 10; setScore(scoreRef.current)
      snd('place'); vibrate(8)
      burst(m.x + m.w / 2, y - cameraY.current, '#E9B213', 8)
    } else {
      const prev = tower.current[tower.current.length - 1]
      const start = Math.max(m.x, prev.x)
      const end = Math.min(m.x + m.w, prev.x + prev.w)
      const ow = end - start
      if (ow <= 0) { doEnd(); return }
      const isPerfect = Math.abs(ow - prev.w) < 3
      const finalW = isPerfect ? prev.w : ow
      tower.current.push({ x: isPerfect ? prev.x : start, y, w: finalW, hue })
      heightRef.current++; setHeight(heightRef.current)
      scoreRef.current += 10; setScore(scoreRef.current)
      if (isPerfect) {
        streakRef.current++; setStreak(streakRef.current)
        const bonus = 30 + Math.min(streakRef.current, 10) * 8
        scoreRef.current += bonus; setScore(scoreRef.current)
        snd('perfect'); vibrate([10, 20, 10])
        burst(start + finalW / 2, y - cameraY.current, '#FDE68A', 18)
      } else {
        streakRef.current = 0; setStreak(0)
        snd('place'); vibrate(8)
        burst(start + finalW / 2, y - cameraY.current, '#E9B213', 8)
      }
      const speed = Math.min(3 + heightRef.current * 0.14, 9)
      moving.current = { x: 0, w: finalW, dir: (Math.random() > 0.5 ? 1 : -1) * speed }
    }
  }, [burst, doEnd])

  const start = useCallback(() => {
    tower.current = []; moving.current = { x: 0, w: 200, dir: 3 }
    scoreRef.current = 0; heightRef.current = 0; streakRef.current = 0; cameraY.current = 0
    gustUntil.current = 0; lastGustFloor.current = 0; parts.current = []
    setScore(0); setHeight(0); setStreak(0); setGustMsg(null); setPhase('play')
    alive.current = true; gameLoop()
  }, [gameLoop])

  useEffect(() => {
    if (phase !== 'play') return
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    draw()
  }, [phase, draw])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current) }, [])

  const best = highScores['tower-stack'] ?? 0
  const xp = Math.floor(score * 0.6)
  const BG = '#FFF9E8'

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <svg width={160} height={140} viewBox="0 0 160 140">
        <rect width={160} height={140} rx={16} fill="#120E24" />
        {[{ w: 80, hue: 43 }, { w: 70, hue: 50 }, { w: 65, hue: 57 }, { w: 55, hue: 64 }, { w: 42, hue: 71 }].map(({ w, hue }, i) => (
          <rect key={i} x={(160 - w) / 2} y={108 - i * 18} width={w} height={16} rx={2} fill={`hsl(${hue},55%,55%)`} />
        ))}
        <rect x={20} y={22} width={50} height={16} rx={2} fill="#93DCFF" opacity={0.9} />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>TOWER STACK</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>TAP TO DROP · STACK HIGH</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('tower-stack')) start(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', position: 'relative', fontFamily: 'system-ui,sans-serif' }}>
      <HowToPlayOverlay bg={BG} accent="#1A1A2E" textColor="#1A1A2E" mutedColor="#999" bullets={TUTORIALS['tower-stack']}
        onStart={() => { markTutorialSeen('tower-stack'); start() }} />
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>GAME OVER</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{score.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>HEIGHT</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{heightRef.current}</p>
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

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#120E24', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 6px', flexShrink: 0 }}>
        <button onClick={() => {
            if (alive.current) {
              alive.current = false
              if (scoreRef.current > 0) { addXp(Math.floor(scoreRef.current * 0.6)); setHighScore('tower-stack', scoreRef.current) }
            }
            onExit()
          }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>HEIGHT</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#C4B5FD', margin: 0, lineHeight: 1.1 }}>{height}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ width: 20 }}>
          {streak > 2 && <span style={{ fontSize: 11, fontWeight: 900, color: '#E9B213' }}>×{streak}</span>}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}
        onClick={dropBlock}>
        <canvas ref={canvasRef} width={W} height={H}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', touchAction: 'none' }} />
        <AnimatePresence>
          {gustMsg && (
            <motion.div key={gustMsg} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '18%', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 14, fontWeight: 900, color: '#93DCFF', letterSpacing: '0.15em', filter: 'drop-shadow(0 2px 10px rgba(147,220,255,0.6))', margin: 0 }}>{gustMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
