import { useRef, useEffect, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'

const BG = '#FFF8E8'
const W = 380, H = 400, GROUND = H - 48
const PX = 60, PR = 16
const PC = '#4CC9F0'   // player cyan
const GC = '#FFD166'   // ground yellow

// Chrome's T-Rex Runner's actual feel, reimplemented with our own look —
// real delta-time physics (not frame-counted, so it stays smooth and
// frame-rate independent) using values close to the real game's own
// px/s-scale constants rather than ad-hoc tuning.
const GRAVITY = 2000            // px/s²
const HOLD_GRAVITY_MULT = 0.45  // reduced effective gravity while the hold window is active
const HOLD_WINDOW = 0.16        // seconds — release before this = a short hop, hold past it = full jump
const JUMP_VELOCITY = -700      // px/s, initial upward velocity
const SPEED_INIT = 480          // px/s
const SPEED_MAX = 900           // px/s
const SPEED_RAMP = 1.5          // px/s per second of play (= +15 px/s every 10s)
const HITBOX_MARGIN = 0.93      // collision box is ~93% of the visual sprite — small forgiveness margin
const DIST_SCALE = 40           // world px per displayed "m"

type Shape = 'block' | 'spike' | 'crystal' | 'saw' | 'flyer'
interface Obstacle { x:number; w:number; h:number; color:string; shape:Shape; flyOffset?:number; rot?:number; wing?:number }
interface Cloud { x:number; y:number; s:number }
interface Coin { x:number; y:number; collected:boolean }

const PALETTE = ['#FF6B6B','#FF9F43','#C4B5FD','#86EFAC','#93DCFF']

function hexPts(cx:number,cy:number,r:number){ return Array.from({length:6},(_,i)=>{ const a=(Math.PI/3)*i-Math.PI/6; return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}` }).join(' ') }

function drawHex(ctx:CanvasRenderingContext2D,cx:number,cy:number,r:number,col:string,a=1){
  ctx.globalAlpha=a; ctx.fillStyle=col; ctx.beginPath()
  for(let i=0;i<6;i++){ const ang=(Math.PI/3)*i-Math.PI/6; if(i===0) ctx.moveTo(cx+r*Math.cos(ang),cy+r*Math.sin(ang)); else ctx.lineTo(cx+r*Math.cos(ang),cy+r*Math.sin(ang)) }
  ctx.closePath(); ctx.fill(); ctx.globalAlpha=1
}

let _ac: AudioContext|null=null
function snd(type:'jump'|'coin'|'doom'|'score'){
  try{
    if(!_ac) _ac=new (window.AudioContext||(window as any).webkitAudioContext)()
    const c=_ac,t=c.currentTime
    const n=(f:number,at:number,dur:number,vol:number,osc:OscillatorType='sine')=>{
      const o=c.createOscillator(),g=c.createGain(); o.type=osc; o.frequency.setValueAtTime(f,at)
      g.gain.setValueAtTime(vol,at); g.gain.exponentialRampToValueAtTime(0.001,at+dur)
      o.connect(g); g.connect(c.destination); o.start(at); o.stop(at+dur)
    }
    if(type==='jump')  { n(440,t,0.08,0.07,'triangle'); n(550,t+0.04,0.06,0.05) }
    if(type==='coin')  [880,1100].forEach((f,i)=>n(f,t+i*0.05,0.08,0.08))
    if(type==='doom')  { n(180,t,0.4,0.18,'sawtooth'); n(130,t+0.3,0.4,0.14,'square') }
    if(type==='score') n(1000,t,0.05,0.05,'square')
  } catch{/**/}
}

// ── Difficulty director ─────────────────────────────────────────────────
// Small obstacles only for the first 15s, large ones unlock at 15s,
// clusters at 30s, flying obstacles at 60s — and a cost-1/2/3 budget so two
// "hard" (cost >= 2) obstacles never land back to back: right after one, the
// next spawn is heavily biased toward a cheap single obstacle, and hard
// spawns always add an extra ~0.8-1.2s of travel time on top of the normal
// gap so there's always a real window to react.
function genGroup(elapsed: number, prevCost: number): { list: Obstacle[]; cost: number } {
  const r = Math.random
  const canLarge = elapsed >= 15
  const canCluster = elapsed >= 30
  const canFlyer = elapsed >= 60
  const forceSmall = prevCost >= 2 && r() < 0.75

  let kind: 'small' | 'large' | 'cluster' | 'flyer' = 'small'
  if (!forceSmall) {
    const roll = r()
    if (canFlyer && roll < 0.15) kind = 'flyer'
    else if (canCluster && roll < 0.35) kind = 'cluster'
    else if (canLarge && roll < 0.55) kind = 'large'
  }

  const color = PALETTE[Math.floor(r()*PALETTE.length)]

  if (kind === 'small') {
    const shape: Shape = r()<0.5 ? 'block' : 'spike'
    return { list: [{ x:W+10, w:24, h:34+r()*20, color, shape }], cost: 1 }
  }
  if (kind === 'large') {
    const shape: Shape = r()<0.5 ? 'crystal' : 'block'
    return { list: [{ x:W+10, w:28, h:75+r()*30, color, shape }], cost: 2 }
  }
  if (kind === 'cluster') {
    const n = 2 + Math.floor(r()*3) // 2-4
    const shapes: Shape[] = ['block','spike','crystal','saw']
    const list: Obstacle[] = []
    let cx = W+10
    for (let i=0;i<n;i++){
      const shape = shapes[Math.floor(r()*shapes.length)]
      const size = shape==='saw' ? 30+r()*10 : 0
      const w = shape==='saw' ? size : 20+r()*8
      const h = shape==='saw' ? size : 40+r()*40
      list.push({ x:cx, w, h, color, shape, rot: shape==='saw' ? 0 : undefined })
      cx += w + 20 + r()*15 // 20-35px separation, matches a tight recognizable cluster
    }
    return { list, cost: 3 }
  }
  // flyer — elevated well above ground so it can't be walked under, but
  // still within the jump's reachable height band.
  return { list: [{ x:W+10, w:26, h:20, color:'#7C6BFF', shape:'flyer', flyOffset:60, wing:0 }], cost: 3 }
}

export default function RunnerGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [phase, setPhase] = useState<'start'|'howto'|'play'|'over'>('start')
  const [distDisp,  setDistDisp]  = useState(0)
  const [scoreDisp, setScoreDisp] = useState(0)

  const pY = useRef(GROUND-PR), vy = useRef(0), grounded = useRef(true)
  const holding = useRef(false), holdTimer = useRef(0)
  const spd = useRef(SPEED_INIT), dist = useRef(0), elapsed = useRef(0), sc = useRef(0)
  const obs = useRef<Obstacle[]>([]), clouds = useRef<Cloud[]>([]), coins = useRef<Coin[]>([])
  const lastCoinM = useRef(0), coinFlash = useRef(0), lastScoreSound = useRef(0)
  const nextCloudIn = useRef(3), spawnCountdown = useRef(0), prevCost = useRef(0)
  const groundOffset = useRef(0), rollAngle = useRef(0)
  const alive = useRef(false), raf = useRef(0), lastT = useRef(0)

  const startJump = useCallback(() => {
    if (!alive.current || !grounded.current) return
    vy.current = JUMP_VELOCITY; grounded.current = false
    holding.current = true; holdTimer.current = 0
    snd('jump')
  }, [])
  const endJump = useCallback(() => { holding.current = false }, [])

  const startGame = useCallback(() => {
    pY.current=GROUND-PR; vy.current=0; grounded.current=true
    holding.current=false; holdTimer.current=0
    spd.current=SPEED_INIT; dist.current=0; elapsed.current=0; sc.current=0
    obs.current=[]; clouds.current=[]; coins.current=[]
    lastCoinM.current=0; coinFlash.current=0; lastScoreSound.current=0
    nextCloudIn.current=2; spawnCountdown.current=0; prevCost.current=0
    groundOffset.current=0; rollAngle.current=0
    alive.current=true; lastT.current=0; setDistDisp(0); setScoreDisp(0); setPhase('play')
  }, [])

  useEffect(() => {
    if (phase !== 'play') { cancelAnimationFrame(raf.current); return }
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    const dpr    = window.devicePixelRatio||1
    canvas.width = W*dpr; canvas.height = H*dpr
    ctx.scale(dpr, dpr)

    function loop(t: number) {
      if (!alive.current) return
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t

      elapsed.current += dt
      spd.current = Math.min(SPEED_MAX, SPEED_INIT + elapsed.current * SPEED_RAMP)
      const sp = spd.current
      dist.current += sp * dt
      const distM = dist.current / DIST_SCALE
      setDistDisp(Math.floor(distM))

      // Jump physics — real gravity, with a short reduced-gravity window
      // while held for a variable jump height (tap = low hop, hold = full).
      if (!grounded.current) {
        holdTimer.current += dt
        const g = (holding.current && holdTimer.current < HOLD_WINDOW) ? GRAVITY*HOLD_GRAVITY_MULT : GRAVITY
        vy.current += g*dt
        pY.current += vy.current*dt
        if (pY.current >= GROUND-PR) { pY.current = GROUND-PR; vy.current = 0; grounded.current = true }
      } else {
        pY.current = GROUND-PR
      }

      // Spawn obstacles — a countdown that ticks down by distance travelled
      // (independent of canvas width), matching the real game: never a
      // fixed distance, always a range, and a bit wider once you're faster
      // so there's always time to react.
      spawnCountdown.current -= sp*dt
      if (spawnCountdown.current <= 0) {
        const { list, cost } = genGroup(elapsed.current, prevCost.current)
        obs.current.push(...list)
        const baseGap = 250 + Math.random()*250 + sp/6
        const reactionBonus = cost >= 2 ? sp * (0.8 + Math.random()*0.4) : 0
        spawnCountdown.current = baseGap + reactionBonus
        prevCost.current = cost
      }
      obs.current.forEach(o=>{ o.x -= sp*dt; if (o.shape==='saw') o.rot=(o.rot??0)+3.2*dt; if (o.shape==='flyer') o.wing=((o.wing??0)+dt*8)%2 })
      obs.current = obs.current.filter(o=>o.x+o.w>-10)

      // Clouds — slow, purely decorative
      nextCloudIn.current -= dt
      if (nextCloudIn.current <= 0) {
        clouds.current.push({ x:W+20, y:24+Math.random()*90, s:0.7+Math.random()*0.6 })
        nextCloudIn.current = 3 + Math.random()*4
      }
      clouds.current.forEach(cl => cl.x -= (20+10*Math.random())*dt)
      clouds.current = clouds.current.filter(cl => cl.x > -60)

      // Ground texture scroll
      groundOffset.current = (groundOffset.current - sp*dt) % 46

      // Coins every 400m
      if (distM >= lastCoinM.current + 400) {
        lastCoinM.current += 400
        coins.current.push({ x:W+60, y:GROUND-62, collected:false })
      }
      coins.current.forEach(c=>{ c.x -= sp*dt })
      coins.current = coins.current.filter(c=>!c.collected && c.x>-20)
      coins.current.forEach(c=>{
        if (!c.collected && Math.abs(c.x-PX)<24 && Math.abs(c.y-pY.current)<24) {
          c.collected=true; sc.current+=100; coinFlash.current=0.6; snd('coin')
          setScoreDisp(sc.current)
        }
      })

      // Distance score — 100 points ≈ 1km, a chime every 100
      const newScore = Math.floor(distM/10)
      if (newScore !== sc.current) {
        sc.current = newScore; setScoreDisp(sc.current)
        if (Math.floor(sc.current/100) > lastScoreSound.current) { lastScoreSound.current = Math.floor(sc.current/100); snd('score') }
      }
      if (coinFlash.current>0) coinFlash.current = Math.max(0, coinFlash.current-dt)

      // Collision — hitbox is ~93% of the visual sprite, a little forgiveness
      const pr = PR*HITBOX_MARGIN
      const pL=PX-pr, pR=PX+pr, pT=pY.current-pr, pB=pY.current+pr
      for (const o of obs.current) {
        const shrinkX = o.w*(1-HITBOX_MARGIN)/2, shrinkY = o.h*(1-HITBOX_MARGIN)/2
        const top = GROUND - (o.flyOffset??0) - o.h
        const oL=o.x+shrinkX, oR=o.x+o.w-shrinkX, oT=top+shrinkY, oB=top+o.h-shrinkY
        if (pR>oL && pL<oR && pB>oT && pT<oB) {
          alive.current=false; snd('doom')
          addXp(Math.floor(sc.current*0.3)); setHighScore('runner', sc.current)
          setPhase('over'); return
        }
      }

      // ── Draw ─────────────────────────────────────────────────────────
      if (distM >= 1500) {
        const h = 42 + Math.sin(Date.now()/5000*Math.PI*2)*10
        ctx.fillStyle = `hsl(${h},80%,96%)`
      } else {
        ctx.fillStyle = BG
      }
      ctx.fillRect(0,0,W,H)

      // Clouds (behind everything else)
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      for (const cl of clouds.current) {
        ctx.beginPath(); ctx.ellipse(cl.x, cl.y, 22*cl.s, 10*cl.s, 0, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.ellipse(cl.x+14*cl.s, cl.y+3*cl.s, 15*cl.s, 8*cl.s, 0, 0, Math.PI*2); ctx.fill()
      }

      // Ground band + scrolling texture ticks
      ctx.fillStyle = GC; ctx.fillRect(0,GROUND,W,H-GROUND)
      ctx.fillStyle = '#FFB830'; ctx.fillRect(0,GROUND,W,2)
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2
      for (let gx = groundOffset.current; gx < W; gx += 46) {
        ctx.beginPath(); ctx.moveTo(gx, GROUND+8); ctx.lineTo(gx+10, GROUND+8); ctx.stroke()
      }

      // Obstacles — five distinct shapes so a long run keeps introducing
      // new silhouettes: rounded crates, sharp spikes, faceted hex crystals
      // (matching the game's own hex motif), spinning saws, and — after
      // 60s — a flying creature you have to time a jump into.
      for (const o of obs.current) {
        const top = GROUND - (o.flyOffset??0) - o.h
        const cx = o.x + o.w/2

        if (o.shape === 'spike') {
          ctx.fillStyle = o.color
          ctx.beginPath(); ctx.moveTo(o.x, top+o.h); ctx.lineTo(cx, top); ctx.lineTo(o.x+o.w, top+o.h); ctx.closePath(); ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, top+o.h*0.45); ctx.stroke()
        } else if (o.shape === 'crystal') {
          const cy = top + o.h/2
          const ry = o.h/2, rx = Math.min(o.w/2, ry*0.75)
          ctx.save(); ctx.translate(cx, cy)
          ctx.fillStyle = o.color
          ctx.beginPath()
          for (let i=0;i<6;i++){ const a=(Math.PI/3)*i-Math.PI/2; const px=rx*Math.cos(a), py=ry*Math.sin(a); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py) }
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.stroke()
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'
          ctx.beginPath(); ctx.moveTo(0,-ry); ctx.lineTo(0,ry); ctx.stroke()
          ctx.restore()
        } else if (o.shape === 'saw') {
          const rad = o.w/2, cy = top + rad, teeth = 8
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot ?? 0)
          ctx.fillStyle = o.color
          ctx.beginPath()
          for (let i=0;i<teeth*2;i++){
            const a = (Math.PI/teeth)*i
            const rr = i%2===0 ? rad : rad*0.68
            const px = rr*Math.cos(a), py = rr*Math.sin(a)
            i===0?ctx.moveTo(px,py):ctx.lineTo(px,py)
          }
          ctx.closePath(); ctx.fill()
          ctx.fillStyle = 'rgba(0,0,0,0.18)'
          ctx.beginPath(); ctx.arc(0,0,rad*0.32,0,Math.PI*2); ctx.fill()
          ctx.restore()
        } else if (o.shape === 'flyer') {
          const cy = top + o.h/2
          const flap = Math.sin((o.wing??0)*Math.PI) * 9
          ctx.save(); ctx.translate(cx, cy)
          ctx.fillStyle = o.color
          ctx.beginPath(); ctx.ellipse(0,0,o.w*0.32,o.h*0.4,0,0,Math.PI*2); ctx.fill()
          ctx.fillStyle = 'rgba(124,107,255,0.55)'
          ctx.beginPath(); ctx.ellipse(-o.w*0.3,-flap,o.w*0.32,6,0.5,0,Math.PI*2); ctx.fill()
          ctx.beginPath(); ctx.ellipse(o.w*0.3,-flap,o.w*0.32,6,-0.5,0,Math.PI*2); ctx.fill()
          ctx.restore()
        } else {
          ctx.fillStyle = o.color
          ctx.beginPath(); ctx.roundRect(o.x,top,o.w,o.h,6); ctx.fill()
          ctx.fillStyle = 'rgba(255,255,255,0.18)'
          ctx.beginPath(); ctx.roundRect(o.x+2,top+2,o.w-4,o.h*0.32,[5,5,0,0]); ctx.fill()
        }
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
      if (grounded.current) rollAngle.current += sp*dt / PR

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
      ctx.globalAlpha=0.32; ctx.fillStyle='white'; ctx.beginPath()
      for(let i=0;i<3;i++){ const a=(Math.PI/3)*i-Math.PI/6; i===0?ctx.moveTo(PR*0.55*Math.cos(a),PR*0.55*Math.sin(a)):ctx.lineTo(PR*0.55*Math.cos(a),PR*0.55*Math.sin(a)) }
      ctx.closePath(); ctx.fill()
      ctx.globalAlpha=1; ctx.restore()

      // Coin collect flash
      if (coinFlash.current > 0) {
        ctx.globalAlpha = coinFlash.current/0.6
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

  // Keyboard — Space/ArrowUp jump during play, or trigger the primary
  // button from the start/game-over screens (Chrome Dino convention).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp' && e.code !== 'Enter') return
      e.preventDefault()
      if (phase === 'play') startJump()
      else if (phase === 'start') { if (hasSeenTutorial('runner')) startGame(); else setPhase('howto') }
      else if (phase === 'over') startGame()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') endJump()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [phase, startJump, endJump, startGame])

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
        <p style={{ fontSize:20,fontWeight:900,color:'#1A1A2E',margin:0 }}>{Math.floor(dist.current/DIST_SCALE).toLocaleString()}m</p>
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
          onPointerDown={startJump} onPointerUp={endJump} onPointerLeave={endJump} onPointerCancel={endJump}
          style={{ width:'100%',height:'100%',objectFit:'contain',cursor:'pointer',display:'block',touchAction:'none' }}
        />
      </div>

      {/* Jump button — hold for a higher jump, tap for a short hop */}
      <motion.button whileTap={{ scale:0.97 }}
        onPointerDown={startJump} onPointerUp={endJump} onPointerLeave={endJump} onPointerCancel={endJump}
        style={{ flexShrink:0,minHeight:72,paddingBottom:'env(safe-area-inset-bottom, 0px)',background:'rgba(26,26,46,0.05)',border:'none',
          borderTop:'1.5px solid rgba(0,0,0,0.06)',display:'flex',alignItems:'center',
          justifyContent:'center',cursor:'pointer',touchAction:'manipulation',userSelect:'none' }}>
        <span style={{ fontSize:11,fontWeight:800,letterSpacing:'0.22em',color:'rgba(26,26,46,0.3)' }}>JUMP · HOLD FOR HIGHER</span>
      </motion.button>
    </div>
  )
}
