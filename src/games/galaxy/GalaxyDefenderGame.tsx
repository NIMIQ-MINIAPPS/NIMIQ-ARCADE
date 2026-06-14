import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'

const BG = '#FFF9E8'

// ── Types ─────────────────────────────────────────────────────────────────────
type EnemyType = 'scout' | 'tank' | 'zigzag' | 'boss'
interface Enemy  { id:number; x:number; y:number; vx:number; vy:number; hp:number; maxHp:number; type:EnemyType; color:string; phase:number }
interface Bullet { id:number; x:number; y:number; vy:number; fromEnemy:boolean }
interface Particle{ id:number; x:number; y:number; vx:number; vy:number; life:number; maxLife:number; color:string; size:number }

const ENEMY_CFG: Record<EnemyType,{ w:number; h:number; hp:number; color:string; pts:number }> = {
  scout:  { w:22, h:16, hp:1, color:'#FF9F43', pts:10  },
  tank:   { w:32, h:24, hp:4, color:'#FF6B6B', pts:40  },
  zigzag: { w:20, h:18, hp:2, color:'#C4B5FD', pts:25  },
  boss:   { w:48, h:36, hp:12,color:'#FF6B6B', pts:150 },
}

let _eid = 0

// ── Audio ─────────────────────────────────────────────────────────────────────
let _ac: AudioContext | null = null
function snd(type: 'shoot'|'hit'|'explode'|'player_hit'|'wave'|'doom') {
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const n = (f:number,at:number,d:number,v:number,o:OscillatorType='sine') => {
      const osc=c.createOscillator(),g=c.createGain(); osc.type=o; osc.frequency.setValueAtTime(f,at)
      g.gain.setValueAtTime(v,at); g.gain.exponentialRampToValueAtTime(0.001,at+d)
      osc.connect(g); g.connect(c.destination); osc.start(at); osc.stop(at+d)
    }
    if (type==='shoot')      n(660,t,0.06,0.05,'square')
    if (type==='hit')        n(440,t,0.08,0.07,'triangle')
    if (type==='explode')    { n(200,t,0.15,0.12,'sawtooth'); n(120,t+0.1,0.2,0.08,'square') }
    if (type==='player_hit') { n(180,t,0.2,0.18,'sawtooth'); n(120,t+0.15,0.2,0.12,'square') }
    if (type==='wave')       [660,880,1100].forEach((f,i)=>n(f,t+i*0.08,0.14,0.1))
    if (type==='doom')       { n(160,t,0.5,0.2,'sawtooth'); n(100,t+0.35,0.5,0.15,'square') }
  } catch {/**/}
}

// ── Draw helpers ──────────────────────────────────────────────────────────────
function drawHex(ctx: CanvasRenderingContext2D, cx:number, cy:number, r:number, fill:string, alpha=1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.beginPath()
  for (let i=0;i<6;i++) { const a=(Math.PI/3)*i-Math.PI/6; if(i===0) ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a)); else ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a)) }
  ctx.closePath(); ctx.fill(); ctx.globalAlpha=1
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  const cfg = ENEMY_CFG[e.type]
  const hw = cfg.w/2, hh = cfg.h/2
  const { x, y } = e

  ctx.fillStyle = cfg.color
  if (e.type === 'scout') {
    // Arrow-style
    ctx.beginPath(); ctx.moveTo(x,y+hh); ctx.lineTo(x-hw,y-hh); ctx.lineTo(x+hw,y-hh); ctx.closePath(); ctx.fill()
    ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(x-4,y-hh+2,8,hh*0.6)
  } else if (e.type === 'tank') {
    // Wide blocky ship
    ctx.beginPath(); ctx.roundRect(x-hw,y-hh,cfg.w,cfg.h,4); ctx.fill()
    ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fillRect(x-hw,y+hh-5,cfg.w,5)
    ctx.fillStyle=cfg.color; ctx.beginPath(); ctx.roundRect(x-4,y-hh-6,8,10,2); ctx.fill()
    // HP bar
    if (e.hp < e.maxHp) {
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x-hw,y+hh+2,cfg.w,3)
      ctx.fillStyle='#86EFAC'; ctx.fillRect(x-hw,y+hh+2,cfg.w*(e.hp/e.maxHp),3)
    }
  } else if (e.type === 'zigzag') {
    // Diamond shape
    ctx.beginPath(); ctx.moveTo(x,y-hh); ctx.lineTo(x+hw,y); ctx.lineTo(x,y+hh); ctx.lineTo(x-hw,y); ctx.closePath(); ctx.fill()
    ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(x,y-hh); ctx.lineTo(x+hw*0.5,y-2); ctx.lineTo(x,y); ctx.closePath(); ctx.fill()
  } else {
    // Boss: large hex
    drawHex(ctx,x,y,cfg.w/2,cfg.color)
    drawHex(ctx,x,y,cfg.w/2-5,'rgba(0,0,0,0.15)')
    ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(x,y-5,cfg.w*0.22,0,Math.PI*2); ctx.fill()
    // HP bar
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x-cfg.w/2,y+cfg.h/2+4,cfg.w,4)
    ctx.fillStyle='#FF6B6B'; ctx.fillRect(x-cfg.w/2,y+cfg.h/2+4,cfg.w*(e.hp/e.maxHp),4)
  }
}

// ── Spawn helpers ─────────────────────────────────────────────────────────────
function makeEnemy(type: EnemyType, wave: number, W: number): Enemy {
  const cfg = ENEMY_CFG[type]
  const spd = 0.6 + wave * 0.08
  return {
    id: ++_eid, type, color: cfg.color, hp: cfg.hp + (type==='boss'?wave*2:0), maxHp: cfg.hp,
    x: cfg.w/2 + Math.random() * (W - cfg.w),
    y: -cfg.h - Math.random() * 60,
    vx: (type==='zigzag') ? (Math.random()>0.5?1:-1)*spd*1.5 : (Math.random()-0.5)*spd,
    vy: spd * (type==='tank'?0.6 : type==='boss'?0.4 : 1),
    phase: Math.random()*Math.PI*2,
  }
}

function waveComposition(wave: number): { type:EnemyType; count:number }[] {
  if (wave <= 5)  return [{ type:'scout', count: 3 + wave*2 }]
  if (wave <= 10) return [{ type:'scout', count:4+wave }, { type:'tank', count: wave-4 }]
  if (wave <= 20) return [{ type:'scout', count:6 }, { type:'tank', count:3 }, { type:'zigzag', count:wave-8 }]
  if (wave <= 30) return [{ type:'scout', count:4 }, { type:'tank', count:4 }, { type:'zigzag', count:6 }, ...(wave>=28?[{ type:'boss' as EnemyType, count:1 }]:[])]
  return [{ type:'scout', count:5 }, { type:'tank', count:5 }, { type:'zigzag', count:8 }, { type:'boss', count: Math.floor(wave/15) }]
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GalaxyDefenderGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const containerRef= useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<'start'|'play'|'over'>('start')
  const [score, setScore] = useState(0)
  const [wave,  setWave]  = useState(1)
  const [lives, setLives] = useState(3)
  const [waveMsg, setWaveMsg] = useState<string|null>(null)

  // Game state in refs
  const W = useRef(380), H = useRef(500)
  const shipX   = useRef(190), shootT = useRef(0)
  const bullets = useRef<Bullet[]>([])
  const enemies = useRef<Enemy[]>([])
  const parts   = useRef<Particle[]>([])
  const scoreRef= useRef(0), waveRef = useRef(1), livesRef = useRef(3)
  const alive   = useRef(false), raf = useRef(0)
  const _bid    = useRef(0)

  const spawnWave = useCallback((w: number) => {
    const comps = waveComposition(w)
    const newEnemies: Enemy[] = []
    comps.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) newEnemies.push(makeEnemy(type, w, W.current))
    })
    enemies.current = newEnemies
  }, [])

  const explode = useCallback((x: number, y: number, color: string, big = false) => {
    const count = big ? 18 : 10
    for (let i = 0; i < count; i++) {
      const a = (Math.PI*2/count)*i + Math.random()*0.5
      const spd = 1.5 + Math.random() * (big ? 3.5 : 2)
      parts.current.push({
        id: ++_bid.current, x, y,
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        life: big ? 40 : 28, maxLife: big ? 40 : 28,
        color, size: big ? 3+Math.random()*4 : 2+Math.random()*3,
      })
    }
  }, [])

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !alive.current) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const CW = W.current, CH = H.current

    // ── Update ───────────────────────────────────────────────────────────────
    // Auto-shoot
    shootT.current++
    const shootRate = Math.max(8, 18 - Math.floor(waveRef.current * 0.3))
    if (shootT.current % shootRate === 0) {
      bullets.current.push({ id: ++_bid.current, x: shipX.current, y: CH - 70, vy: -10, fromEnemy: false })
      snd('shoot')
    }

    // Move player bullets
    bullets.current = bullets.current
      .map(b => ({ ...b, y: b.y + b.vy }))
      .filter(b => b.y > -10 && b.y < CH + 10)

    // Move enemies
    enemies.current.forEach(e => {
      if (e.type === 'zigzag') {
        e.phase += 0.06 + waveRef.current * 0.003
        e.x += Math.sin(e.phase) * 2.5
      } else {
        e.x += e.vx
      }
      e.y += e.vy
      // Bounce walls for scouts
      if (e.type === 'scout' && (e.x < ENEMY_CFG[e.type].w/2 || e.x > CW - ENEMY_CFG[e.type].w/2)) e.vx *= -1
      e.x = Math.max(ENEMY_CFG[e.type].w/2, Math.min(e.x, CW - ENEMY_CFG[e.type].w/2))
    })

    // Enemy shooting
    const shootChance = 0.006 + waveRef.current * 0.003
    enemies.current.forEach(e => {
      if (Math.random() < shootChance) {
        bullets.current.push({ id: ++_bid.current, x: e.x, y: e.y + ENEMY_CFG[e.type].h/2, vy: 4 + waveRef.current * 0.2, fromEnemy: true })
      }
    })

    // Player bullets hit enemies
    bullets.current = bullets.current.filter(b => {
      if (b.fromEnemy) return true
      for (let i = enemies.current.length - 1; i >= 0; i--) {
        const e = enemies.current[i]
        const cfg = ENEMY_CFG[e.type]
        if (Math.abs(b.x - e.x) < cfg.w/2 + 3 && Math.abs(b.y - e.y) < cfg.h/2 + 3) {
          e.hp--
          snd('hit')
          if (e.hp <= 0) {
            explode(e.x, e.y, cfg.color, e.type==='boss'||e.type==='tank')
            snd('explode')
            scoreRef.current += cfg.pts * waveRef.current
            setScore(scoreRef.current)
            enemies.current.splice(i, 1)
          }
          return false
        }
      }
      return true
    })

    // Enemy bullets hit player
    const px = shipX.current, py = CH - 60
    bullets.current = bullets.current.filter(b => {
      if (!b.fromEnemy) return true
      if (Math.abs(b.x - px) < 18 && b.y > py - 20 && b.y < py + 10) {
        livesRef.current--; setLives(livesRef.current)
        snd('player_hit')
        explode(px, py, '#4CC9F0', false)
        if (livesRef.current <= 0) {
          alive.current = false
          snd('doom')
          addXp(Math.floor(scoreRef.current * 0.3))
          setHighScore('galaxy-defender', scoreRef.current)
          setPhase('over')
        }
        return false
      }
      return true
    })

    // Enemy reaches bottom
    if (enemies.current.some(e => e.y + ENEMY_CFG[e.type].h/2 > CH - 55)) {
      alive.current = false; snd('doom')
      addXp(Math.floor(scoreRef.current * 0.3))
      setHighScore('galaxy-defender', scoreRef.current)
      setPhase('over'); return
    }

    // Wave clear
    if (enemies.current.length === 0) {
      snd('wave')
      waveRef.current++; setWave(waveRef.current)
      setWaveMsg(`WAVE ${waveRef.current}`)
      setTimeout(() => setWaveMsg(null), 1800)
      spawnWave(waveRef.current)
    }

    // Particles
    parts.current = parts.current
      .map(p => ({ ...p, x: p.x+p.vx, y: p.y+p.vy, vy: p.vy+0.08, life: p.life-1 }))
      .filter(p => p.life > 0)

    // ── Draw ─────────────────────────────────────────────────────────────────
    // Stars bg
    ctx.fillStyle = '#1A1A3E'; ctx.fillRect(0,0,CW,CH)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    for (let i=0;i<50;i++) {
      const sx=(i*97+Date.now()/80)%CW, sy=(i*53+Date.now()/120)%CH
      ctx.fillRect(sx,sy,i%3===0?1.5:0.8,i%3===0?1.5:0.8)
    }

    // Particles
    parts.current.forEach(p => {
      ctx.globalAlpha = p.life/p.maxLife
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(p.life/p.maxLife),0,Math.PI*2); ctx.fill()
    })
    ctx.globalAlpha = 1

    // Enemy bullets
    ctx.fillStyle = '#FF6B6B'
    bullets.current.filter(b=>b.fromEnemy).forEach(b => {
      ctx.beginPath(); ctx.roundRect(b.x-2,b.y,4,10,2); ctx.fill()
    })

    // Player bullets
    ctx.fillStyle = '#4CC9F0'
    bullets.current.filter(b=>!b.fromEnemy).forEach(b => {
      ctx.shadowColor='#4CC9F0'; ctx.shadowBlur=6
      ctx.beginPath(); ctx.roundRect(b.x-2,b.y,4,14,2); ctx.fill()
      ctx.shadowBlur=0
    })

    // Enemies
    enemies.current.forEach(e => drawEnemy(ctx, e))

    // Player ship (hex shape)
    const sx = shipX.current, sy = CH - 58
    ctx.shadowColor = '#4CC9F0'; ctx.shadowBlur = 12
    drawHex(ctx, sx, sy, 18, '#4CC9F0')
    ctx.shadowBlur = 0
    drawHex(ctx, sx, sy, 10, 'rgba(255,255,255,0.25)')
    // Engine glow
    ctx.fillStyle = '#86EFAC'
    ctx.beginPath(); ctx.ellipse(sx, sy+20, 6, 10, 0, 0, Math.PI*2); ctx.fill()
    // Wing accents
    ctx.fillStyle='rgba(76,201,240,0.5)'
    ctx.beginPath(); ctx.moveTo(sx-18,sy); ctx.lineTo(sx-28,sy+14); ctx.lineTo(sx-10,sy+10); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(sx+18,sy); ctx.lineTo(sx+28,sy+14); ctx.lineTo(sx+10,sy+10); ctx.closePath(); ctx.fill()

    // Ground line
    ctx.fillStyle='rgba(76,201,240,0.12)'; ctx.fillRect(0,CH-38,CW,38)
    ctx.fillStyle='rgba(76,201,240,0.3)'; ctx.fillRect(0,CH-38,CW,1.5)

    raf.current = requestAnimationFrame(gameLoop)
  }, [spawnWave, explode, addXp, setHighScore])

  const startGame = useCallback(() => {
    const container = containerRef.current
    if (container) {
      const r = container.getBoundingClientRect()
      W.current = Math.floor(r.width); H.current = Math.floor(r.height)
      const canvas = canvasRef.current!
      const dpr = window.devicePixelRatio || 1
      canvas.width = W.current * dpr; canvas.height = H.current * dpr
      canvas.style.width = W.current + 'px'; canvas.style.height = H.current + 'px'
    }
    shipX.current = W.current / 2; bullets.current = []; enemies.current = []; parts.current = []
    scoreRef.current = 0; waveRef.current = 1; livesRef.current = 3; shootT.current = 0
    setScore(0); setWave(1); setLives(3); setWaveMsg(null)
    alive.current = true
    spawnWave(1)
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(gameLoop)
    setPhase('play')
  }, [spawnWave, gameLoop])

  // Touch/mouse controls
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const move = (cx: number) => {
      const rect = canvas.getBoundingClientRect()
      shipX.current = Math.max(20, Math.min(W.current - 20, ((cx - rect.left) / rect.width) * W.current))
    }
    const onM = (e: MouseEvent) => move(e.clientX)
    const onT = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX) }
    canvas.addEventListener('mousemove', onM)
    canvas.addEventListener('touchmove', onT, { passive: false })
    canvas.addEventListener('touchstart', onT, { passive: false })
    return () => { canvas.removeEventListener('mousemove', onM); canvas.removeEventListener('touchmove', onT) }
  }, [phase])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current) }, [])

  const best = highScores['galaxy-defender'] ?? 0

  // ── START ─────────────────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ width:'100%',height:'100%',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,fontFamily:'system-ui,sans-serif',position:'relative' }}>
      <button onClick={onExit} style={{ position:'absolute',top:20,left:20,background:'none',border:'none',color:'#BBB',fontSize:22,cursor:'pointer' }}>←</button>
      {/* Illustration */}
      <svg width={200} height={110} viewBox="0 0 200 110">
        <rect width={200} height={110} fill="#1A1A3E" rx={16}/>
        {/* Stars */}
        {[[20,15],[60,8],[110,20],[160,10],[40,50],[130,45],[80,35],[170,55]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r={i%2===0?1.5:0.8} fill="white" opacity={0.4+i*0.04}/>
        ))}
        {/* Planet */}
        <circle cx={158} cy={38} r={18} fill="#3A2A6E" opacity={0.9}/>
        <ellipse cx={158} cy={38} rx={24} ry={6} fill="none" stroke="#C4B5FD" strokeWidth={2} opacity={0.6}/>
        {/* Enemies */}
        <polygon points="55,28 45,40 65,40" fill="#FF9F43" opacity={0.9}/>
        <polygon points="90,22 80,34 100,34" fill="#C4B5FD" opacity={0.9}/>
        <polygon points="125,32 115,44 135,44" fill="#FF6B6B" opacity={0.9}/>
        {/* Player hex ship */}
        <polygon points="100,82 88,75 88,63 100,56 112,63 112,75" fill="#4CC9F0"/>
        <circle cx={100} cy={69} r={6} fill="rgba(255,255,255,0.2)"/>
        {/* Bullet */}
        <rect x={98} y={45} width={4} height={12} rx={2} fill="#4CC9F0" opacity={0.8}/>
      </svg>
      <div style={{ textAlign:'center' }}>
        <h1 style={{ fontSize:28,fontWeight:900,color:'#1A1A2E',margin:'0 0 8px',letterSpacing:'0.05em' }}>GALAXY DEFENDER</h1>
        <p style={{ color:'#BBB',fontSize:11,fontWeight:700,letterSpacing:'0.14em',margin:0 }}>SHOOT · DODGE · SURVIVE</p>
      </div>
      <motion.button whileTap={{ scale:0.96 }} onClick={startGame}
        style={{ background:'#1A1A2E',color:BG,border:'none',borderRadius:16,padding:'16px 64px',fontSize:18,fontWeight:900,cursor:'pointer',letterSpacing:'0.12em' }}>
        PLAY
      </motion.button>
      {best>0 && <p style={{ color:'#BBB',fontSize:13,margin:0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  if (phase === 'over') return (
    <div style={{ width:'100%',height:'100%',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,fontFamily:'system-ui,sans-serif' }}>
      <p style={{ fontSize:12,fontWeight:800,color:'#FF6B6B',letterSpacing:'0.22em',margin:0 }}>GAME OVER</p>
      <p style={{ fontSize:52,fontWeight:900,color:'#1A1A2E',margin:0,lineHeight:1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display:'flex',gap:36 }}>
        {([['WAVE',waveRef.current]] as [string,number][]).map(([l,v])=>(
          <div key={l} style={{ textAlign:'center' }}>
            <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#BBB',margin:0 }}>{l}</p>
            <p style={{ fontSize:26,fontWeight:900,color:'#1A1A2E',margin:0 }}>{v}</p>
          </div>
        ))}
      </div>
      <p style={{ fontSize:13,color:'#AAA',margin:0 }}>XP +{Math.floor(scoreRef.current*0.3)}</p>
      {scoreRef.current>0 && scoreRef.current>=best && <p style={{ fontSize:11,color:'#E9B213',fontWeight:800,margin:0,letterSpacing:'0.15em' }}>NEW BEST</p>}
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

  // ── PLAY ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ width:'100%',height:'100%',display:'flex',flexDirection:'column',background:'#1A1A3E',fontFamily:'system-ui,sans-serif',overflow:'hidden' }}>

      {/* HUD */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 20px 6px',flexShrink:0,background:'rgba(0,0,0,0.3)' }}>
        <button onClick={()=>{ alive.current=false; onExit() }}
          style={{ background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:20,cursor:'pointer',padding:0 }}>←</button>
        <div style={{ display:'flex',gap:20,alignItems:'center' }}>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'rgba(255,255,255,0.4)',margin:0 }}>WAVE</p>
            <p style={{ fontSize:18,fontWeight:900,color:'#C4B5FD',margin:0,lineHeight:1.1 }}>{wave}</p>
          </div>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'rgba(255,255,255,0.4)',margin:0 }}>SCORE</p>
            <p style={{ fontSize:18,fontWeight:900,color:'white',margin:0,lineHeight:1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ display:'flex',gap:5 }}>
          {[0,1,2].map(i=>(
            <div key={i} style={{ width:11,height:11,borderRadius:'50%',
              background: i<lives ? '#4CC9F0' : 'rgba(255,255,255,0.12)',
              boxShadow: i<lives ? '0 0 6px #4CC9F0' : 'none',transition:'all 0.3s' }}/>
          ))}
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} style={{ flex:1,position:'relative',overflow:'hidden' }}>
        <canvas ref={canvasRef} style={{ display:'block',touchAction:'none' }}/>

        {/* Wave clear banner */}
        <AnimatePresence>
          {waveMsg && (
            <motion.div key={waveMsg}
              initial={{ scale:0.6,opacity:0 }} animate={{ scale:1,opacity:1 }} exit={{ scale:1.3,opacity:0 }}
              style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none' }}>
              <p style={{ fontSize:32,fontWeight:900,color:'#C4B5FD',letterSpacing:'0.15em',
                filter:'drop-shadow(0 2px 12px rgba(196,181,253,0.6))',margin:0 }}>
                {waveMsg}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
