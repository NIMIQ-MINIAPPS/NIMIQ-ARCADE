import { useRef, useEffect, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'

const BG = '#FFF9E8'
const W = 390, H = 580
const TOP = 70, BOTTOM = 510
const PLAYER_X = W * 0.28, R = 15

interface Obstacle { x: number; width: number; side: 'floor' | 'ceiling'; height: number; passed: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }

let _ac: AudioContext | null = null
function snd(type: 'flip' | 'pass' | 'hurt' | 'over') {
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
    if (type === 'flip') n(650, t, 0.06, 0.05, 'square')
    if (type === 'pass') n(900, t, 0.04, 0.02, 'sine')
    if (type === 'hurt') { n(180, t, 0.3, 0.16, 'sawtooth') }
    if (type === 'over') { n(160, t, 0.5, 0.16, 'sawtooth'); n(100, t + 0.35, 0.4, 0.12, 'square') }
  } catch {/**/}
}

export default function GravitySwitchGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)

  const gravity = useRef<'floor' | 'ceiling'>('floor')
  const playerY = useRef(BOTTOM - R)
  const obstacles = useRef<Obstacle[]>([])
  const parts = useRef<Particle[]>([])
  const alive = useRef(false), raf = useRef(0)
  const distance = useRef(0), scoreRef = useRef(0)
  const nextSpawnX = useRef(500)

  const burst = useCallback((x: number, y: number, color: string) => {
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 / 12) * i
      parts.current.push({ x, y, vx: Math.cos(a) * (1 + Math.random() * 2.4), vy: Math.sin(a) * (1 + Math.random() * 2.4), life: 26, maxLife: 26, color })
    }
  }, [])

  const doEnd = useCallback(() => {
    alive.current = false
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.3))
    setHighScore('gravity-switch', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const loop = useCallback(() => {
    if (!alive.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) { raf.current = requestAnimationFrame(loop); return }

    const speed = Math.min(3 + distance.current * 0.0004, 18)
    distance.current += speed
    scoreRef.current = Math.floor(distance.current / 8); setScore(scoreRef.current)

    const targetY = gravity.current === 'floor' ? BOTTOM - R : TOP + R
    playerY.current += (targetY - playerY.current) * 0.32

    while (nextSpawnX.current < distance.current + W + 200) {
      const gap = Math.max(90, 280 - distance.current * 0.008)
      const side: 'floor' | 'ceiling' = Math.random() < 0.5 ? 'floor' : 'ceiling'
      const height = 55 + Math.min(distance.current * 0.006, 90) + Math.random() * 20
      const width = 24 + Math.random() * 14
      obstacles.current.push({ x: nextSpawnX.current, width, side, height, passed: false })
      nextSpawnX.current += gap
    }
    obstacles.current = obstacles.current.filter(o => o.x - distance.current > -60)

    for (const o of obstacles.current) {
      const ox = o.x - distance.current
      if (!o.passed && ox + o.width < PLAYER_X - R) { o.passed = true; snd('pass') }
      const oy0 = o.side === 'floor' ? BOTTOM - o.height : TOP
      const oy1 = o.side === 'floor' ? BOTTOM : TOP + o.height
      if (PLAYER_X + R > ox && PLAYER_X - R < ox + o.width && playerY.current + R > oy0 && playerY.current - R < oy1) {
        snd('hurt'); vibrate([30, 20, 40]); burst(PLAYER_X, playerY.current, '#FF6B6B')
        doEnd(); return
      }
    }

    parts.current = parts.current.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1 })).filter(p => p.life > 0)

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#1B1430'); grad.addColorStop(1, '#0D0A18')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = 'rgba(196,181,253,0.12)'
    ctx.fillRect(0, 0, W, TOP); ctx.fillRect(0, BOTTOM, W, H - BOTTOM)
    ctx.fillStyle = 'rgba(196,181,253,0.35)'
    ctx.fillRect(0, TOP - 2, W, 2); ctx.fillRect(0, BOTTOM, W, 2)

    obstacles.current.forEach(o => {
      const ox = o.x - distance.current
      ctx.fillStyle = '#FF6B6B'
      if (o.side === 'floor') {
        ctx.beginPath(); ctx.moveTo(ox, BOTTOM); ctx.lineTo(ox + o.width / 2, BOTTOM - o.height); ctx.lineTo(ox + o.width, BOTTOM); ctx.closePath(); ctx.fill()
      } else {
        ctx.beginPath(); ctx.moveTo(ox, TOP); ctx.lineTo(ox + o.width / 2, TOP + o.height); ctx.lineTo(ox + o.width, TOP); ctx.closePath(); ctx.fill()
      }
    })

    parts.current.forEach(p => { ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill() })
    ctx.globalAlpha = 1

    ctx.shadowColor = '#93DCFF'; ctx.shadowBlur = 12
    ctx.fillStyle = '#93DCFF'
    ctx.beginPath(); ctx.roundRect(PLAYER_X - R, playerY.current - R, R * 2, R * 2, 6); ctx.fill()
    ctx.shadowBlur = 0

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

  const flip = useCallback(() => {
    if (!alive.current) return
    gravity.current = gravity.current === 'floor' ? 'ceiling' : 'floor'
    snd('flip'); vibrate(10)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || phase !== 'play') return
    const onTap = (e: Event) => { e.preventDefault(); flip() }
    canvas.addEventListener('mousedown', onTap)
    canvas.addEventListener('touchstart', onTap, { passive: false })
    return () => { canvas.removeEventListener('mousedown', onTap); canvas.removeEventListener('touchstart', onTap) }
  }, [phase, flip])

  const startGame = useCallback(() => {
    gravity.current = 'floor'; playerY.current = BOTTOM - R
    obstacles.current = []; parts.current = []
    distance.current = 0; scoreRef.current = 0; nextSpawnX.current = 500
    setScore(0)
    setPhase('play')
  }, [])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current) }, [])

  const best = highScores['gravity-switch'] ?? 0

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <svg width={160} height={100} viewBox="0 0 160 100">
        <rect width={160} height={100} rx={16} fill="#0D0A18" />
        <polygon points="30,80 50,50 70,80" fill="#FF6B6B" />
        <polygon points="110,20 130,50 150,20" fill="#FF6B6B" />
        <rect x={85} y={12} width={20} height={20} rx={5} fill="#93DCFF" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>GRAVITY SWITCH</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>TAP TO FLIP GRAVITY · SURVIVE</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('gravity-switch')) startGame(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', position: 'relative', fontFamily: 'system-ui,sans-serif' }}>
      <HowToPlayOverlay bg={BG} accent="#93DCFF" bullets={TUTORIALS['gravity-switch']}
        onStart={() => { markTutorialSeen('gravity-switch'); startGame() }} />
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0D0A18', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 6px', flexShrink: 0 }}>
        <button onClick={() => {
            if (alive.current) {
              alive.current = false
              if (scoreRef.current > 0) { addXp(Math.floor(scoreRef.current * 0.3)); setHighScore('gravity-switch', scoreRef.current) }
            }
            onExit()
          }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>SCORE</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
        </div>
        <div style={{ width: 20 }} />
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', touchAction: 'none' }} />
      </div>
    </div>
  )
}
