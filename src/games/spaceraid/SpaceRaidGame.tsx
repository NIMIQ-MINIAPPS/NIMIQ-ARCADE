import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'

const BG = '#FFF9E8'
const W = 390, H = 580, PC = '#FF9F43'

type EnemyType = 'grunt' | 'heavy' | 'sniper' | 'boss'
type PowerType = 'weapon' | 'shield' | 'speed'
interface Enemy { id: number; x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; type: EnemyType; phase: number }
interface Bullet { id: number; x: number; y: number; vx: number; vy: number; fromEnemy: boolean }
interface Particle { id: number; x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; r: number }
interface Power { id: number; x: number; y: number; type: PowerType }

const CFG: Record<EnemyType, { hw: number; hh: number; baseHp: number; col: string; pts: number }> = {
  grunt:  { hw: 11, hh: 9,  baseHp: 1,  col: '#FF9F43', pts: 10 },
  heavy:  { hw: 17, hh: 14, baseHp: 5,  col: '#FF6B6B', pts: 40 },
  sniper: { hw: 12, hh: 12, baseHp: 2,  col: '#F5B942', pts: 25 },
  boss:   { hw: 30, hh: 22, baseHp: 40, col: '#E04848', pts: 400 },
}
const POWER_COL: Record<PowerType, string> = { weapon: '#FF6B6B', shield: '#4CC9F0', speed: '#86EFAC' }
const POWER_LABEL: Record<PowerType, string> = { weapon: 'W', shield: 'S', speed: '»' }

let _id = 0

let _ac: AudioContext | null = null
function snd(type: 'shoot' | 'hit' | 'explode' | 'hurt' | 'wave' | 'boss' | 'powerup' | 'over') {
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
    if (type === 'shoot')   n(720, t, 0.05, 0.03, 'square')
    if (type === 'hit')     n(460, t, 0.07, 0.05, 'triangle')
    if (type === 'explode') { n(200, t, 0.12, 0.1, 'sawtooth'); n(130, t + 0.08, 0.18, 0.08, 'square') }
    if (type === 'hurt')    n(180, t, 0.18, 0.15, 'sawtooth')
    if (type === 'wave')    [550, 770, 1000].forEach((f, i) => n(f, t + i * 0.09, 0.12, 0.08))
    if (type === 'boss')    { n(120, t, 0.5, 0.16, 'sawtooth'); n(90, t + 0.35, 0.5, 0.14, 'sawtooth') }
    if (type === 'powerup') [500, 700, 950].forEach((f, i) => n(f, t + i * 0.05, 0.1, 0.06))
    if (type === 'over')    { n(160, t, 0.6, 0.18, 'sawtooth'); n(100, t + 0.4, 0.5, 0.12, 'square') }
  } catch {/**/}
}

function hex6(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  ctx.closePath()
}

function drawShip(ctx: CanvasRenderingContext2D, sx: number, sy: number, flash: number, shielded: boolean) {
  ctx.fillStyle = '#FDBA74'; ctx.globalAlpha = 0.35
  ctx.beginPath(); ctx.ellipse(sx, sy + 22, 5, 12, 0, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = flash > 0 ? 'white' : 'rgba(255,159,67,0.7)'
  ctx.beginPath(); ctx.moveTo(sx - 14, sy + 4); ctx.lineTo(sx - 26, sy + 18); ctx.lineTo(sx - 8, sy + 14); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(sx + 14, sy + 4); ctx.lineTo(sx + 26, sy + 18); ctx.lineTo(sx + 8, sy + 14); ctx.closePath(); ctx.fill()
  ctx.shadowColor = PC; ctx.shadowBlur = flash > 0 ? 20 : 10
  ctx.fillStyle = flash > 0 ? 'white' : PC
  hex6(ctx, sx, sy, 16); ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.beginPath(); ctx.ellipse(sx, sy - 3, 5, 7, 0, 0, Math.PI * 2); ctx.fill()
  if (shielded) {
    ctx.strokeStyle = 'rgba(76,201,240,0.7)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(sx, sy, 24, 0, Math.PI * 2); ctx.stroke()
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  const c = CFG[e.type]; const { x, y } = e
  ctx.fillStyle = c.col
  if (e.type === 'grunt') {
    ctx.beginPath(); ctx.moveTo(x, y + c.hh); ctx.lineTo(x - c.hw, y - c.hh); ctx.lineTo(x + c.hw, y - c.hh); ctx.closePath(); ctx.fill()
  } else if (e.type === 'heavy') {
    ctx.beginPath(); ctx.roundRect(x - c.hw, y - c.hh, c.hw * 2, c.hh * 2, 4); ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - c.hw, y + c.hh + 2, c.hw * 2, 3)
    ctx.fillStyle = '#86EFAC'; ctx.fillRect(x - c.hw, y + c.hh + 2, c.hw * 2 * (e.hp / e.maxHp), 3)
  } else if (e.type === 'sniper') {
    ctx.beginPath(); ctx.moveTo(x, y - c.hh); ctx.lineTo(x + c.hw, y); ctx.lineTo(x, y + c.hh); ctx.lineTo(x - c.hw, y); ctx.closePath(); ctx.fill()
  } else {
    ctx.shadowColor = c.col; ctx.shadowBlur = 14
    hex6(ctx, x, y, c.hw); ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; hex6(ctx, x, y, c.hw - 7); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(x, y, c.hw + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.hp / e.maxHp), false); ctx.stroke()
  }
}

function makeEnemy(type: EnemyType, wave: number): Enemy {
  const c = CFG[type]; const spd = 0.7 + wave * 0.06
  return {
    id: ++_id, type, hp: type === 'boss' ? c.baseHp + wave * 3 : c.baseHp, maxHp: type === 'boss' ? c.baseHp + wave * 3 : c.baseHp,
    phase: Math.random() * Math.PI * 2,
    x: type === 'boss' ? W / 2 : c.hw + 4 + Math.random() * (W - (c.hw + 4) * 2),
    y: type === 'boss' ? -40 : -(c.hh + 4 + Math.random() * 80),
    vx: type === 'sniper' ? (Math.random() > 0.5 ? 1 : -1) * spd * 1.4 : (Math.random() - 0.5) * spd * 0.7,
    vy: type === 'boss' ? 0.35 : spd * (type === 'heavy' ? 0.5 : 1),
  }
}

function waveEnemies(wave: number): Enemy[] {
  if (wave % 5 === 0) return [makeEnemy('boss', wave)]
  const out: Enemy[] = []
  const add = (t: EnemyType, n: number) => { for (let i = 0; i < n; i++) out.push(makeEnemy(t, wave)) }
  if (wave <= 3) add('grunt', 3 + wave * 2)
  else if (wave <= 7) { add('grunt', 5 + wave); add('sniper', Math.floor(wave / 2)) }
  else { add('grunt', 6); add('sniper', 4); add('heavy', Math.min(Math.floor(wave / 4), 6)) }
  return out
}

export default function SpaceRaidGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [wave, setWave] = useState(1)
  const [lives, setLives] = useState(3)
  const [waveMsg, setWaveMsg] = useState<string | null>(null)
  const [powerBadges, setPowerBadges] = useState<PowerType[]>([])

  const alive = useRef(false), raf = useRef(0)
  const shipX = useRef(W / 2), shipTargetX = useRef(W / 2), shootT = useRef(0), flashT = useRef(0)
  const bullets = useRef<Bullet[]>([])
  const enemies = useRef<Enemy[]>([])
  const parts = useRef<Particle[]>([])
  const powers = useRef<Power[]>([])
  const activePowers = useRef<{ weapon: number; shield: number; speed: number }>({ weapon: 0, shield: 0, speed: 0 })
  const scoreRef = useRef(0), waveRef = useRef(1), livesRef = useRef(3)

  const stars = useRef(Array.from({ length: 60 }, (_, i) => ({ x: (i * 97 + i * i * 13) % W, y: (i * 53 + i * i * 7) % H, s: i % 5 === 0 ? 1.5 : i % 3 === 0 ? 1.0 : 0.6 })))

  const burst = useCallback((x: number, y: number, col: string, big = false) => {
    const n = big ? 22 : 10
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i + Math.random() * 0.4
      const spd = 1.5 + Math.random() * (big ? 4 : 2.5)
      parts.current.push({ id: ++_id, x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: big ? 45 : 28, maxLife: big ? 45 : 28, color: col, r: big ? 3 + Math.random() * 3 : 1.5 + Math.random() * 2 })
    }
  }, [])

  const syncBadges = useCallback(() => {
    const ap = activePowers.current
    const list: PowerType[] = []
    if (ap.weapon > 0) list.push('weapon')
    if (ap.shield > 0) list.push('shield')
    if (ap.speed > 0) list.push('speed')
    setPowerBadges(list)
  }, [])

  const doEnd = useCallback(() => {
    alive.current = false; snd('over'); vibrate([30, 40, 60])
    cancelAnimationFrame(raf.current)
    addXp(Math.floor(scoreRef.current * 0.3))
    setHighScore('space-raid', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  useEffect(() => {
    if (phase !== 'play') { cancelAnimationFrame(raf.current); return }
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    alive.current = true
    let frame = 0

    function loop() {
      if (!alive.current) return
      frame++
      const CW = W, CH = H
      const ap = activePowers.current
      let badgesChanged = false
      ;(['weapon', 'shield', 'speed'] as const).forEach(k => { if (ap[k] > 0) { ap[k]--; if (ap[k] === 0) badgesChanged = true } })
      if (badgesChanged) syncBadges()

      const moveSpeed = ap.speed > 0 ? 14 : 8
      const dx = shipTargetX.current - shipX.current
      shipX.current += Math.max(-moveSpeed, Math.min(moveSpeed, dx))

      shootT.current++
      const baseRate = Math.max(9, 20 - Math.floor(waveRef.current * 0.4))
      const rate = ap.weapon > 0 ? Math.max(5, Math.floor(baseRate * 0.55)) : baseRate
      if (shootT.current % rate === 0) {
        if (ap.weapon > 0) {
          bullets.current.push({ id: ++_id, x: shipX.current - 8, y: CH - 80, vx: -1, vy: -11, fromEnemy: false })
          bullets.current.push({ id: ++_id, x: shipX.current, y: CH - 80, vx: 0, vy: -11, fromEnemy: false })
          bullets.current.push({ id: ++_id, x: shipX.current + 8, y: CH - 80, vx: 1, vy: -11, fromEnemy: false })
        } else {
          bullets.current.push({ id: ++_id, x: shipX.current, y: CH - 80, vx: 0, vy: -11, fromEnemy: false })
        }
        snd('shoot')
      }
      if (flashT.current > 0) flashT.current--

      bullets.current = bullets.current.map(b => ({ ...b, x: b.x + b.vx, y: b.y + b.vy })).filter(b => b.y > -10 && b.y < CH + 10)

      enemies.current.forEach(e => {
        if (e.type === 'sniper') { e.phase += 0.05 + waveRef.current * 0.002; e.x += Math.sin(e.phase) * 2.6; e.y += e.vy }
        else { e.x += e.vx; e.y += e.vy }
        const hw = CFG[e.type].hw + 4
        if (e.x < hw || e.x > CW - hw) { e.vx *= -1; e.x = Math.max(hw, Math.min(e.x, CW - hw)) }
        if (e.type === 'boss' && e.y < 70) e.y = Math.min(e.y + e.vy, 70)
      })

      const eShootChance = 0.004 + waveRef.current * 0.0016
      enemies.current.forEach(e => {
        const chance = e.type === 'boss' ? 0.035 : eShootChance
        if (Math.random() < chance) bullets.current.push({ id: ++_id, x: e.x, y: e.y + CFG[e.type].hh, vx: e.type === 'boss' ? (shipX.current - e.x) * 0.01 : 0, vy: 3.4 + waveRef.current * 0.12, fromEnemy: true })
      })

      bullets.current = bullets.current.filter(b => {
        if (b.fromEnemy) return true
        for (let i = enemies.current.length - 1; i >= 0; i--) {
          const e = enemies.current[i]; const c = CFG[e.type]
          if (Math.abs(b.x - e.x) < c.hw + 3 && Math.abs(b.y - e.y) < c.hh + 3) {
            snd('hit'); e.hp--
            if (e.hp <= 0) {
              burst(e.x, e.y, c.col, e.type === 'boss' || e.type === 'heavy')
              snd('explode')
              scoreRef.current += c.pts * waveRef.current; setScore(scoreRef.current)
              if (Math.random() < (e.type === 'boss' ? 1 : 0.14)) {
                const types: PowerType[] = ['weapon', 'shield', 'speed']
                powers.current.push({ id: ++_id, x: e.x, y: e.y, type: types[Math.floor(Math.random() * types.length)] })
              }
              enemies.current.splice(i, 1)
            }
            return false
          }
        }
        return true
      })

      powers.current = powers.current.map(p => ({ ...p, y: p.y + 2.2 })).filter(p => {
        if (p.y > CH - 66 - 16 && p.y < CH - 66 + 16 && Math.abs(p.x - shipX.current) < 22) {
          snd('powerup'); vibrate([10, 20, 10])
          if (p.type === 'weapon') activePowers.current.weapon = 720
          else if (p.type === 'shield') activePowers.current.shield = 480
          else activePowers.current.speed = 600
          syncBadges()
          return false
        }
        return p.y < CH + 20
      })

      const px = shipX.current, py = CH - 66
      bullets.current = bullets.current.filter(b => {
        if (!b.fromEnemy) return true
        if (Math.abs(b.x - px) < 18 && b.y > py - 18 && b.y < py + 14) {
          if (activePowers.current.shield > 0) { burst(px, py, '#4CC9F0', false); return false }
          livesRef.current--; setLives(livesRef.current); snd('hurt')
          burst(px, py, PC, false); flashT.current = 20
          if (livesRef.current <= 0) { doEnd(); return false }
          return false
        }
        return true
      })

      if (activePowers.current.shield <= 0 && enemies.current.some(e => Math.abs(e.x - px) < CFG[e.type].hw + 16 && Math.abs(e.y - py) < CFG[e.type].hh + 16)) {
        livesRef.current--; setLives(livesRef.current); snd('hurt'); burst(px, py, PC, true); flashT.current = 20
        if (livesRef.current <= 0) { doEnd(); return }
      }

      if (enemies.current.some(e => e.type !== 'boss' && e.y + CFG[e.type].hh > CH - 50)) { doEnd(); return }

      if (enemies.current.length === 0) {
        const wasBoss = waveRef.current % 5 === 0
        snd(wasBoss ? 'boss' : 'wave')
        waveRef.current++; setWave(waveRef.current)
        setWaveMsg(waveRef.current % 5 === 0 ? 'BOSS INCOMING' : `WAVE ${waveRef.current}`)
        setTimeout(() => setWaveMsg(null), 1600)
        enemies.current = waveEnemies(waveRef.current)
      }

      parts.current = parts.current.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.1, life: p.life - 1 })).filter(p => p.life > 0)

      ctx.fillStyle = '#1A0E0A'; ctx.fillRect(0, 0, CW, CH)
      const st = Date.now()
      stars.current.forEach(s => {
        const y2 = (s.y + st * 0.012) % CH
        ctx.globalAlpha = 0.4 + s.s * 0.15; ctx.fillStyle = 'white'
        ctx.fillRect(s.x, y2, s.s, s.s)
      })
      ctx.globalAlpha = 1
      const nebGrad = ctx.createRadialGradient(CW * 0.7, CH * 0.25, 10, CW * 0.7, CH * 0.25, 90)
      nebGrad.addColorStop(0, 'rgba(255,100,60,0.08)'); nebGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = nebGrad; ctx.fillRect(0, 0, CW, CH)

      parts.current.forEach(p => { ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill() })
      ctx.globalAlpha = 1

      powers.current.forEach(p => {
        ctx.fillStyle = POWER_COL[p.type]
        ctx.beginPath(); ctx.roundRect(p.x - 11, p.y - 11, 22, 22, 6); ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = '900 11px system-ui'; ctx.textAlign = 'center'
        ctx.fillText(POWER_LABEL[p.type], p.x, p.y + 4)
      })

      ctx.fillStyle = '#FFB347'
      bullets.current.filter(b => b.fromEnemy).forEach(b => { ctx.beginPath(); ctx.roundRect(b.x - 2, b.y, 4, 9, 2); ctx.fill() })
      bullets.current.filter(b => !b.fromEnemy).forEach(b => {
        ctx.shadowColor = PC; ctx.shadowBlur = 5
        ctx.fillStyle = PC; ctx.beginPath(); ctx.roundRect(b.x - 1.5, b.y, 3, 13, 1.5); ctx.fill()
        ctx.shadowBlur = 0
      })

      enemies.current.forEach(e => drawEnemy(ctx, e))
      drawShip(ctx, shipX.current, CH - 66, flashT.current, ap.shield > 0)

      ctx.fillStyle = 'rgba(255,159,67,0.08)'; ctx.fillRect(0, CH - 42, CW, 42)
      ctx.fillStyle = 'rgba(255,159,67,0.25)'; ctx.fillRect(0, CH - 42, CW, 1)

      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => { alive.current = false; cancelAnimationFrame(raf.current) }
  }, [phase, burst, doEnd, syncBadges])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || phase !== 'play') return
    const move = (clientX: number) => {
      const r = canvas.getBoundingClientRect()
      const ratio = W / r.width
      shipTargetX.current = Math.max(20, Math.min(W - 20, (clientX - r.left) * ratio))
    }
    const onM = (e: MouseEvent) => move(e.clientX)
    const onT = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX) }
    canvas.addEventListener('mousemove', onM)
    canvas.addEventListener('touchmove', onT, { passive: false })
    canvas.addEventListener('touchstart', onT, { passive: false })
    return () => { canvas.removeEventListener('mousemove', onM); canvas.removeEventListener('touchmove', onT); canvas.removeEventListener('touchstart', onT) }
  }, [phase])

  const startGame = useCallback(() => {
    bullets.current = []; enemies.current = waveEnemies(1); parts.current = []; powers.current = []
    activePowers.current = { weapon: 0, shield: 0, speed: 0 }
    shipX.current = W / 2; shipTargetX.current = W / 2; shootT.current = 0; flashT.current = 0
    scoreRef.current = 0; waveRef.current = 1; livesRef.current = 3
    setScore(0); setWave(1); setLives(3); setWaveMsg(null); setPowerBadges([])
    setPhase('play')
  }, [])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current) }, [])

  const best = highScores['space-raid'] ?? 0

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <svg width={220} height={130} viewBox="0 0 220 130">
        <rect width={220} height={130} rx={16} fill="#1A0E0A" />
        {[[12, 8, 1.4], [65, 10, 1.2], [140, 15, 1.0], [175, 8, 0.9], [55, 80, 0.7], [200, 85, 1.2]].map(([x, y, s], i) => (
          <rect key={i} x={x} y={y} width={s} height={s} fill="white" opacity={0.4} />
        ))}
        <polygon points="55,30 43,46 67,46" fill="#FF9F43" opacity={0.95} />
        <polygon points="95,24 83,40 107,40" fill="#F5B942" opacity={0.95} />
        <rect x={118} y={26} width={24} height={18} rx={4} fill="#FF6B6B" opacity={0.9} />
        <polygon points="120,123 108,116 108,103 120,96 132,103 132,116" fill="#FF9F43" />
        <ellipse cx={120} cy={109} rx={6} ry={9} fill="rgba(255,255,255,0.2)" />
        <ellipse cx={120} cy={126} rx={5} ry={7} fill="#FDBA74" opacity={0.7} />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>SPACE RAID</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>SLIDE TO MOVE · AUTO-FIRE · BOSS EVERY 5 WAVES</p>
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
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>WAVE</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{waveRef.current}</p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{Math.floor(scoreRef.current * 0.3)}</p>
      {scoreRef.current >= best && scoreRef.current > 0 && <p style={{ fontSize: 11, color: '#E9B213', fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>}
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#1A0E0A', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 6px', flexShrink: 0 }}>
        <button onClick={() => { alive.current = false; cancelAnimationFrame(raf.current); onExit() }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>WAVE</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#F5B942', margin: 0, lineHeight: 1.1 }}>{wave}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < lives ? PC : 'rgba(255,255,255,0.1)', boxShadow: i < lives ? `0 0 6px ${PC}` : 'none' }} />
          ))}
        </div>
      </div>

      {powerBadges.length > 0 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '2px 0 4px', flexShrink: 0 }}>
          {powerBadges.map(p => (
            <span key={p} style={{ fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 8, background: `${POWER_COL[p]}33`, color: POWER_COL[p], letterSpacing: '0.08em' }}>
              {p.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasRef} width={W} height={H}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', touchAction: 'none' }} />
        <AnimatePresence>
          {waveMsg && (
            <motion.div key={waveMsg}
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.3, opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#F5B942', letterSpacing: '0.15em', filter: 'drop-shadow(0 2px 14px rgba(245,185,66,0.7))', margin: 0, textAlign: 'center' }}>
                {waveMsg}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
