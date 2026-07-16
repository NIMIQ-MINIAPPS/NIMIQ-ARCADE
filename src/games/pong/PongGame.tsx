import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'

const W = 380, H = 560, PAD_W = 80, PAD_H = 10, BALL_S = 10, WIN = 7
const PLAYER_COL = '#4CC9F0', AI_COL = '#FF9F43', CHAOS_COL = '#FDBA74', OBST_COL = '#C4B5FD'

interface Ball { x: number; y: number; vx: number; vy: number; chaos: boolean; fast: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }

let _ac: AudioContext | null = null
function snd(type: 'hit' | 'aiHit' | 'score' | 'aiScore' | 'wall' | 'win' | 'lose' | 'spawn') {
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
    if (type === 'hit')     n(560, t, 0.06, 0.06, 'square')
    if (type === 'aiHit')   n(340, t, 0.06, 0.05, 'square')
    if (type === 'wall')    n(700, t, 0.04, 0.03, 'triangle')
    if (type === 'score')   [660, 880, 1100].forEach((f, i) => n(f, t + i * 0.06, 0.11, 0.07))
    if (type === 'aiScore') n(180, t, 0.2, 0.13, 'sawtooth')
    if (type === 'spawn')   n(950, t, 0.08, 0.05, 'sine')
    if (type === 'win')     [523, 659, 784, 1046].forEach((f, i) => n(f, t + i * 0.09, 0.16, 0.08))
    if (type === 'lose')    { n(200, t, 0.5, 0.15, 'sawtooth'); n(140, t + 0.35, 0.4, 0.1, 'square') }
  } catch {/**/}
}

type Difficulty = 'easy' | 'medium' | 'hard'

const AI_TIERS: Record<Difficulty, {
  speedBase: number; speedRate: number; speedCap: number
  lagBase: number; lagRate: number; lagMin: number
  errBase: number; errRate: number; errMin: number
  smartDiv: number; smartCap: number
}> = {
  easy: { speedBase: 2.2, speedRate: 0.22, speedCap: 5.2, lagBase: 9, lagRate: 0.5, lagMin: 2, errBase: 40, errRate: 2.2, errMin: 6, smartDiv: 20, smartCap: 0.7 },
  medium: { speedBase: 3, speedRate: 0.32, speedCap: 7.2, lagBase: 7, lagRate: 0.5, lagMin: 1, errBase: 30, errRate: 2.2, errMin: 2, smartDiv: 12, smartCap: 1 },
  hard: { speedBase: 4, speedRate: 0.4, speedCap: 8.5, lagBase: 5, lagRate: 0.5, lagMin: 0.5, errBase: 20, errRate: 2.2, errMin: 1, smartDiv: 6, smartCap: 1 },
}

function aiParams(totalPts: number, difficulty: Difficulty) {
  const t = AI_TIERS[difficulty]
  return {
    speed: Math.min(t.speedBase + totalPts * t.speedRate, t.speedCap),
    lag: Math.max(t.lagMin, t.lagBase - totalPts * t.lagRate),
    error: Math.max(t.errMin, t.errBase - totalPts * t.errRate),
    smart: Math.min(totalPts / t.smartDiv, t.smartCap),
  }
}

export default function PongGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()

  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [pScore, setPScore] = useState(0)
  const [aScore, setAScore] = useState(0)
  const [won, setWon] = useState(false)
  const [serveMsg, setServeMsg] = useState<string | null>(null)
  const [effectMsg, setEffectMsg] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  const playerX = useRef(W / 2 - PAD_W / 2)
  const aiX = useRef(W / 2 - PAD_W / 2)
  const aiTargetLag = useRef(0)
  const balls = useRef<Ball[]>([])
  const obstacle = useRef<{ x: number; y: number; vx: number; ttl: number } | null>(null)
  const parts = useRef<Particle[]>([])
  const ps = useRef(0), as_ = useRef(0)
  const raf = useRef(0), alive = useRef(false), frame = useRef(0)
  const serving = useRef(false)
  const usedThresholds = useRef<Set<number>>(new Set())

  const burst = useCallback((x: number, y: number, color: string) => {
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 / 10) * i
      parts.current.push({ x, y, vx: Math.cos(a) * (1 + Math.random() * 2), vy: Math.sin(a) * (1 + Math.random() * 2), life: 24, maxLife: 24, color })
    }
  }, [])

  const spawnBall = useCallback((toPlayer: boolean, opts: Partial<Ball> = {}): Ball => ({
    x: W / 2, y: H / 2,
    vx: (Math.random() > 0.5 ? 1 : -1) * 3,
    vy: (toPlayer ? 1 : -1) * (opts.fast ? 4.6 : 3),
    chaos: false, fast: false,
    ...opts,
  }), [])

  const serve = useCallback((toPlayer: boolean) => {
    serving.current = true
    setServeMsg('READY')
    setTimeout(() => {
      balls.current = [spawnBall(toPlayer)]
      serving.current = false
      setServeMsg(null)
    }, 550)
  }, [spawnBall])

  const finish = useCallback((playerWon: boolean) => {
    const sc = ps.current * 100
    snd(playerWon ? 'win' : 'lose')
    vibrate(playerWon ? [20, 40, 20, 40, 60] : [50, 30, 50])
    addXp(Math.floor(sc * 0.3))
    setHighScore('pong-duel', sc)
    setWon(playerWon)
    setPhase('over')
  }, [addXp, setHighScore])

  // Exiting mid-game still banks whatever XP/score has been earned so far.
  // Guarded by `alive` so it never double-fires against a natural finish()
  // that already ran (or against a second click of the exit button).
  const handleExit = useCallback(() => {
    if (alive.current) {
      alive.current = false
      const sc = ps.current * 100
      addXp(Math.floor(sc * 0.3))
      setHighScore('pong-duel', sc)
    }
    onExit()
  }, [addXp, setHighScore, onExit])

  // ── Game loop ────────────────────────────────────────────────────────
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
      const totalPts = ps.current + as_.current
      const ai = aiParams(totalPts, difficulty)

      // Unlock special effects at score thresholds
      const unlock = (n: number, label: string, fn: () => void) => {
        if (totalPts >= n && !usedThresholds.current.has(n)) {
          usedThresholds.current.add(n); fn()
          setEffectMsg(label); setTimeout(() => setEffectMsg(null), 1300)
        }
      }
      if (!serving.current) {
        unlock(3, 'CHAOS BALL', () => { snd('spawn'); balls.current.push(spawnBall(Math.random() > 0.5, { chaos: true })) })
        unlock(6, 'FAST BALL', () => { balls.current.forEach(b => { b.fast = true; const s = Math.hypot(b.vx, b.vy); const m = 4.6 / s; b.vx *= m; b.vy *= m } ) })
        unlock(9, 'OBSTACLE', () => { obstacle.current = { x: W / 2, y: H / 2, vx: 1.6, ttl: 500 } })
      }

      // AI movement — predicts ball trajectory with wall reflection, blended with raw tracking by skill
      if (!serving.current) {
        const mainBall = balls.current.find(b => !b.chaos) ?? balls.current[0]
        if (mainBall) {
          aiTargetLag.current++
          if (aiTargetLag.current >= ai.lag) {
            aiTargetLag.current = 0
            let target = mainBall.x
            if (mainBall.vy < 0) {
              const dt = (60 - mainBall.y) / mainBall.vy
              const raw = mainBall.x + mainBall.vx * dt
              const period = 2 * W
              const m = ((raw % period) + period) % period
              const predicted = m <= W ? m : period - m
              target = mainBall.x + (predicted - mainBall.x) * ai.smart
            }
            target += (Math.random() - 0.5) * ai.error
            const ac = aiX.current + PAD_W / 2
            if (target < ac - 4) aiX.current -= ai.speed
            else if (target > ac + 4) aiX.current += ai.speed
          }
        }
        aiX.current = Math.max(0, Math.min(W - PAD_W, aiX.current))
      }

      // Obstacle
      if (obstacle.current) {
        const o = obstacle.current
        o.x += o.vx; o.ttl--
        if (o.x < 24 || o.x > W - 24) o.vx *= -1
        if (o.ttl <= 0) obstacle.current = null
      }

      // Balls
      if (!serving.current) {
        balls.current.forEach(b => {
          b.x += b.vx; b.y += b.vy
          if (b.x < BALL_S / 2 || b.x > W - BALL_S / 2) { b.vx *= -1; snd('wall') }

          if (obstacle.current) {
            const o = obstacle.current
            if (Math.abs(b.x - o.x) < 20 && Math.abs(b.y - o.y) < 12) { b.vy *= -1; b.vx += (Math.random() - 0.5) * 1.5; snd('wall'); burst(o.x, o.y, OBST_COL) }
          }

          if (b.vy > 0 && b.y + BALL_S / 2 >= H - 50 && b.y + BALL_S / 2 <= H - 38 &&
            b.x >= playerX.current - 4 && b.x <= playerX.current + PAD_W + 4) {
            b.vy *= -1; b.vx += (b.x - (playerX.current + PAD_W / 2)) * 0.08; b.vy *= 1.025
            snd('hit'); vibrate(8); burst(b.x, b.y, PLAYER_COL)
          }
          if (b.vy < 0 && b.y - BALL_S / 2 <= 50 && b.y - BALL_S / 2 >= 40 &&
            b.x >= aiX.current - 4 && b.x <= aiX.current + PAD_W + 4) {
            b.vy *= -1; b.vy *= 1.025
            snd('aiHit'); burst(b.x, b.y, AI_COL)
          }
        })

        // Chaos balls just bounce off top/bottom (no scoring), main ball scores
        balls.current = balls.current.filter(b => {
          if (b.chaos) {
            if (b.y < 0 || b.y > H) { b.vy *= -1; b.y = Math.max(4, Math.min(H - 4, b.y)) }
            return true
          }
          if (b.y > H) {
            as_.current++; setAScore(as_.current); snd('aiScore'); vibrate(30)
            if (as_.current >= WIN) { alive.current = false; finish(false); return false }
            serve(true); return false
          }
          if (b.y < 0) {
            ps.current++; setPScore(ps.current); snd('score'); vibrate([10, 15, 10])
            if (ps.current >= WIN) { alive.current = false; finish(true); return false }
            serve(false); return false
          }
          return true
        })
      }

      parts.current = parts.current.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1 })).filter(p => p.life > 0)

      // ── Draw ──────────────────────────────────────────────────────────
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#171334'); grad.addColorStop(1, '#0E0B22')
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

      ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.setLineDash([])

      if (obstacle.current) {
        const o = obstacle.current
        ctx.fillStyle = OBST_COL; ctx.globalAlpha = Math.min(1, o.ttl / 60)
        ctx.beginPath(); ctx.roundRect(o.x - 18, o.y - 10, 36, 20, 6); ctx.fill()
        ctx.globalAlpha = 1
      }

      parts.current.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill()
      })
      ctx.globalAlpha = 1

      ctx.shadowColor = PLAYER_COL; ctx.shadowBlur = 8
      ctx.fillStyle = PLAYER_COL
      ctx.beginPath(); ctx.roundRect(playerX.current, H - 50, PAD_W, PAD_H, 5); ctx.fill()
      ctx.shadowColor = AI_COL; ctx.fillStyle = AI_COL
      ctx.beginPath(); ctx.roundRect(aiX.current, 40, PAD_W, PAD_H, 5); ctx.fill()
      ctx.shadowBlur = 0

      balls.current.forEach(b => {
        ctx.shadowColor = b.chaos ? CHAOS_COL : 'white'; ctx.shadowBlur = b.fast ? 12 : 6
        ctx.fillStyle = b.chaos ? CHAOS_COL : 'white'
        ctx.beginPath(); ctx.roundRect(b.x - BALL_S / 2, b.y - BALL_S / 2, BALL_S, BALL_S, 3); ctx.fill()
      })
      ctx.shadowBlur = 0

      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '900 34px system-ui'; ctx.textAlign = 'center'
      ctx.fillText(`${as_.current}`, W / 2, H / 2 - 20)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillText(`${ps.current}`, W / 2, H / 2 + 50)

      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => { alive.current = false; cancelAnimationFrame(raf.current) }
  }, [phase, burst, finish, serve, spawnBall, difficulty])

  const startGame = useCallback(() => {
    ps.current = 0; as_.current = 0; setPScore(0); setAScore(0)
    setPhase('play'); setWon(false); setEffectMsg(null)
    playerX.current = W / 2 - PAD_W / 2; aiX.current = W / 2 - PAD_W / 2
    obstacle.current = null; usedThresholds.current = new Set(); parts.current = []
    serve(true)
  }, [serve])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || phase !== 'play') return
    const move = (clientX: number) => {
      const r = canvas.getBoundingClientRect()
      const ratio = W / r.width
      playerX.current = Math.max(0, Math.min(W - PAD_W, (clientX - r.left) * ratio - PAD_W / 2))
    }
    const onM = (e: MouseEvent) => move(e.clientX)
    const onT = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX) }
    canvas.addEventListener('mousemove', onM)
    canvas.addEventListener('touchmove', onT, { passive: false })
    canvas.addEventListener('touchstart', onT, { passive: false })
    return () => {
      canvas.removeEventListener('mousemove', onM)
      canvas.removeEventListener('touchmove', onT)
      canvas.removeEventListener('touchstart', onT)
    }
  }, [phase])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current) }, [])

  const sc = pScore * 100
  const best = highScores['pong-duel'] ?? 0
  const BG = '#FFF9E8'

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <svg width={200} height={130} viewBox="0 0 200 130">
        <rect width={200} height={130} rx={16} fill="#171334" />
        <line x1={100} y1={8} x2={100} y2={122} stroke="rgba(255,255,255,0.15)" strokeWidth={2} strokeDasharray="6,5" />
        <rect x={16} y={40} width={10} height={44} rx={4} fill={PLAYER_COL} />
        <rect x={174} y={46} width={10} height={44} rx={4} fill={AI_COL} />
        <circle cx={100} cy={65} r={7} fill="white" />
        <text x={50} y={26} textAnchor="middle" fill={AI_COL} fontSize="16" fontWeight="900" fontFamily="system-ui">3</text>
        <text x={150} y={26} textAnchor="middle" fill={PLAYER_COL} fontSize="16" fontWeight="900" fontFamily="system-ui">5</text>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>PONG DUEL</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>SLIDE TO MOVE · FIRST TO {WIN}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <p style={{ color: '#BBB', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', margin: 0 }}>DIFFICULTY</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['easy', 'medium', 'hard'] as const).map(d => (
            <button key={d} onClick={() => setDifficulty(d)}
              style={{
                background: difficulty === d ? '#1A1A2E' : 'transparent',
                color: difficulty === d ? BG : '#1A1A2E',
                border: '1.5px solid #1A1A2E',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.08em',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('pong-duel')) startGame(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <HowToPlayOverlay
        bg="#171334"
        accent="#E9B213"
        bullets={TUTORIALS['pong-duel']}
        onStart={() => { markTutorialSeen('pong-duel'); startGame() }}
      />
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: won ? '#27AE60' : '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>{won ? 'YOU WIN!' : 'YOU LOSE'}</p>
      <p style={{ fontSize: 44, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{pScore} — {aScore}</p>
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{Math.floor(sc * 0.3)}</p>
      {sc > 0 && sc >= best && <p style={{ fontSize: 11, color: '#E9B213', fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>}
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0E0B22', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 6px', flexShrink: 0 }}>
        <button onClick={handleExit} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: AI_COL, margin: 0, opacity: 0.7 }}>AI</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: AI_COL, margin: 0, lineHeight: 1.1 }}>{aScore}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: PLAYER_COL, margin: 0, opacity: 0.7 }}>YOU</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: PLAYER_COL, margin: 0, lineHeight: 1.1 }}>{pScore}</p>
          </div>
        </div>
        <p style={{ width: 46, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', margin: 0, textAlign: 'right', textTransform: 'uppercase' }}>{difficulty}</p>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasRef} width={W} height={H}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', touchAction: 'none' }} />
        <AnimatePresence>
          {serveMsg && (
            <motion.div key="serve" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.2em', margin: 0 }}>{serveMsg}</p>
            </motion.div>
          )}
          {effectMsg && (
            <motion.div key={effectMsg} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '38%', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 15, fontWeight: 900, color: '#FDBA74', letterSpacing: '0.15em', filter: 'drop-shadow(0 2px 10px rgba(253,186,116,0.6))', margin: 0 }}>{effectMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
