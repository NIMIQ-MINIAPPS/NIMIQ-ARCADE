import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'

// ── Constants ─────────────────────────────────────────────────────────────────
const BG = '#FFF9E8'
const W = 390, H = 580
const COLS = 8, GAP = 3, MARGIN = 14
const BRICK_W = (W - MARGIN * 2 - (COLS - 1) * GAP) / COLS
const BRICK_H = 17
const TOP = 58
const PADDLE_Y = H - 46
const PADDLE_H = 12
const BALL_R = 6
const ROW_COLORS = ['#93DCFF', '#C4B5FD', '#86EFAC', '#FDBA74', '#FCA5A5', '#FCD34D', '#F9A8D4', '#A5D8FF']
const POWER_COLORS: Record<PowerType, string> = { multi: '#C4B5FD', wide: '#86EFAC', fast: '#FDBA74', laser: '#FF6B6B' }
const POWER_LABEL: Record<PowerType, string> = { multi: 'M', wide: 'W', fast: 'F', laser: 'L' }

type PowerType = 'multi' | 'wide' | 'fast' | 'laser'

interface Brick { row: number; col: number; hp: number; maxHp: number; obstacle: boolean; moving: boolean; phase: number; alive: boolean }
interface Ball { x: number; y: number; vx: number; vy: number; fast: boolean }
interface Bolt { x: number; y: number }
interface FallingPower { x: number; y: number; type: PowerType }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; r: number }

let _id = 0

// ── Audio ─────────────────────────────────────────────────────────────────────
let _ac: AudioContext | null = null
function snd(type: 'hit' | 'break' | 'obstacle' | 'powerup' | 'lose' | 'levelup' | 'over' | 'laser' | 'launch') {
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
    if (type === 'hit')      n(520, t, 0.06, 0.05, 'triangle')
    if (type === 'break')    { n(700, t, 0.07, 0.06, 'square'); n(900, t + 0.03, 0.08, 0.04) }
    if (type === 'obstacle') n(220, t, 0.08, 0.06, 'sawtooth')
    if (type === 'powerup')  [500, 700, 950].forEach((f, i) => n(f, t + i * 0.05, 0.1, 0.06))
    if (type === 'laser')    n(1100, t, 0.05, 0.03, 'square')
    if (type === 'launch')   n(400, t, 0.08, 0.06, 'triangle')
    if (type === 'lose')     { n(220, t, 0.18, 0.14, 'sawtooth') }
    if (type === 'levelup')  [550, 770, 1000, 1300].forEach((f, i) => n(f, t + i * 0.07, 0.12, 0.07))
    if (type === 'over')     { n(160, t, 0.5, 0.16, 'sawtooth'); n(100, t + 0.35, 0.4, 0.12, 'square') }
  } catch {/**/}
}

function genLevel(level: number): Brick[] {
  const rows = Math.min(4 + Math.floor(level / 2), 7)
  const resistChance = Math.min(0.08 + level * 0.045, 0.5)
  const movingChance = level >= 3 ? Math.min((level - 2) * 0.05, 0.22) : 0
  const obstacleChance = level >= 4 ? 0.08 : 0
  const bricks: Brick[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLS; col++) {
      const isObstacle = row > 0 && row < rows - 1 && Math.random() < obstacleChance
      const isResist = !isObstacle && Math.random() < resistChance
      const hp = isObstacle ? 99 : isResist ? (Math.random() < 0.3 ? 3 : 2) : 1
      bricks.push({
        row, col, hp, maxHp: hp, obstacle: isObstacle,
        moving: !isObstacle && Math.random() < movingChance,
        phase: Math.random() * Math.PI * 2, alive: true,
      })
    }
  }
  return bricks
}

function brickX(b: Brick, frame: number): number {
  const base = MARGIN + b.col * (BRICK_W + GAP)
  if (!b.moving) return base
  return base + Math.sin(frame * 0.03 + b.phase) * (BRICK_W * 0.35)
}
function brickY(b: Brick): number { return TOP + b.row * (BRICK_H + GAP) }

function newBall(px: number, fast = false): Ball {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6
  const speed = fast ? 7.5 : 5
  return { x: px, y: PADDLE_Y - BALL_R - 2, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, fast }
}

export default function BreakwallGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()

  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(3)
  const [levelMsg, setLevelMsg] = useState<string | null>(null)
  const [powerBadges, setPowerBadges] = useState<PowerType[]>([])

  const alive = useRef(false), raf = useRef(0), frame = useRef(0)
  const paddleX = useRef(W / 2 - 45), paddleW = useRef(90)
  const launched = useRef(false)
  const balls = useRef<Ball[]>([])
  const bricks = useRef<Brick[]>([])
  const bolts = useRef<Bolt[]>([])
  const fallingPowers = useRef<FallingPower[]>([])
  const parts = useRef<Particle[]>([])
  const activePowers = useRef<{ wide: number; fast: number; laser: number }>({ wide: 0, fast: 0, laser: 0 })
  const scoreRef = useRef(0), levelRef = useRef(1), livesRef = useRef(3)
  const wantLaser = useRef(false)

  const burst = useCallback((x: number, y: number, color: string, n = 10) => {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i + Math.random() * 0.4
      const spd = 1 + Math.random() * 2.6
      parts.current.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 26, maxLife: 26, color, r: 1.5 + Math.random() * 1.8 })
    }
  }, [])

  const syncBadges = useCallback(() => {
    const ap = activePowers.current
    const list: PowerType[] = []
    if (ap.wide > 0) list.push('wide')
    if (ap.fast > 0) list.push('fast')
    if (ap.laser > 0) list.push('laser')
    setPowerBadges(list)
  }, [])

  const startLevel = useCallback((lvl: number, resetPaddle: boolean) => {
    bricks.current = genLevel(lvl)
    if (resetPaddle) { paddleW.current = 90; paddleX.current = W / 2 - paddleW.current / 2 }
    balls.current = [newBall(paddleX.current + paddleW.current / 2)]
    bolts.current = []; fallingPowers.current = []
    launched.current = false
  }, [])

  const doEnd = useCallback(() => {
    alive.current = false
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.35))
    setHighScore('breakwall', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const loseLife = useCallback(() => {
    livesRef.current--; setLives(livesRef.current)
    snd('lose'); vibrate(50)
    if (livesRef.current <= 0) { doEnd(); return }
    balls.current = [newBall(paddleX.current + paddleW.current / 2)]
    launched.current = false
  }, [doEnd])

  // ── Game loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') { cancelAnimationFrame(raf.current); return }
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    alive.current = true

    function loop() {
      if (!alive.current) return
      frame.current++
      const ap = activePowers.current
      let badgesChanged = false
      ;(['wide', 'fast', 'laser'] as PowerType[]).forEach(k => {
        if (ap[k] > 0) { ap[k]--; if (ap[k] === 0) badgesChanged = true }
      })
      if (badgesChanged) syncBadges()

      // Paddle width lerp toward target
      const targetW = ap.wide > 0 ? 130 : 90
      paddleW.current += (targetW - paddleW.current) * 0.15
      paddleX.current = Math.max(0, Math.min(W - paddleW.current, paddleX.current))

      // Laser fire
      if (wantLaser.current && ap.laser > 0) {
        wantLaser.current = false
        bolts.current.push({ x: paddleX.current + paddleW.current / 2, y: PADDLE_Y })
        snd('laser')
      } else wantLaser.current = false

      bolts.current = bolts.current.map(b => ({ ...b, y: b.y - 9 })).filter(b => b.y > -10)

      // Move balls (or glue to paddle before launch)
      if (!launched.current) {
        const b = balls.current[0]
        if (b) { b.x = paddleX.current + paddleW.current / 2; b.y = PADDLE_Y - BALL_R - 2 }
      } else {
        balls.current.forEach(b => {
          b.x += b.vx; b.y += b.vy
          if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx *= -1 }
          if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx *= -1 }
          if (b.y - BALL_R < TOP - 30) { b.y = TOP - 30 + BALL_R; b.vy *= -1 }
          // Paddle collision
          if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y + BALL_R <= PADDLE_Y + PADDLE_H + 6 &&
            b.x >= paddleX.current - 4 && b.x <= paddleX.current + paddleW.current + 4) {
            const rel = (b.x - (paddleX.current + paddleW.current / 2)) / (paddleW.current / 2)
            const speed = Math.hypot(b.vx, b.vy)
            const angle = -Math.PI / 2 + rel * 1.1
            b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed
            b.y = PADDLE_Y - BALL_R
          }
        })
      }

      // Ball-brick collisions
      balls.current.forEach(b => {
        for (const brk of bricks.current) {
          if (!brk.alive) continue
          const bx = brickX(brk, frame.current), by = brickY(brk)
          if (b.x + BALL_R > bx && b.x - BALL_R < bx + BRICK_W && b.y + BALL_R > by && b.y - BALL_R < by + BRICK_H) {
            b.vy *= -1
            if (brk.obstacle) {
              snd('obstacle'); vibrate(15)
              burst(bx + BRICK_W / 2, by + BRICK_H / 2, '#9CA3AF', 6)
            } else {
              brk.hp -= b.fast ? 2 : 1
              snd('hit')
              if (brk.hp <= 0) {
                brk.alive = false
                snd('break'); vibrate(10)
                const pts = (bricks.current.reduce((m, x) => Math.max(m, x.row), 0) - brk.row + 1) * 10 * levelRef.current
                scoreRef.current += pts; setScore(scoreRef.current)
                burst(bx + BRICK_W / 2, by + BRICK_H / 2, ROW_COLORS[brk.row % ROW_COLORS.length], 12)
                if (Math.random() < 0.14) {
                  const types: PowerType[] = ['multi', 'wide', 'fast', 'laser']
                  fallingPowers.current.push({ x: bx + BRICK_W / 2, y: by + BRICK_H / 2, type: types[Math.floor(Math.random() * types.length)] })
                }
              } else {
                scoreRef.current += 4 * levelRef.current; setScore(scoreRef.current)
              }
            }
            break
          }
        }
      })

      // Bolt-brick collisions
      bolts.current = bolts.current.filter(bolt => {
        for (const brk of bricks.current) {
          if (!brk.alive || brk.obstacle) continue
          const bx = brickX(brk, frame.current), by = brickY(brk)
          if (bolt.x > bx && bolt.x < bx + BRICK_W && bolt.y > by && bolt.y < by + BRICK_H) {
            brk.hp--
            if (brk.hp <= 0) {
              brk.alive = false; snd('break')
              const pts = (bricks.current.reduce((m, x) => Math.max(m, x.row), 0) - brk.row + 1) * 10 * levelRef.current
              scoreRef.current += pts; setScore(scoreRef.current)
              burst(bx + BRICK_W / 2, by + BRICK_H / 2, ROW_COLORS[brk.row % ROW_COLORS.length], 10)
            }
            return false
          }
        }
        return true
      })

      // Falling power-ups
      fallingPowers.current = fallingPowers.current.map(p => ({ ...p, y: p.y + 2.4 })).filter(p => {
        if (p.y > PADDLE_Y - 6 && p.y < PADDLE_Y + PADDLE_H && p.x > paddleX.current - 8 && p.x < paddleX.current + paddleW.current + 8) {
          snd('powerup'); vibrate([10, 20, 10])
          if (p.type === 'multi') {
            const src = balls.current[0] ?? newBall(paddleX.current + paddleW.current / 2)
            for (let i = 0; i < 2; i++) {
              const a = Math.atan2(src.vy, src.vx) + (i === 0 ? -0.4 : 0.4)
              const spd = Math.hypot(src.vx, src.vy)
              balls.current.push({ x: src.x, y: src.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, fast: src.fast })
            }
            launched.current = true
          } else if (p.type === 'wide') activePowers.current.wide = 600
          else if (p.type === 'fast') { activePowers.current.fast = 480; balls.current.forEach(b => { b.fast = true }) }
          else if (p.type === 'laser') activePowers.current.laser = 480
          syncBadges()
          return false
        }
        return p.y < H + 20
      })

      // Balls falling off screen
      if (launched.current) {
        const before = balls.current.length
        balls.current = balls.current.filter(b => b.y - BALL_R < H + 10)
        if (balls.current.length === 0 && before > 0) { loseLife() }
        else if (balls.current.length < before) {
          balls.current.forEach(b => { b.fast = activePowers.current.fast > 0 })
        }
      }

      // Level clear
      if (bricks.current.filter(b => !b.obstacle).every(b => !b.alive)) {
        snd('levelup'); vibrate([20, 40, 20])
        const bonus = 300 + levelRef.current * 100
        scoreRef.current += bonus; setScore(scoreRef.current)
        levelRef.current++; setLevel(levelRef.current)
        setLevelMsg(`LEVEL ${levelRef.current} · +${bonus}`)
        setTimeout(() => setLevelMsg(null), 1500)
        startLevel(levelRef.current, false)
      }

      // Particles
      parts.current = parts.current.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.12, life: p.life - 1 })).filter(p => p.life > 0)

      // ── Draw ────────────────────────────────────────────────────────────
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#1B1430'); grad.addColorStop(1, '#0D0A18')
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

      // Bricks
      bricks.current.forEach(brk => {
        if (!brk.alive) return
        const bx = brickX(brk, frame.current), by = brickY(brk)
        if (brk.obstacle) {
          ctx.fillStyle = '#4B5563'
          ctx.beginPath(); ctx.roundRect(bx, by, BRICK_W, BRICK_H, 3); ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
          for (let s = -BRICK_H; s < BRICK_W; s += 6) {
            ctx.beginPath(); ctx.moveTo(bx + s, by + BRICK_H); ctx.lineTo(bx + s + BRICK_H, by); ctx.stroke()
          }
        } else {
          const col = ROW_COLORS[brk.row % ROW_COLORS.length]
          ctx.globalAlpha = 0.55 + 0.45 * (brk.hp / brk.maxHp)
          ctx.fillStyle = col
          ctx.beginPath(); ctx.roundRect(bx, by, BRICK_W, BRICK_H, 4); ctx.fill()
          ctx.globalAlpha = 1
          ctx.fillStyle = 'rgba(255,255,255,0.22)'
          ctx.fillRect(bx + 1, by + 1, BRICK_W - 2, 3)
          if (brk.maxHp > 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)'
            ctx.font = '900 9px system-ui'; ctx.textAlign = 'center'
            ctx.fillText(String(brk.hp), bx + BRICK_W / 2, by + BRICK_H / 2 + 3)
          }
        }
      })

      // Falling power-ups
      fallingPowers.current.forEach(p => {
        ctx.fillStyle = POWER_COLORS[p.type]
        ctx.beginPath(); ctx.roundRect(p.x - 12, p.y - 10, 24, 20, 6); ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = '900 11px system-ui'; ctx.textAlign = 'center'
        ctx.fillText(POWER_LABEL[p.type], p.x, p.y + 4)
      })

      // Bolts
      ctx.fillStyle = '#FF6B6B'
      bolts.current.forEach(b => { ctx.beginPath(); ctx.roundRect(b.x - 1.5, b.y - 8, 3, 12, 1.5); ctx.fill() })

      // Particles
      parts.current.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
      })
      ctx.globalAlpha = 1

      // Paddle
      const pw = paddleW.current, px = paddleX.current
      ctx.shadowColor = ap.laser > 0 ? '#FF6B6B' : '#FFB347'
      ctx.shadowBlur = 10
      ctx.fillStyle = ap.laser > 0 ? '#FF6B6B' : '#FFB347'
      ctx.beginPath(); ctx.roundRect(px, PADDLE_Y, pw, PADDLE_H, 6); ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(px + 3, PADDLE_Y + 2, pw - 6, 2.5)

      // Balls
      balls.current.forEach(b => {
        ctx.shadowColor = b.fast ? '#FDBA74' : '#FFFFFF'
        ctx.shadowBlur = b.fast ? 12 : 6
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
      })

      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => { alive.current = false; cancelAnimationFrame(raf.current) }
  }, [phase, burst, loseLife, startLevel, syncBadges])

  // ── Controls ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || phase !== 'play') return
    const move = (clientX: number) => {
      const r = canvas.getBoundingClientRect()
      const ratio = W / r.width
      paddleX.current = Math.max(0, Math.min(W - paddleW.current, (clientX - r.left) * ratio - paddleW.current / 2))
    }
    const tap = () => {
      if (!launched.current) { launched.current = true; snd('launch') }
      else if (activePowers.current.laser > 0) wantLaser.current = true
    }
    const onM = (e: MouseEvent) => move(e.clientX)
    const onT = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX) }
    const onDown = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX); tap() }
    const onClick = () => tap()
    canvas.addEventListener('mousemove', onM)
    canvas.addEventListener('mousedown', onClick)
    canvas.addEventListener('touchmove', onT, { passive: false })
    canvas.addEventListener('touchstart', onDown, { passive: false })
    return () => {
      canvas.removeEventListener('mousemove', onM)
      canvas.removeEventListener('mousedown', onClick)
      canvas.removeEventListener('touchmove', onT)
      canvas.removeEventListener('touchstart', onDown)
    }
  }, [phase])

  const startGame = useCallback(() => {
    scoreRef.current = 0; levelRef.current = 1; livesRef.current = 3
    activePowers.current = { wide: 0, fast: 0, laser: 0 }
    setScore(0); setLevel(1); setLives(3); setLevelMsg(null); setPowerBadges([])
    startLevel(1, true)
    setPhase('play')
  }, [startLevel])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current) }, [])

  const best = highScores['breakwall'] ?? 0

  // ── Start screen ───────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <svg width={220} height={130} viewBox="0 0 220 130">
        <rect width={220} height={130} rx={16} fill="#150E24" />
        {Array.from({ length: 18 }, (_, i) => i).map(i => {
          const c = i % 6, r = Math.floor(i / 6)
          if ([4, 9].includes(i)) return null
          return <rect key={i} x={14 + c * 33} y={14 + r * 18} width={28} height={13} rx={3} fill={ROW_COLORS[r % ROW_COLORS.length]} opacity={0.85} />
        })}
        <circle cx={110} cy={92} r={6} fill="white" />
        <rect x={82} y={110} width={56} height={9} rx={4} fill="#FFB347" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>BREAKWALL</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>SLIDE · TAP TO LAUNCH</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={startGame}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  // ── Game over screen ──────────────────────────────────────────────────
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

  // ── Play screen ────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0D0A18', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 4px', flexShrink: 0 }}>
        <button onClick={() => { alive.current = false; onExit() }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
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
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < lives ? '#FFB347' : 'rgba(255,255,255,0.1)', boxShadow: i < lives ? '0 0 6px #FFB347' : 'none' }} />
          ))}
        </div>
      </div>

      {powerBadges.length > 0 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '2px 0 6px', flexShrink: 0 }}>
          {powerBadges.map(p => (
            <span key={p} style={{ fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 8, background: `${POWER_COLORS[p]}33`, color: POWER_COLORS[p], letterSpacing: '0.08em' }}>
              {p.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasRef} width={W} height={H}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', touchAction: 'none' }} />
        <AnimatePresence>
          {levelMsg && (
            <motion.div key={levelMsg}
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.3, opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 26, fontWeight: 900, color: '#FDBA74', letterSpacing: '0.15em', filter: 'drop-shadow(0 2px 14px rgba(253,186,116,0.7))', margin: 0, textAlign: 'center' }}>
                {levelMsg}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
