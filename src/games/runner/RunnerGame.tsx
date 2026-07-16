import { useRef, useEffect, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'

const BG = '#FFF8E8'
const W = 380, H = 400
// A single fixed hop, no gravity simulation — same height/speed every time.
const JUMP_FRAMES = 32, JUMP_HEIGHT = 140, GROUND = H - 48
const PX = 60, PR = 16
const SPEED_INIT = 6.5, SPEED_MAX = 22
const PC = '#4CC9F0'   // player cyan
const GC = '#FFD166'   // ground yellow

function obstacleColor(dist: number): string {
  if (dist < 350)  return '#FF6B6B'
  if (dist < 700)  return '#FF9F43'
  if (dist < 1050) return '#FDBA74'
  if (dist < 1400) return '#F4A261'
  return ['#FF6B6B','#C4B5FD','#86EFAC'][Math.floor(dist/1400) % 3]
}

type OData = { x: number; w: number; h: number; color: string }
type Coin  = { x: number; y: number; collected: boolean }

function genGroup(dist: number): OData[] {
  const c = obstacleColor(dist)
  const r = Math.random
  if (dist < 350)  return [{ x:W+10, w:26, h:40+r()*45, color:c }]
  if (dist < 700) return r()<0.45
    ? [{ x:W+10,w:23,h:40+r()*45,color:c },{ x:W+40,w:23,h:40+r()*60,color:c }]
    : [{ x:W+10,w:26,h:45+r()*60,color:c }]
  if (dist < 1050) return r()<0.5
    ? [{ x:W+10,w:22,h:55+r()*65,color:c },{ x:W+40,w:22,h:35+r()*45,color:c }]
    : [{ x:W+10,w:26,h:60+r()*70,color:c }]
  if (dist < 1400) {
    const n = r()<0.5 ? 3 : 2
    return Array.from({length:n},(_,i)=>({ x:W+10+i*34,w:22,h:45+r()*60,color:c }))
  }
  const roll = r()
  if (roll < 0.3) return [
    { x:W+10,w:22,h:65+r()*60,color:c },
    { x:W+42,w:22,h:40+r()*40,color:c },
    { x:W+128+r()*36,w:22,h:65+r()*60,color:c },
  ]
  if (roll < 0.55) return [
    { x:W+10,w:22,h:85+r()*40,color:c },
    { x:W+42,w:22,h:40+r()*35,color:c },
    { x:W+74,w:22,h:85+r()*40,color:c },
  ]
  if (roll < 0.8) return Array.from({length:3},(_,i)=>({ x:W+10+i*34,w:20,h:50+r()*70,color:c }))
  return Array.from({length:4},(_,i)=>({ x:W+10+i*30,w:18,h:45+r()*65,color:c }))
}

function hexPts(cx:number,cy:number,r:number){ return Array.from({length:6},(_,i)=>{ const a=(Math.PI/3)*i-Math.PI/6; return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}` }).join(' ') }

function drawHex(ctx:CanvasRenderingContext2D,cx:number,cy:number,r:number,col:string,a=1){
  ctx.globalAlpha=a; ctx.fillStyle=col; ctx.beginPath()
  for(let i=0;i<6;i++){ const ang=(Math.PI/3)*i-Math.PI/6; if(i===0) ctx.moveTo(cx+r*Math.cos(ang),cy+r*Math.sin(ang)); else ctx.lineTo(cx+r*Math.cos(ang),cy+r*Math.sin(ang)) }
  ctx.closePath(); ctx.fill(); ctx.globalAlpha=1
}

let _ac: AudioContext|null=null
function snd(type:'jump'|'coin'|'doom'){
  try{
    if(!_ac) _ac=new (window.AudioContext||(window as any).webkitAudioContext)()
    const c=_ac,t=c.currentTime
    const n=(f:number,at:number,dur:number,vol:number,osc:OscillatorType='sine')=>{
      const o=c.createOscillator(),g=c.createGain(); o.type=osc; o.frequency.setValueAtTime(f,at)
      g.gain.setValueAtTime(vol,at); g.gain.exponentialRampToValueAtTime(0.001,at+dur)
      o.connect(g); g.connect(c.destination); o.start(at); o.stop(at+dur)
    }
    if(type==='jump') { n(440,t,0.08,0.07,'triangle'); n(550,t+0.04,0.06,0.05) }
    if(type==='coin') [880,1100].forEach((f,i)=>n(f,t+i*0.05,0.08,0.08))
    if(type==='doom') { n(180,t,0.4,0.18,'sawtooth'); n(130,t+0.3,0.4,0.14,'square') }
  } catch{/**/}
}

export default function RunnerGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [phase, setPhase] = useState<'start'|'howto'|'play'|'over'>('start')
  const [distDisp,  setDistDisp]  = useState(0)
  const [scoreDisp, setScoreDisp] = useState(0)

  const pY    = useRef(GROUND-PR), jumping = useRef(false), jumpT = useRef(0)
  const spd   = useRef(SPEED_INIT), dist = useRef(0), sc = useRef(0)
  const obs   = useRef<OData[]>([]), coins = useRef<Coin[]>([])
  const lastCoin = useRef(0), coinFlash = useRef(0)
  const rollAngle = useRef(0)
  const alive = useRef(false), raf = useRef(0)

  const jump = useCallback(() => {
    if (!alive.current || jumping.current) return
    jumping.current = true; jumpT.current = 0; snd('jump')
  }, [])

  const startGame = useCallback(() => {
    pY.current=GROUND-PR; jumping.current=false; jumpT.current=0
    spd.current=SPEED_INIT; dist.current=0; sc.current=0
    obs.current=[]; coins.current=[]; lastCoin.current=0; coinFlash.current=0
    rollAngle.current=0
    alive.current=true; setDistDisp(0); setScoreDisp(0); setPhase('play')
  }, [])

  useEffect(() => {
    if (phase !== 'play') { cancelAnimationFrame(raf.current); return }
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    const dpr    = window.devicePixelRatio||1
    canvas.width = W*dpr; canvas.height = H*dpr
    ctx.scale(dpr, dpr)
    let frame = 0

    function loop() {
      if (!alive.current) return
      frame++
      const sp = spd.current
      spd.current = Math.min(SPEED_MAX, SPEED_INIT + dist.current * 0.007)
      dist.current += sp * 0.05

      if (frame%3===0) setDistDisp(Math.floor(dist.current))

      // Jump — one fixed hop, no gravity accumulation
      if (jumping.current) {
        jumpT.current += 1 / JUMP_FRAMES
        if (jumpT.current >= 1) { jumpT.current = 1; jumping.current = false }
        pY.current = (GROUND-PR) - JUMP_HEIGHT * Math.sin(jumpT.current * Math.PI)
      } else {
        pY.current = GROUND-PR
      }

      // Spawn obstacles — gap is defined in TIME (frames), not pixels, and
      // converted using the current speed. That's what actually matters for
      // fairness: the jump is a fixed 32-frame hop, so early on the gap
      // between groups stays comfortably longer than that (a real landing
      // window every time); it only tightens toward — and eventually past —
      // the jump's own duration as distance/speed ramp up, which is where
      // it's fine for things to genuinely get hard.
      const rightmost = obs.current.reduce((mx,o)=>Math.max(mx,o.x+o.w), 0)
      const framesNeeded = Math.max(24, 46 - dist.current * 0.010)
      const gap = Math.max(80, sp * framesNeeded)
      if (rightmost < W - gap) obs.current.push(...genGroup(dist.current))
      obs.current.forEach(o=>{ o.x-=sp })
      obs.current = obs.current.filter(o=>o.x+o.w>-10)

      // Spawn coins every 1000m
      if (dist.current >= lastCoin.current + 1000) {
        lastCoin.current += 1000
        coins.current.push({ x:W+60, y:GROUND-62, collected:false })
      }
      coins.current.forEach(c=>{ c.x-=sp })
      coins.current = coins.current.filter(c=>!c.collected && c.x>-20)
      coins.current.forEach(c=>{
        if (!c.collected && Math.abs(c.x-PX)<24 && Math.abs(c.y-pY.current)<24) {
          c.collected=true; sc.current+=100; coinFlash.current=36; snd('coin')
          setScoreDisp(sc.current)
        }
      })

      // Distance score
      if (frame%20===0) { sc.current+=1; setScoreDisp(sc.current) }
      if (coinFlash.current>0) coinFlash.current--

      // Collision
      const pL=PX-PR+3, pR=PX+PR-3, pT=pY.current-PR+3, pB=pY.current+PR-3
      for (const o of obs.current) {
        if (pR>o.x+2 && pL<o.x+o.w-2 && pB>GROUND-o.h+2 && pT<GROUND) {
          alive.current=false; snd('doom')
          addXp(Math.floor(sc.current*0.3)); setHighScore('runner', sc.current)
          setPhase('over'); return
        }
      }

      // ── Draw ─────────────────────────────────────────────────────────
      if (dist.current >= 1500) {
        const h = 42 + Math.sin(Date.now()/5000*Math.PI*2)*10
        ctx.fillStyle = `hsl(${h},80%,96%)`
      } else {
        ctx.fillStyle = BG
      }
      ctx.fillRect(0,0,W,H)

      // Ground band
      ctx.fillStyle = GC; ctx.fillRect(0,GROUND,W,H-GROUND)
      ctx.fillStyle = '#FFB830'; ctx.fillRect(0,GROUND,W,2)

      // Obstacles
      for (const o of obs.current) {
        const top = GROUND-o.h
        ctx.fillStyle = o.color
        ctx.beginPath(); ctx.roundRect(o.x,top,o.w,o.h,6); ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.beginPath(); ctx.roundRect(o.x+2,top+2,o.w-4,o.h*0.32,[5,5,0,0]); ctx.fill()
      }

      // Coins
      for (const c of coins.current) {
        if (c.collected) continue
        const grd = ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,13)
        grd.addColorStop(0,'#FFE566'); grd.addColorStop(0.6,GC); grd.addColorStop(1,'rgba(255,209,102,0)')
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(c.x,c.y,13,0,Math.PI*2); ctx.fill()
        ctx.fillStyle=GC; ctx.strokeStyle='#FFC233'; ctx.lineWidth=1.5
        ctx.beginPath(); ctx.arc(c.x,c.y,8,0,Math.PI*2); ctx.fill(); ctx.stroke()
      }

      // Roll when on ground
      if (!jumping.current) rollAngle.current += sp * 0.05 / PR

      // Player trail (ghost hexes)
      drawHex(ctx,PX-8,pY.current+2,PR*0.65,PC,0.14)
      drawHex(ctx,PX-4,pY.current+1,PR*0.82,PC,0.26)

      // Player (rotating hex)
      ctx.save()
      ctx.translate(PX, pY.current)
      ctx.rotate(rollAngle.current)
      ctx.fillStyle = PC; ctx.beginPath()
      for(let i=0;i<6;i++){ const a=(Math.PI/3)*i-Math.PI/6; i===0?ctx.moveTo(PR*Math.cos(a),PR*Math.sin(a)):ctx.lineTo(PR*Math.cos(a),PR*Math.sin(a)) }
      ctx.closePath(); ctx.fill()
      // Highlight slice
      ctx.globalAlpha=0.32; ctx.fillStyle='white'; ctx.beginPath()
      for(let i=0;i<3;i++){ const a=(Math.PI/3)*i-Math.PI/6; i===0?ctx.moveTo(PR*0.55*Math.cos(a),PR*0.55*Math.sin(a)):ctx.lineTo(PR*0.55*Math.cos(a),PR*0.55*Math.sin(a)) }
      ctx.closePath(); ctx.fill()
      ctx.globalAlpha=1; ctx.restore()

      // Coin collect flash
      if (coinFlash.current > 0) {
        ctx.globalAlpha = coinFlash.current/36
        ctx.fillStyle = '#FFD166'
        ctx.font = 'bold 16px system-ui'; ctx.textAlign='center'
        ctx.fillText('+100', PX, pY.current-PR-10)
        ctx.globalAlpha=1
      }

      raf.current = requestAnimationFrame(loop)
    }

    raf.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf.current); alive.current=false }
  }, [phase, addXp, setHighScore])

  const best = highScores['runner'] ?? 0

  if (phase === 'start') return (
    <div style={{ width:'100%',height:'100%',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24,fontFamily:'system-ui,sans-serif',position:'relative' }}>
      <button onClick={onExit} style={{ position:'absolute',top:20,left:20,background:'none',border:'none',color:'#BBB',fontSize:22,cursor:'pointer' }}>←</button>
      <svg width={240} height={90} viewBox="0 0 240 90">
        <rect width={240} height={90} rx={16} fill="white" opacity={0.7}/>
        <rect x={0} y={66} width={240} height={24} fill={GC}/>
        <rect x={0} y={66} width={240} height={2} fill="#FFB830"/>
        <rect x={100} y={40} width={22} height={26} rx={4} fill="#FF6B6B"/>
        <rect x={148} y={32} width={22} height={34} rx={4} fill="#FF9F43"/>
        <rect x={196} y={46} width={22} height={20} rx={4} fill="#FF6B6B"/>
        <polygon points={hexPts(55,52,15)} fill={PC}/>
        <polygon points={hexPts(55,52,15)} fill="rgba(255,255,255,0.22)" opacity={0.5} clipPath="inset(0 50% 50% 0)"/>
        <circle cx={82} cy={48} r={8} fill={GC} stroke="#FFC233" strokeWidth={1.5}/>
      </svg>
      <div style={{ textAlign:'center' }}>
        <h1 style={{ fontSize:28,fontWeight:900,color:'#1A1A2E',margin:'0 0 8px',letterSpacing:'0.05em' }}>HEX RUNNER</h1>
        <p style={{ color:'#BBB',fontSize:11,fontWeight:700,letterSpacing:'0.14em',margin:0 }}>JUMP · DODGE · SURVIVE</p>
      </div>
      <motion.button whileTap={{ scale:0.96 }} onClick={() => { if (hasSeenTutorial('runner')) startGame(); else setPhase('howto') }}
        style={{ background:'#1A1A2E',color:BG,border:'none',borderRadius:16,padding:'16px 64px',fontSize:18,fontWeight:900,cursor:'pointer',letterSpacing:'0.12em' }}>
        PLAY
      </motion.button>
      {best>0 && <p style={{ color:'#BBB',fontSize:13,margin:0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'howto') return (
    <div style={{ width:'100%',height:'100%',position:'relative',fontFamily:'system-ui,sans-serif' }}>
      <HowToPlayOverlay bg={BG} accent="#1A1A2E" textColor="#1A1A2E" mutedColor="#999" bullets={TUTORIALS['runner']}
        onStart={() => { markTutorialSeen('runner'); startGame() }} />
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width:'100%',height:'100%',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,fontFamily:'system-ui,sans-serif' }}>
      <p style={{ fontSize:12,fontWeight:800,color:'#FF6B6B',letterSpacing:'0.22em',margin:0 }}>GAME OVER</p>
      <p style={{ fontSize:52,fontWeight:900,color:'#1A1A2E',margin:0,lineHeight:1 }}>{sc.current.toLocaleString()}</p>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#BBB',margin:0 }}>DISTANCE</p>
        <p style={{ fontSize:20,fontWeight:900,color:'#1A1A2E',margin:0 }}>{Math.floor(dist.current).toLocaleString()}m</p>
      </div>
      <p style={{ fontSize:13,color:'#AAA',margin:0 }}>XP +{Math.floor(sc.current*0.3)}</p>
      {sc.current>0 && sc.current>=best && (
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

  return (
    <div style={{ width:'100%',height:'100%',background:BG,display:'flex',flexDirection:'column',fontFamily:'system-ui,sans-serif' }}>
      {/* HUD */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 20px 4px',flexShrink:0 }}>
        <button onClick={()=>{
            if (alive.current) {
              alive.current=false
              if (sc.current>0) { addXp(Math.floor(sc.current*0.3)); setHighScore('runner', sc.current) }
            }
            onExit()
          }}
          style={{ background:'none',border:'none',color:'#CCC',fontSize:20,cursor:'pointer',padding:0 }}>←</button>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#BBB',margin:0 }}>DISTANCE</p>
          <p style={{ fontSize:18,fontWeight:900,color:'#1A1A2E',margin:0,lineHeight:1.1 }}>{distDisp.toLocaleString()}m</p>
        </div>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#BBB',margin:0 }}>SCORE</p>
          <p style={{ fontSize:18,fontWeight:900,color:'#1A1A2E',margin:0,lineHeight:1.1 }}>{scoreDisp.toLocaleString()}</p>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex:1,display:'flex',justifyContent:'center',alignItems:'center',overflow:'hidden' }}>
        <canvas ref={canvasRef} width={W} height={H}
          onClick={jump}
          style={{ width:'100%',height:'100%',objectFit:'contain',cursor:'pointer',display:'block' }}
        />
      </div>

      {/* Jump button */}
      <motion.button whileTap={{ scale:0.97 }} onPointerDown={jump}
        style={{ flexShrink:0,minHeight:72,paddingBottom:'env(safe-area-inset-bottom, 0px)',background:'rgba(26,26,46,0.05)',border:'none',
          borderTop:'1.5px solid rgba(0,0,0,0.06)',display:'flex',alignItems:'center',
          justifyContent:'center',cursor:'pointer',touchAction:'manipulation',userSelect:'none' }}>
        <span style={{ fontSize:11,fontWeight:800,letterSpacing:'0.22em',color:'rgba(26,26,46,0.3)' }}>JUMP</span>
      </motion.button>
    </div>
  )
}
