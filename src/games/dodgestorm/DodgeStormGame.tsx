import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'

const BG = '#FFF9E8'
const W = 390, H = 580
const PLAYER_R = 9
const WAVE_MS = 9000
const INVULN_MS = 500
const DEATH_FRAMES = 20

type ProjType = 'line' | 'burst' | 'sine' | 'wall'

interface Proj {
  id: number
  type: ProjType
  x: number; y: number
  vx: number; vy: number
  r: number
  color: string
  px: number; py: number
  amp: number; freq: number; age: number
  gapStart: number; gapW: number; thickness: number
}

interface Particle { id: number; x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; r: number }

let _id = 0

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

let _ac: AudioContext | null = null
function snd(type: 'hit' | 'wave' | 'over') {
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
    if (type === 'hit')  { n(220, t, 0.16, 0.16, 'sawtooth'); n(140, t + 0.05, 0.2, 0.12, 'square') }
    if (type === 'wave') [560, 780, 1020].forEach((f, i) => n(f, t + i * 0.08, 0.1, 0.06))
    if (type === 'over') { n(200, t, 0.4, 0.14, 'sawtooth'); n(130, t + 0.28, 0.4, 0.1, 'square') }
  } catch {/**/}
}

function edgePoint(edge: number): { x: number; y: number } {
  switch (edge) {
    case 0: return { x: Math.random() * W, y: -16 }
    case 1: return { x: W + 16, y: Math.random() * H }
    case 2: return { x: Math.random() * W, y: H + 16 }
    default: return { x: -16, y: Math.random() * H }
  }
}

function pickType(wave: number): ProjType {
  const opts: [ProjType, number][] = [['line', 5]]
  if (wave >= 2) opts.push(['burst', 1.6])
  if (wave >= 3) opts.push(['sine', 1.9])
  if (wave >= 2) opts.push(['wall', 0.5])
  const total = opts.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [t, w] of opts) { if (r < w) return t; r -= w }
  return 'line'
}

function spawnLine(wave: number, px: number, py: number, sine: boolean): Proj {
  const edge = Math.floor(Math.random() * 4)
  const { x, y } = edgePoint(edge)
  const baseAngle = Math.atan2(py - y, px - x)
  const angle = baseAngle + (Math.random() - 0.5) * 1.0
  const speed = 1.9 + wave * 0.14 + Math.random() * 0.6
  const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed
  return {
    id: ++_id, type: sine ? 'sine' : 'line', x, y, vx, vy, r: 5,
    color: sine ? '#C4B5FD' : '#93DCFF',
    px: sine ? -vy / speed : 0, py: sine ? vx / speed : 0,
    amp: sine ? 14 + Math.random() * 10 : 0, freq: sine ? 0.05 + Math.random() * 0.03 : 0, age: 0,
    gapStart: 0, gapW: 0, thickness: 0,
  }
}

function spawnBurst(wave: number): Proj[] {
  const edge = Math.floor(Math.random() * 4)
  const origin = edgePoint(edge)
  const n = Math.min(6 + Math.floor(wave * 0.8), 26)
  const speed = 1.6 + wave * 0.1
  const rot = Math.random() * Math.PI * 2
  const arr: Proj[] = []
  for (let i = 0; i < n; i++) {
    const a = rot + (Math.PI * 2 / n) * i
    arr.push({
      id: ++_id, type: 'burst', x: origin.x, y: origin.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 5,
      color: '#FDBA74', px: 0, py: 0, amp: 0, freq: 0, age: 0, gapStart: 0, gapW: 0, thickness: 0,
    })
  }
  return arr
}

function spawnWall(wave: number): Proj {
  const gapW = Math.max(70 - wave * 1.5, 34)
  const gapStart = 20 + Math.random() * (W - 40 - gapW)
  const speed = 0.9 + wave * 0.05
  return {
    id: ++_id, type: 'wall', x: 0, y: -30, vx: 0, vy: speed, r: 0, color: '#FF6B6B',
    px: 0, py: 0, amp: 0, freq: 0, age: 0, gapStart, gapW, thickness: 26,
  }
}

export default function DodgeStormGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [wave, setWave] = useState(1)
  const [waveMsg, setWaveMsg] = useState<string | null>(null)

  const projectiles = useRef<Proj[]>([])
  const particles = useRef<Particle[]>([])
  const trailRef = useRef<{ x: number; y: number }[]>([])
  const playerPos = useRef({ x: W / 2, y: H * 0.72 })
  const targetPos = useRef({ x: W / 2, y: H * 0.72 })
  const alive = useRef(false), raf = useRef(0)
  const scoreRef = useRef(0), waveRef = useRef(1), dyingRef = useRef(0)
  const startTimeRef = useRef(0), invulnUntilRef = useRef(0)
  const spawnTimer = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)
  const waveMsgTimer = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)

  const burst = useCallback((x: number, y: number, color: string, n = 16) => {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i + Math.random() * 0.4
      const spd = 1.5 + Math.random() * 3.5
      particles.current.push({ id: ++_id, x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 30, maxLife: 30, color, r: 1.5 + Math.random() * 2 })
    }
  }, [])

  const doEnd = useCallback(() => {
    alive.current = false
    clearTimeout(spawnTimer.current); clearTimeout(waveMsgTimer.current)
    vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.35))
    setHighScore('dodge-storm', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const hit = useCallback(() => {
    if (dyingRef.current > 0) return
    dyingRef.current = DEATH_FRAMES
    snd('hit'); vibrate([30, 20, 40])
    burst(playerPos.current.x, playerPos.current.y, '#FF6B6B', 22)
  }, [burst])

  const doSpawn = useCallback(() => {
    const wv = waveRef.current
    const type = pickType(wv)
    const p = playerPos.current
    if (type === 'line') projectiles.current.push(spawnLine(wv, p.x, p.y, false))
    else if (type === 'sine') projectiles.current.push(spawnLine(wv, p.x, p.y, true))
    else if (type === 'burst') projectiles.current.push(...spawnBurst(wv))
    else projectiles.current.push(spawnWall(wv))
  }, [])

  const scheduleSpawn = useCallback(() => {
    const wv = waveRef.current
    const rate = Math.max(120, 780 - wv * 38)
    spawnTimer.current = setTimeout(() => {
      if (!alive.current) return
      doSpawn()
      scheduleSpawn()
    }, rate)
  }, [doSpawn])

  const loop = useCallback(() => {
    if (!alive.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) { raf.current = requestAnimationFrame(loop); return }

    const now = Date.now()
    const elapsed = now - startTimeRef.current
    const pl = playerPos.current, tgt = targetPos.current

    if (dyingRef.current === 0) {
      pl.x += (tgt.x - pl.x) * 0.22
      pl.y += (tgt.y - pl.y) * 0.22
      pl.x = clamp(pl.x, PLAYER_R + 4, W - PLAYER_R - 4)
      pl.y = clamp(pl.y, PLAYER_R + 4, H - PLAYER_R - 4)

      trailRef.current.push({ x: pl.x, y: pl.y })
      if (trailRef.current.length > 10) trailRef.current.shift()

      const newWave = 1 + Math.floor(elapsed / WAVE_MS)
      if (newWave !== waveRef.current) {
        waveRef.current = newWave
        setWave(newWave)
        snd('wave')
        setWaveMsg(`WAVE ${newWave}`)
        clearTimeout(waveMsgTimer.current)
        waveMsgTimer.current = setTimeout(() => setWaveMsg(null), 1300)
      }

      const newScore = Math.floor(elapsed / 100) + (waveRef.current - 1) * 40
      if (newScore !== scoreRef.current) {
        scoreRef.current = newScore
        setScore(newScore)
      }

      projectiles.current.forEach(pr => {
        if (pr.type === 'wall') { pr.y += pr.vy }
        else {
          pr.x += pr.vx; pr.y += pr.vy
          if (pr.type === 'sine') pr.age += 1
        }
      })
      projectiles.current = projectiles.current.filter(pr => {
        if (pr.type === 'wall') return pr.y - pr.thickness < H + 30
        return pr.x > -70 && pr.x < W + 70 && pr.y > -70 && pr.y < H + 70
      })

      const invuln = now < invulnUntilRef.current
      if (!invuln) {
        for (const pr of projectiles.current) {
          if (pr.type === 'wall') {
            const half = pr.thickness / 2
            if (pl.y > pr.y - half && pl.y < pr.y + half) {
              if (pl.x < pr.gapStart - PLAYER_R || pl.x > pr.gapStart + pr.gapW + PLAYER_R) { hit(); break }
            }
          } else {
            let ex = pr.x, ey = pr.y
            if (pr.type === 'sine') {
              const off = Math.sin(pr.age * pr.freq) * pr.amp
              ex = pr.x + pr.px * off; ey = pr.y + pr.py * off
            }
            const dx = ex - pl.x, dy = ey - pl.y
            if (dx * dx + dy * dy < (pr.r + PLAYER_R) * (pr.r + PLAYER_R)) { hit(); break }
          }
        }
      }
    } else {
      dyingRef.current--
      if (dyingRef.current === 0) { snd('over'); doEnd() }
    }

    particles.current = particles.current
      .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.08, life: p.life - 1 }))
      .filter(p => p.life > 0)

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#171334'); grad.addColorStop(1, '#0B0920')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

    trailRef.current.forEach((p, i) => {
      const t = (i + 1) / trailRef.current.length
      ctx.globalAlpha = t * 0.35
      ctx.fillStyle = '#7DE3FF'
      ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R * 0.6 * t, 0, Math.PI * 2); ctx.fill()
    })
    ctx.globalAlpha = 1

    projectiles.current.forEach(pr => {
      if (pr.type === 'wall') {
        const half = pr.thickness / 2
        ctx.fillStyle = 'rgba(255,107,107,0.3)'
        ctx.fillRect(0, pr.y - half, pr.gapStart, half * 2)
        ctx.fillRect(pr.gapStart + pr.gapW, pr.y - half, W - (pr.gapStart + pr.gapW), half * 2)
        ctx.strokeStyle = 'rgba(255,107,107,0.6)'; ctx.lineWidth = 2
        ctx.strokeRect(0, pr.y - half, pr.gapStart, half * 2)
        ctx.strokeRect(pr.gapStart + pr.gapW, pr.y - half, W - (pr.gapStart + pr.gapW), half * 2)
      } else {
        let ex = pr.x, ey = pr.y
        if (pr.type === 'sine') {
          const off = Math.sin(pr.age * pr.freq) * pr.amp
          ex = pr.x + pr.px * off; ey = pr.y + pr.py * off
        }
        ctx.save()
        ctx.shadowColor = pr.color; ctx.shadowBlur = 8
        ctx.fillStyle = pr.color
        ctx.beginPath(); ctx.arc(ex, ey, pr.r, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }
    })

    particles.current.forEach(p => {
      ctx.globalAlpha = p.life / p.maxLife
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
    })
    ctx.globalAlpha = 1

    ctx.save()
    ctx.shadowColor = dyingRef.current > 0 ? '#FF6B6B' : '#7DE3FF'
    ctx.shadowBlur = dyingRef.current > 0 ? 26 : 14
    ctx.fillStyle = dyingRef.current > 0 ? '#FF6B6B' : '#7DE3FF'
    ctx.beginPath(); ctx.arc(pl.x, pl.y, PLAYER_R, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath(); ctx.arc(pl.x - 3, pl.y - 3, PLAYER_R * 0.4, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    if (now < invulnUntilRef.current) {
      ctx.strokeStyle = 'rgba(147,220,255,0.5)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(pl.x, pl.y, PLAYER_R + 8, 0, Math.PI * 2); ctx.stroke()
    }

    if (dyingRef.current > 0) {
      ctx.fillStyle = `rgba(255,60,60,${(dyingRef.current / DEATH_FRAMES) * 0.5})`
      ctx.fillRect(0, 0, W, H)
    }

    if (alive.current) raf.current = requestAnimationFrame(loop)
  }, [hit, doEnd])

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
    const getPos = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect()
      return { x: (clientX - r.left) * (W / r.width), y: (clientY - r.top) * (H / r.height) }
    }
    const setTarget = (x: number, y: number) => {
      targetPos.current = { x: clamp(x, PLAYER_R + 4, W - PLAYER_R - 4), y: clamp(y, PLAYER_R + 4, H - PLAYER_R - 4) }
    }
    const onMD = (e: MouseEvent) => { const p = getPos(e.clientX, e.clientY); setTarget(p.x, p.y) }
    const onMM = (e: MouseEvent) => { const p = getPos(e.clientX, e.clientY); setTarget(p.x, p.y) }
    const onMU = () => {/* no-op: target holds last position */}
    const onTS = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); setTarget(p.x, p.y) }
    const onTM = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); setTarget(p.x, p.y) }
    const onTE = (e: TouchEvent) => { e.preventDefault() }
    canvas.addEventListener('mousedown', onMD)
    canvas.addEventListener('mousemove', onMM)
    canvas.addEventListener('mouseup', onMU)
    canvas.addEventListener('touchstart', onTS, { passive: false })
    canvas.addEventListener('touchmove', onTM, { passive: false })
    canvas.addEventListener('touchend', onTE, { passive: false })
    return () => {
      canvas.removeEventListener('mousedown', onMD); canvas.removeEventListener('mousemove', onMM); canvas.removeEventListener('mouseup', onMU)
      canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); canvas.removeEventListener('touchend', onTE)
    }
  }, [phase])

  const startGame = useCallback(() => {
    projectiles.current = []; particles.current = []; trailRef.current = []
    playerPos.current = { x: W / 2, y: H * 0.72 }; targetPos.current = { x: W / 2, y: H * 0.72 }
    scoreRef.current = 0; waveRef.current = 1; dyingRef.current = 0
    setScore(0); setWave(1); setWaveMsg(null)
    startTimeRef.current = Date.now()
    invulnUntilRef.current = Date.now() + INVULN_MS
    alive.current = true
    clearTimeout(spawnTimer.current)
    scheduleSpawn()
    setPhase('play')
  }, [scheduleSpawn])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current); clearTimeout(spawnTimer.current); clearTimeout(waveMsgTimer.current) }, [])

  const best = highScores['dodge-storm'] ?? 0

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <svg width={160} height={100} viewBox="0 0 160 100">
        <rect width={160} height={100} rx={16} fill="#171334" />
        <circle cx={80} cy={70} r={10} fill="#7DE3FF" opacity={0.95} />
        <circle cx={20} cy={20} r={6} fill="#93DCFF" opacity={0.85} />
        <circle cx={140} cy={15} r={6} fill="#FDBA74" opacity={0.85} />
        <circle cx={30} cy={85} r={5} fill="#C4B5FD" opacity={0.85} />
        <circle cx={135} cy={55} r={5} fill="#FF6B6B" opacity={0.8} />
        <path d="M20,20 L70,60" stroke="#93DCFF" strokeWidth="1.5" strokeDasharray="3 3" opacity={0.5} />
        <path d="M140,15 L85,60" stroke="#FDBA74" strokeWidth="1.5" strokeDasharray="3 3" opacity={0.5} />
        <path d="M135,55 L88,68" stroke="#FF6B6B" strokeWidth="1.5" strokeDasharray="3 3" opacity={0.5} />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>DODGE STORM</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>DRAG TO DODGE · SURVIVE THE STORM</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('dodge-storm')) startGame(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', position: 'relative', fontFamily: 'system-ui,sans-serif' }}>
      <HowToPlayOverlay bg={BG} accent="#7DE3FF" bullets={TUTORIALS['dodge-storm']}
        onStart={() => { markTutorialSeen('dodge-storm'); startGame() }} />
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>GAME OVER</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>WAVES SURVIVED</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{waveRef.current}</p>
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0B0920', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 6px', flexShrink: 0 }}>
        <button onClick={() => {
            if (alive.current) {
              alive.current = false
              cancelAnimationFrame(raf.current)
              if (scoreRef.current > 0) { addXp(Math.floor(scoreRef.current * 0.35)); setHighScore('dodge-storm', scoreRef.current) }
            }
            onExit()
          }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>WAVE</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#C4B5FD', margin: 0, lineHeight: 1.1 }}>{wave}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ width: 20 }} />
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasRef} width={W} height={H}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', touchAction: 'none' }} />
        <AnimatePresence>
          {waveMsg && (
            <motion.div key={waveMsg}
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.3, opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#C4B5FD', letterSpacing: '0.15em', filter: 'drop-shadow(0 2px 14px rgba(196,181,253,0.7))', margin: 0, textAlign: 'center' }}>
                {waveMsg}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
