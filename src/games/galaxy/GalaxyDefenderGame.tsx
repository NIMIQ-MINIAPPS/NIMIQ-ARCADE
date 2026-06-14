import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'

// ── Constants ─────────────────────────────────────────────────────────────────
const BG  = '#FFF9E8'
const W   = 390
const H   = 580
const PC  = '#4CC9F0'   // player color

// ── Types ─────────────────────────────────────────────────────────────────────
type EnemyType = 'scout' | 'tank' | 'zigzag' | 'boss'
interface Enemy   { id:number; x:number; y:number; vx:number; vy:number; hp:number; maxHp:number; type:EnemyType; phase:number }
interface Bullet  { id:number; x:number; y:number; vy:number; fromEnemy:boolean }
interface Particle{ id:number; x:number; y:number; vx:number; vy:number; life:number; maxLife:number; color:string; r:number }

const CFG: Record<EnemyType,{ hw:number; hh:number; baseHp:number; col:string; pts:number }> = {
  scout:  { hw:12, hh:10, baseHp:1,  col:'#FF9F43', pts:10  },
  tank:   { hw:18, hh:14, baseHp:4,  col:'#FF6B6B', pts:40  },
  zigzag: { hw:11, hh:11, baseHp:2,  col:'#C4B5FD', pts:25  },
  boss:   { hw:26, hh:20, baseHp:12, col:'#E040FB', pts:150 },
}

let _id = 0

// ── Audio ─────────────────────────────────────────────────────────────────────
let _ac: AudioContext | null = null
function snd(type: 'shoot'|'hit'|'explode'|'hurt'|'wave'|'doom') {
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const n = (f:number, at:number, d:number, v:number, o:OscillatorType='sine') => {
      const osc = c.createOscillator(), g = c.createGain()
      osc.type = o; osc.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.001, at + d)
      osc.connect(g); g.connect(c.destination); osc.start(at); osc.stop(at + d)
    }
    if (type === 'shoot')   n(700, t, 0.06, 0.04, 'square')
    if (type === 'hit')     n(440, t, 0.08, 0.06, 'triangle')
    if (type === 'explode') { n(200, t, 0.12, 0.1, 'sawtooth'); n(130, t+0.08, 0.18, 0.08, 'square') }
    if (type === 'hurt')    { n(180, t, 0.18, 0.15, 'sawtooth') }
    if (type === 'wave')    [550, 770, 1000].forEach((f,i) => n(f, t+i*0.09, 0.12, 0.08))
    if (type === 'doom')    { n(120, t, 0.6, 0.18, 'sawtooth'); n(80, t+0.4, 0.5, 0.12, 'square') }
  } catch {/**/}
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function hex6(ctx: CanvasRenderingContext2D, cx:number, cy:number, r:number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI/3)*i - Math.PI/6
    i===0 ? ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a)) : ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
  }
  ctx.closePath()
}

function drawShip(ctx: CanvasRenderingContext2D, sx:number, sy:number, flash:number) {
  // Engine trail
  ctx.fillStyle = '#86EFAC'; ctx.globalAlpha = 0.35
  ctx.beginPath(); ctx.ellipse(sx, sy+22, 5, 12, 0, 0, Math.PI*2); ctx.fill()
  ctx.globalAlpha = 1

  // Wings
  ctx.fillStyle = flash>0 ? 'white' : 'rgba(76,201,240,0.6)'
  ctx.beginPath(); ctx.moveTo(sx-14,sy+4); ctx.lineTo(sx-26,sy+18); ctx.lineTo(sx-8,sy+14); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(sx+14,sy+4); ctx.lineTo(sx+26,sy+18); ctx.lineTo(sx+8,sy+14); ctx.closePath(); ctx.fill()

  // Body
  ctx.shadowColor = PC; ctx.shadowBlur = flash>0 ? 20 : 10
  ctx.fillStyle = flash>0 ? 'white' : PC
  hex6(ctx, sx, sy, 16); ctx.fill()
  ctx.shadowBlur = 0

  // Cockpit
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.beginPath(); ctx.ellipse(sx, sy-3, 5, 7, 0, 0, Math.PI*2); ctx.fill()
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  const c = CFG[e.type]
  const { x, y } = e
  ctx.fillStyle = c.col

  if (e.type === 'scout') {
    // Downward arrow
    ctx.beginPath(); ctx.moveTo(x, y+c.hh); ctx.lineTo(x-c.hw, y-c.hh); ctx.lineTo(x+c.hw, y-c.hh); ctx.closePath(); ctx.fill()
    ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fillRect(x-3, y-c.hh+2, 6, c.hh*0.7)
  } else if (e.type === 'tank') {
    ctx.beginPath(); ctx.roundRect(x-c.hw, y-c.hh, c.hw*2, c.hh*2, 4); ctx.fill()
    ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(x-c.hw+2, y-c.hh+2, c.hw*2-4, 5)
    ctx.fillStyle=c.col; ctx.beginPath(); ctx.roundRect(x-3, y-c.hh-5, 6, 8, 2); ctx.fill()
    // HP bar
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(x-c.hw, y+c.hh+2, c.hw*2, 3)
    ctx.fillStyle='#86EFAC'; ctx.fillRect(x-c.hw, y+c.hh+2, c.hw*2*(e.hp/e.maxHp), 3)
  } else if (e.type === 'zigzag') {
    ctx.beginPath(); ctx.moveTo(x,y-c.hh); ctx.lineTo(x+c.hw,y); ctx.lineTo(x,y+c.hh); ctx.lineTo(x-c.hw,y); ctx.closePath(); ctx.fill()
    ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(x,y-c.hh); ctx.lineTo(x+c.hw*0.5,y-2); ctx.lineTo(x,y-2); ctx.closePath(); ctx.fill()
  } else {
    // Boss: big hex with HP ring
    ctx.shadowColor = c.col; ctx.shadowBlur = 12
    hex6(ctx, x, y, c.hw); ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle='rgba(255,255,255,0.15)'; hex6(ctx,x,y,c.hw-6); ctx.fill()
    ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(x,y-5,6,8,0,0,Math.PI*2); ctx.fill()
    // HP arc
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=2
    ctx.beginPath(); ctx.arc(x, y, c.hw+6, -Math.PI/2, -Math.PI/2 + Math.PI*2*(e.hp/e.maxHp), false); ctx.stroke()
  }
}

// ── Enemy spawning ────────────────────────────────────────────────────────────
function makeEnemy(type: EnemyType, wave: number): Enemy {
  const c = CFG[type]; const spd = 0.7 + wave * 0.07
  return {
    id: ++_id, type, hp: c.baseHp + (type==='boss' ? wave : 0), maxHp: c.baseHp, phase: Math.random()*Math.PI*2,
    x: c.hw + 4 + Math.random() * (W - (c.hw+4)*2),
    y: -(c.hh + 4 + Math.random() * 80),
    vx: type==='zigzag' ? (Math.random()>0.5?1:-1)*spd*1.6 : (Math.random()-0.5)*spd*0.8,
    vy: spd * (type==='tank'?0.55 : type==='boss'?0.4 : 1),
  }
}

function waveEnemies(wave: number): Enemy[] {
  const out: Enemy[] = []
  const add = (t: EnemyType, n: number) => { for (let i=0;i<n;i++) out.push(makeEnemy(t, wave)) }
  if (wave <= 3)  { add('scout', 3+wave*2) }
  else if (wave <= 6)  { add('scout', 5+wave); add('tank', wave-2) }
  else if (wave <= 15) { add('scout', 6); add('tank', 3); add('zigzag', wave-4) }
  else if (wave <= 25) { add('scout', 6); add('tank', 4); add('zigzag', 8); if(wave>=20) add('boss', 1) }
  else { add('scout', 6); add('tank', 5); add('zigzag', 10); add('boss', Math.floor(wave/12)) }
  return out
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GalaxyDefenderGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [phase,   setPhase]   = useState<'start'|'play'|'over'>('start')
  const [score,   setScore]   = useState(0)
  const [wave,    setWave]    = useState(1)
  const [lives,   setLives]   = useState(3)
  const [waveMsg, setWaveMsg] = useState<string|null>(null)

  const alive    = useRef(false), raf = useRef(0)
  const shipX    = useRef(W/2), shootT = useRef(0), flashT = useRef(0)
  const bullets  = useRef<Bullet[]>([])
  const enemies  = useRef<Enemy[]>([])
  const parts    = useRef<Particle[]>([])
  const scoreRef = useRef(0), waveRef = useRef(1), livesRef = useRef(3)

  // Stars (static, pre-computed)
  const stars = useRef(Array.from({length:60},(_,i)=>({
    x:(i*97+i*i*13)%W, y:(i*53+i*i*7)%H, s: i%5===0?1.5:i%3===0?1.0:0.6
  })))

  const burst = useCallback((x:number, y:number, col:string, big=false) => {
    const n = big ? 20 : 10
    for (let i = 0; i < n; i++) {
      const a = (Math.PI*2/n)*i + Math.random()*0.4
      const spd = 1.5 + Math.random()*(big?4:2.5)
      parts.current.push({ id:++_id, x, y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
        life:big?45:28, maxLife:big?45:28, color:col, r:big?3+Math.random()*3:1.5+Math.random()*2 })
    }
  }, [])

  const doEnd = useCallback(() => {
    alive.current = false; snd('doom')
    cancelAnimationFrame(raf.current)
    addXp(Math.floor(scoreRef.current * 0.3))
    setHighScore('galaxy-defender', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  // ── Game loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') { cancelAnimationFrame(raf.current); return }

    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width  = W * dpr;  canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    alive.current = true
    let frame = 0

    function loop() {
      if (!alive.current) return
      frame++
      const CW = W, CH = H

      // ── Auto-shoot ───────────────────────────────────────────────────────
      shootT.current++
      const rate = Math.max(10, 22 - Math.floor(waveRef.current * 0.4))
      if (shootT.current % rate === 0) {
        bullets.current.push({ id:++_id, x:shipX.current, y:CH-80, vy:-11, fromEnemy:false })
        snd('shoot')
      }
      if (flashT.current > 0) flashT.current--

      // ── Move player bullets ──────────────────────────────────────────────
      bullets.current = bullets.current.map(b=>({...b, y:b.y+b.vy})).filter(b=>b.y>-10&&b.y<CH+10)

      // ── Move enemies ─────────────────────────────────────────────────────
      enemies.current.forEach(e => {
        if (e.type === 'zigzag') {
          e.phase += 0.055 + waveRef.current * 0.002
          e.x += Math.sin(e.phase) * 2.8
          e.y += e.vy
        } else {
          e.x += e.vx; e.y += e.vy
        }
        // Wall bounce
        const hw = CFG[e.type].hw + 4
        if (e.x < hw || e.x > CW - hw) { e.vx *= -1; e.x = Math.max(hw, Math.min(e.x, CW-hw)) }
      })

      // ── Enemy shoot ──────────────────────────────────────────────────────
      const eShootChance = 0.004 + waveRef.current * 0.002
      enemies.current.forEach(e => {
        if (Math.random() < eShootChance)
          bullets.current.push({ id:++_id, x:e.x, y:e.y+CFG[e.type].hh, vy:3.5+waveRef.current*0.15, fromEnemy:true })
      })

      // ── Player bullets hit enemies ───────────────────────────────────────
      bullets.current = bullets.current.filter(b => {
        if (b.fromEnemy) return true
        for (let i = enemies.current.length-1; i>=0; i--) {
          const e = enemies.current[i]; const c = CFG[e.type]
          if (Math.abs(b.x-e.x)<c.hw+3 && Math.abs(b.y-e.y)<c.hh+3) {
            snd('hit'); e.hp--
            if (e.hp <= 0) {
              burst(e.x, e.y, c.col, e.type==='boss'||e.type==='tank')
              snd('explode')
              scoreRef.current += c.pts * waveRef.current; setScore(scoreRef.current)
              enemies.current.splice(i, 1)
            }
            return false
          }
        }
        return true
      })

      // ── Enemy bullets hit player ─────────────────────────────────────────
      const px = shipX.current, py = CH - 66
      bullets.current = bullets.current.filter(b => {
        if (!b.fromEnemy) return true
        if (Math.abs(b.x-px)<18 && b.y>py-18 && b.y<py+14) {
          livesRef.current--; setLives(livesRef.current); snd('hurt')
          burst(px, py, PC, false); flashT.current = 20
          if (livesRef.current <= 0) { doEnd(); return false }
          return false
        }
        return true
      })

      // ── Enemy reaches player zone ─────────────────────────────────────────
      if (enemies.current.some(e => e.y + CFG[e.type].hh > CH - 50)) { doEnd(); return }

      // ── Wave clear ────────────────────────────────────────────────────────
      if (enemies.current.length === 0) {
        snd('wave'); waveRef.current++; setWave(waveRef.current)
        setWaveMsg(`WAVE ${waveRef.current}`)
        setTimeout(() => setWaveMsg(null), 1600)
        enemies.current = waveEnemies(waveRef.current)
      }

      // ── Particles ─────────────────────────────────────────────────────────
      parts.current = parts.current
        .map(p=>({...p, x:p.x+p.vx, y:p.y+p.vy, vy:p.vy+0.1, life:p.life-1}))
        .filter(p=>p.life>0)

      // ── Draw ──────────────────────────────────────────────────────────────
      // Background
      ctx.fillStyle = '#0F0E2A'; ctx.fillRect(0, 0, CW, CH)

      // Stars (parallax-ish)
      const st = Date.now()
      stars.current.forEach(s => {
        const y2 = (s.y + st*0.012) % CH
        ctx.globalAlpha = 0.4 + s.s*0.15; ctx.fillStyle='white'
        ctx.fillRect(s.x, y2, s.s, s.s)
      })
      ctx.globalAlpha = 1

      // Subtle nebula
      const nebGrad = ctx.createRadialGradient(CW*0.7, CH*0.25, 10, CW*0.7, CH*0.25, 90)
      nebGrad.addColorStop(0, 'rgba(100,60,200,0.08)'); nebGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = nebGrad; ctx.fillRect(0, 0, CW, CH)

      // Particles
      parts.current.forEach(p => {
        ctx.globalAlpha = p.life/p.maxLife
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r*(p.life/p.maxLife), 0, Math.PI*2); ctx.fill()
      })
      ctx.globalAlpha = 1

      // Enemy bullets (orange-red)
      ctx.fillStyle = '#FFB347'
      bullets.current.filter(b=>b.fromEnemy).forEach(b => {
        ctx.beginPath(); ctx.roundRect(b.x-2, b.y, 4, 9, 2); ctx.fill()
      })

      // Player bullets (cyan glow)
      bullets.current.filter(b=>!b.fromEnemy).forEach(b => {
        ctx.shadowColor = PC; ctx.shadowBlur = 5
        ctx.fillStyle = PC; ctx.beginPath(); ctx.roundRect(b.x-1.5, b.y, 3, 13, 1.5); ctx.fill()
        ctx.shadowBlur = 0
      })

      // Enemies
      enemies.current.forEach(e => drawEnemy(ctx, e))

      // Player
      drawShip(ctx, shipX.current, CH - 66, flashT.current)

      // Ground indicator bar
      ctx.fillStyle='rgba(76,201,240,0.08)'; ctx.fillRect(0, CH-42, CW, 42)
      ctx.fillStyle='rgba(76,201,240,0.25)'; ctx.fillRect(0, CH-42, CW, 1)

      raf.current = requestAnimationFrame(loop)
    }

    raf.current = requestAnimationFrame(loop)
    return () => { alive.current = false; cancelAnimationFrame(raf.current) }
  }, [phase, burst, doEnd])

  // ── Controls: touch/mouse ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || phase!=='play') return
    const move = (clientX:number) => {
      const r = canvas.getBoundingClientRect()
      const ratio = W / r.width
      shipX.current = Math.max(20, Math.min(W-20, (clientX - r.left) * ratio))
    }
    const onM = (e:MouseEvent) => move(e.clientX)
    const onT = (e:TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX) }
    canvas.addEventListener('mousemove', onM)
    canvas.addEventListener('touchmove', onT, { passive:false })
    canvas.addEventListener('touchstart', onT, { passive:false })
    return () => {
      canvas.removeEventListener('mousemove', onM)
      canvas.removeEventListener('touchmove', onT)
      canvas.removeEventListener('touchstart', onT)
    }
  }, [phase])

  const startGame = useCallback(() => {
    bullets.current = []; enemies.current = waveEnemies(1); parts.current = []
    shipX.current = W/2; shootT.current = 0; flashT.current = 0
    scoreRef.current = 0; waveRef.current = 1; livesRef.current = 3
    setScore(0); setWave(1); setLives(3); setWaveMsg(null)
    setPhase('play')
  }, [])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current) }, [])

  const best = highScores['galaxy-defender'] ?? 0

  // ── Start screen ──────────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ width:'100%',height:'100%',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24,fontFamily:'system-ui,sans-serif',position:'relative' }}>
      <button onClick={onExit} style={{ position:'absolute',top:20,left:20,background:'none',border:'none',color:'#BBB',fontSize:22,cursor:'pointer' }}>←</button>

      {/* Illustration */}
      <svg width={240} height={140} viewBox="0 0 240 140">
        <rect width={240} height={140} rx={16} fill="#0F0E2A"/>
        {/* Stars */}
        {[[12,8,1.4],[35,20,0.8],[65,10,1.2],[100,6,0.7],[140,15,1.0],[175,8,0.9],[208,22,1.3],[25,55,0.7],[80,48,1.1],[155,42,0.8],[195,60,1.0],[55,80,0.7],[120,72,0.9],[200,85,1.2]].map(([x,y,s],i)=>(
          <rect key={i} x={x} y={y} width={s} height={s} fill="white" opacity={0.35+i*0.02}/>
        ))}
        {/* Nebula glow */}
        <circle cx={185} cy={35} r={35} fill="rgba(100,60,200,0.15)"/>
        {/* Planet */}
        <circle cx={185} cy={35} r={22} fill="#2A1F6E"/>
        <circle cx={185} cy={35} r={22} fill="none" stroke="#4B3F9E" strokeWidth={1}/>
        <ellipse cx={185} cy={35} rx={30} ry={7} fill="none" stroke="#7C6FCD" strokeWidth={1.8} opacity={0.7}/>
        {/* Enemies row */}
        <polygon points="55,30 43,46 67,46" fill="#FF9F43" opacity={0.95}/>
        <polygon points="95,24 83,40 107,40" fill="#C4B5FD" opacity={0.95}/>
        <rect x={118} y={26} width={24} height={18} rx={4} fill="#FF6B6B" opacity={0.9}/>
        <rect x={121} y={26} width={8} height={5} rx={2} fill="#FF9090"/>
        {/* Bullets */}
        <rect x={53} y={47} width={3} height={10} rx={1.5} fill="#4CC9F0" opacity={0.9}/>
        <rect x={93} y={41} width={3} height={10} rx={1.5} fill="#4CC9F0" opacity={0.7}/>
        {/* Player hex ship */}
        <polygon points="120,123 108,116 108,103 120,96 132,103 132,116" fill="#4CC9F0"/>
        <ellipse cx={120} cy={109} rx={6} ry={9} fill="rgba(255,255,255,0.2)"/>
        <polygon points="108,110 96,122 106,118" fill="rgba(76,201,240,0.5)"/>
        <polygon points="132,110 144,122 134,118" fill="rgba(76,201,240,0.5)"/>
        <ellipse cx={120} cy={126} rx={5} ry={7} fill="#86EFAC" opacity={0.7}/>
      </svg>

      <div style={{ textAlign:'center' }}>
        <h1 style={{ fontSize:28,fontWeight:900,color:'#1A1A2E',margin:'0 0 8px',letterSpacing:'0.05em' }}>GALAXY DEFENDER</h1>
        <p style={{ color:'#BBB',fontSize:11,fontWeight:700,letterSpacing:'0.14em',margin:0 }}>SLIDE TO MOVE · AUTO-FIRE</p>
      </div>

      <motion.button whileTap={{ scale:0.96 }} onClick={startGame}
        style={{ background:'#1A1A2E',color:BG,border:'none',borderRadius:16,padding:'16px 64px',fontSize:18,fontWeight:900,cursor:'pointer',letterSpacing:'0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color:'#BBB',fontSize:13,margin:0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  // ── Game over screen ───────────────────────────────────────────────────────
  if (phase === 'over') return (
    <div style={{ width:'100%',height:'100%',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,fontFamily:'system-ui,sans-serif' }}>
      <p style={{ fontSize:12,fontWeight:800,color:'#FF6B6B',letterSpacing:'0.22em',margin:0 }}>GAME OVER</p>
      <p style={{ fontSize:52,fontWeight:900,color:'#1A1A2E',margin:0,lineHeight:1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display:'flex',gap:36 }}>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#BBB',margin:0 }}>WAVE</p>
          <p style={{ fontSize:26,fontWeight:900,color:'#1A1A2E',margin:0 }}>{waveRef.current}</p>
        </div>
      </div>
      <p style={{ fontSize:13,color:'#AAA',margin:0 }}>XP +{Math.floor(scoreRef.current*0.3)}</p>
      {scoreRef.current >= best && scoreRef.current > 0 && (
        <p style={{ fontSize:11,color:'#E9B213',fontWeight:800,margin:0,letterSpacing:'0.15em' }}>NEW BEST</p>
      )}
      <div style={{ display:'flex',gap:10,marginTop:8 }}>
        <motion.button whileTap={{ scale:0.96 }} onClick={startGame}
          style={{ background:'#1A1A2E',color:BG,border:'none',borderRadius:14,padding:'15px 32px',fontSize:14,fontWeight:900,cursor:'pointer',letterSpacing:'0.1em' }}>
          PLAY AGAIN
        </motion.button>
        <motion.button whileTap={{ scale:0.96 }} onClick={onExit}
          style={{ background:'none',color:'#AAA',border:'1.5px solid rgba(0,0,0,0.12)',borderRadius:14,padding:'15px 22px',fontSize:14,fontWeight:700,cursor:'pointer' }}>
          HOME
        </motion.button>
      </div>
    </div>
  )

  // ── Play screen ────────────────────────────────────────────────────────────
  return (
    <div style={{ width:'100%',height:'100%',display:'flex',flexDirection:'column',background:'#0F0E2A',fontFamily:'system-ui,sans-serif' }}>

      {/* HUD */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 20px 6px',flexShrink:0 }}>
        <button onClick={()=>{ alive.current=false; cancelAnimationFrame(raf.current); onExit() }}
          style={{ background:'none',border:'none',color:'rgba(255,255,255,0.35)',fontSize:20,cursor:'pointer',padding:0 }}>←</button>
        <div style={{ display:'flex',gap:20,alignItems:'center' }}>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'rgba(255,255,255,0.35)',margin:0 }}>WAVE</p>
            <p style={{ fontSize:20,fontWeight:900,color:'#C4B5FD',margin:0,lineHeight:1.1 }}>{wave}</p>
          </div>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'rgba(255,255,255,0.35)',margin:0 }}>SCORE</p>
            <p style={{ fontSize:20,fontWeight:900,color:'white',margin:0,lineHeight:1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ display:'flex',gap:5 }}>
          {[0,1,2].map(i=>(
            <div key={i} style={{ width:11,height:11,borderRadius:'50%',
              background: i<lives ? PC : 'rgba(255,255,255,0.1)',
              boxShadow: i<lives ? `0 0 6px ${PC}` : 'none', transition:'all 0.25s' }}/>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex:1,display:'flex',justifyContent:'center',alignItems:'center',overflow:'hidden' }}>
        <canvas ref={canvasRef} width={W} height={H}
          style={{ width:'100%',height:'100%',objectFit:'contain',display:'block',touchAction:'none' }}/>
      </div>

      {/* Wave banner overlay */}
      <AnimatePresence>
        {waveMsg && (
          <motion.div key={waveMsg}
            initial={{ scale:0.6,opacity:0 }} animate={{ scale:1,opacity:1 }} exit={{ scale:1.3,opacity:0 }}
            style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none' }}>
            <p style={{ fontSize:32,fontWeight:900,color:'#C4B5FD',letterSpacing:'0.2em',
              filter:'drop-shadow(0 2px 14px rgba(196,181,253,0.7))',margin:0 }}>
              {waveMsg}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
