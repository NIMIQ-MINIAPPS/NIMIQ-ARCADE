import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'

const BG = '#FFF9E8'
const PASTEL_COLS = ['#93DCFF','#C4B5FD','#86EFAC','#FDBA74','#FCA5A5','#FCD34D']
const DECOY_COL  = '#D0D0D0'
const HEX_CLIP   = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)'

let _uid = 0

interface Target {
  id: number
  x: number; y: number
  size: number
  born: number
  vx: number; vy: number
  rotation: number; rotSpeed: number
  color: string
  isDecoy: boolean
}

interface Flash { id: number; text: string; x: number; y: number; color: string }

// Stage 8 used to be the ceiling — hits >= 140 stayed at fixed "max chaos"
// forever, meaning a bot (or a very good human) that survived past it could
// farm score at a constant, learnable difficulty indefinitely. Stage now
// keeps climbing forever (one more stage every 40 additional hits), and
// every difficulty knob below keeps tightening past stage 8 too, decaying
// toward a hard floor instead of flatlining — there's no point at which
// this game stops getting harder.
function getStage(hits: number) {
  if (hits < 5)   return 1
  if (hits < 15)  return 2
  if (hits < 30)  return 3
  if (hits < 50)  return 4   // targets move
  if (hits < 75)  return 5   // smaller + faster
  if (hits < 100) return 6   // decoys appear
  if (hits < 140) return 7   // targets rotate
  return 8 + Math.floor((hits - 140) / 40) // max chaos, then keeps escalating
}

function maxSimult(stage: number) {
  if (stage <= 1) return 1
  if (stage <= 2) return 2
  if (stage <= 3) return 3
  if (stage <= 6) return 3
  if (stage <= 7) return 4
  return Math.min(10, 5 + Math.floor((stage - 8) / 3)) // +1 simultaneous target every 3 stages, capped at 10 (screen limit)
}

function targetSize(stage: number, base = 72): number {
  if (stage <= 2) return base
  if (stage <= 4) return base - 6
  if (stage <= 6) return base - 12
  if (stage <= 7) return base - 16
  return Math.max(22, Math.round((base - 20) * Math.pow(0.97, stage - 8))) // shrinks toward a 22px floor
}

function lifetime(stage: number): number {
  if (stage <= 2) return 2200
  if (stage <= 4) return 1800
  if (stage <= 6) return 1400
  if (stage <= 7) return 1100
  return Math.max(280, Math.round(900 * Math.pow(0.96, stage - 8))) // shrinks toward a 280ms floor
}

function spawnInterval(stage: number): number {
  if (stage <= 1) return 1400
  if (stage <= 2) return 1100
  if (stage <= 3) return 900
  if (stage <= 5) return 700
  if (stage <= 7) return 550
  return Math.max(180, Math.round(420 * Math.pow(0.96, stage - 8))) // shrinks toward a 180ms floor
}

function scoreLabel(ms: number): [string, number, string] {
  if (ms < 280) return ['PERFECT', 150, '#86EFAC']
  if (ms < 600) return ['FAST',    100, '#93DCFF']
  if (ms < 1000) return ['GOOD',    50, '#C4B5FD']
  return              ['SLOW',     20,  '#FDBA74']
}

let _ac: AudioContext | null = null
function snd(type: 'tap' | 'decoy' | 'miss' | 'doom') {
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const n = (f: number, at: number, d: number, v: number, o: OscillatorType = 'sine') => {
      const osc = c.createOscillator(), g = c.createGain()
      osc.type = o; osc.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.001, at + d)
      osc.connect(g); g.connect(c.destination); osc.start(at); osc.stop(at + d)
    }
    if (type === 'tap')   [660,880].forEach((f,i)=>n(f,t+i*0.04,0.1,0.08))
    if (type === 'decoy') n(180,t,0.2,0.14,'sawtooth')
    if (type === 'miss')  n(260,t,0.12,0.08,'triangle')
    if (type === 'doom')  { n(180,t,0.4,0.18,'sawtooth'); n(130,t+0.3,0.4,0.14,'square') }
  } catch {/**/}
}

export default function QuickTapGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const areaRef = useRef<HTMLDivElement>(null)

  const [phase,   setPhase]   = useState<'start'|'play'|'over'>('start')
  const [targets, setTargets] = useState<Target[]>([])
  const [flashes, setFlashes] = useState<Flash[]>([])
  const [score,   setScore]   = useState(0)
  const [misses,  setMisses]  = useState(0)
  const [stage,   setStage]   = useState(1)

  const scoreRef  = useRef(0), hitsRef = useRef(0), missRef = useRef(0)
  const alive     = useRef(false)
  const spawnId   = useRef<any>(0)
  const cleanId   = useRef<any>(0)
  const moveId    = useRef<any>(0)

  const spawnTarget = useCallback(() => {
    const area = areaRef.current
    if (!area || !alive.current) return
    const rect   = area.getBoundingClientRect()
    const st     = getStage(hitsRef.current)
    const sz     = targetSize(st)
    const isDecoy = st >= 6 && Math.random() < 0.28
    const color  = isDecoy ? DECOY_COL : PASTEL_COLS[Math.floor(Math.random() * PASTEL_COLS.length)]
    const moving  = st >= 4
    const speed   = moving ? (0.6 + Math.random() * 1.2) : 0
    const angle   = Math.random() * Math.PI * 2
    const rotating = st >= 7
    const rotSpd  = rotating ? (2 + Math.random() * 3) * (Math.random() > 0.5 ? 1 : -1) : 0

    setTargets(prev => {
      if (prev.filter(t => !t.isDecoy).length >= maxSimult(st)) return prev
      return [...prev, {
        id: ++_uid,
        x: Math.random() * (rect.width  - sz - 16) + 8,
        y: Math.random() * (rect.height - sz - 16) + 8,
        size: sz, born: Date.now(),
        vx: moving ? Math.cos(angle) * speed : 0,
        vy: moving ? Math.sin(angle) * speed : 0,
        rotation: 0, rotSpeed: rotSpd,
        color, isDecoy,
      }]
    })
  }, [])

  const startGame = useCallback(() => {
    alive.current = true; scoreRef.current = 0; hitsRef.current = 0; missRef.current = 0
    setScore(0); setMisses(0); setStage(1); setTargets([]); setFlashes([])
    setPhase('play')
  }, [])

  // Spawn interval — restarts when stage changes
  useEffect(() => {
    if (phase !== 'play') return
    const st = getStage(hitsRef.current)
    spawnId.current = setInterval(spawnTarget, spawnInterval(st))
    return () => clearInterval(spawnId.current)
  }, [phase, stage, spawnTarget])

  // Clean up expired targets
  useEffect(() => {
    if (phase !== 'play') return
    cleanId.current = setInterval(() => {
      const now = Date.now()
      const st  = getStage(hitsRef.current)
      const lt  = lifetime(st)
      setTargets(prev => {
        const expired = prev.filter(t => now - t.born > lt)
        if (expired.length > 0) {
          expired.forEach(() => snd('miss'))
          missRef.current += expired.length
          const newMiss = missRef.current
          setMisses(newMiss)
          if (newMiss >= 5) {
            alive.current = false
            snd('doom')
            addXp(Math.floor(scoreRef.current * 0.5))
            setHighScore('quicktap', scoreRef.current)
            setPhase('over')
          }
        }
        return prev.filter(t => now - t.born <= lt)
      })
    }, 150)
    return () => clearInterval(cleanId.current)
  }, [phase, addXp, setHighScore])

  // Move + rotate targets
  useEffect(() => {
    if (phase !== 'play') return
    moveId.current = setInterval(() => {
      const area = areaRef.current
      if (!area) return
      const { width, height } = area.getBoundingClientRect()
      setTargets(prev => prev.map(t => {
        if (t.vx === 0 && t.rotSpeed === 0) return t
        let nx = t.x + t.vx, ny = t.y + t.vy
        let nvx = t.vx, nvy = t.vy
        if (nx < 0 || nx + t.size > width)  { nvx = -nvx; nx = Math.max(0, Math.min(nx, width  - t.size)) }
        if (ny < 0 || ny + t.size > height) { nvy = -nvy; ny = Math.max(0, Math.min(ny, height - t.size)) }
        return { ...t, x: nx, y: ny, vx: nvx, vy: nvy, rotation: t.rotation + t.rotSpeed }
      }))
    }, 16)
    return () => clearInterval(moveId.current)
  }, [phase])

  useEffect(() => () => { alive.current = false; clearInterval(spawnId.current); clearInterval(cleanId.current); clearInterval(moveId.current) }, [])

  const handleTap = useCallback((t: Target, e: React.PointerEvent) => {
    e.stopPropagation()
    if (!alive.current) return
    setTargets(prev => prev.filter(tt => tt.id !== t.id))

    if (t.isDecoy) {
      snd('decoy')
      scoreRef.current = Math.max(0, scoreRef.current - 50)
      setScore(scoreRef.current)
      setFlashes(prev => [...prev, { id: ++_uid, text: '-50', x: t.x + t.size/2, y: t.y, color: '#FF6B6B' }])
      setTimeout(() => setFlashes(prev => prev.filter(f => f.id !== _uid)), 700)
      return
    }

    snd('tap')
    const reaction = Date.now() - t.born
    const [label, pts, color] = scoreLabel(reaction)
    scoreRef.current += pts; setScore(scoreRef.current)
    hitsRef.current++
    const newStage = getStage(hitsRef.current); setStage(newStage)
    const fid = ++_uid
    setFlashes(prev => [...prev, { id: fid, text: `${label} +${pts}`, x: t.x + t.size/2, y: t.y, color }])
    setTimeout(() => setFlashes(prev => prev.filter(f => f.id !== fid)), 750)
  }, [])

  const best = highScores['quicktap'] ?? 0

  const stageLabels = ['','1 TARGET','2 TARGETS','3 TARGETS','MOVING','SMALLER','DECOYS','ROTATING','MAX CHAOS']

  // ── START ─────────────────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ width:'100%',height:'100%',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24,fontFamily:'system-ui,sans-serif',position:'relative' }}>
      <button onClick={onExit} style={{ position:'absolute',top:20,left:20,background:'none',border:'none',color:'#BBB',fontSize:22,cursor:'pointer' }}>←</button>
      {/* Hex targets illustration */}
      <div style={{ position:'relative',width:200,height:110 }}>
        {[{x:10,y:20,s:64,c:'#93DCFF',r:-8},{x:70,y:5,s:58,c:'#C4B5FD',r:5},{x:128,y:22,s:60,c:'#86EFAC',r:-3}].map((h,i)=>(
          <div key={i} style={{ position:'absolute',left:h.x,top:h.y,width:h.s,height:h.s,
            background:h.c,clipPath:HEX_CLIP,transform:`rotate(${h.r}deg)`,
            boxShadow:'0 4px 16px rgba(0,0,0,0.1)',display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:h.s*0.35,color:'rgba(255,255,255,0.5)' }}>⬡</div>
        ))}
      </div>
      <div style={{ textAlign:'center' }}>
        <h1 style={{ fontSize:28,fontWeight:900,color:'#1A1A2E',margin:'0 0 8px',letterSpacing:'0.05em' }}>QUICK TAP</h1>
        <p style={{ color:'#BBB',fontSize:11,fontWeight:700,letterSpacing:'0.14em',margin:0 }}>TAP · REACT · REPEAT</p>
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
        {([['HITS',hitsRef.current],['STAGE',getStage(hitsRef.current)]] as [string,number][]).map(([l,v])=>(
          <div key={l} style={{ textAlign:'center' }}>
            <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#BBB',margin:0 }}>{l}</p>
            <p style={{ fontSize:26,fontWeight:900,color:'#1A1A2E',margin:0 }}>{v}</p>
          </div>
        ))}
      </div>
      <p style={{ fontSize:13,color:'#AAA',margin:0 }}>XP +{Math.floor(scoreRef.current*0.5)}</p>
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
    <div style={{ width:'100%',height:'100%',background:BG,display:'flex',flexDirection:'column',fontFamily:'system-ui,sans-serif',overflow:'hidden' }}>

      {/* HUD */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 20px 4px',flexShrink:0 }}>
        <button onClick={()=>{ alive.current=false; onExit() }}
          style={{ background:'none',border:'none',color:'#CCC',fontSize:20,cursor:'pointer',padding:0 }}>←</button>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#BBB',margin:0 }}>SCORE</p>
          <p style={{ fontSize:20,fontWeight:900,color:'#1A1A2E',margin:0,lineHeight:1.1 }}>{score.toLocaleString()}</p>
        </div>
        <div style={{ display:'flex',gap:4,alignItems:'center' }}>
          {[0,1,2,3,4].map(i=>(
            <div key={i} style={{ width:9,height:9,borderRadius:'50%',
              background: i < misses ? '#FF6B6B' : 'rgba(0,0,0,0.1)' }}/>
          ))}
        </div>
      </div>

      {/* Stage label */}
      <div style={{ textAlign:'center',padding:'2px 0 4px',flexShrink:0 }}>
        <p style={{ fontSize:9,fontWeight:800,letterSpacing:'0.18em',color:'#C4B5FD',margin:0 }}>
          {stageLabels[stage]}
        </p>
      </div>

      {/* Play area */}
      <div ref={areaRef} style={{ flex:1,position:'relative',overflow:'hidden',
        background:'rgba(255,255,255,0.4)',margin:'0 12px 12px',borderRadius:20,
        boxShadow:'inset 0 0 0 1.5px rgba(0,0,0,0.05)' }}>

        {/* Score flashes */}
        <AnimatePresence>
          {flashes.map(f=>(
            <motion.div key={f.id}
              initial={{ opacity:1,y:0,scale:1 }} animate={{ opacity:0,y:-50,scale:1.1 }}
              transition={{ duration:0.7 }}
              style={{ position:'absolute',left:f.x,top:f.y,transform:'translateX(-50%)',
                pointerEvents:'none',fontWeight:900,fontSize:13,color:f.color,
                filter:'drop-shadow(0 1px 4px rgba(0,0,0,0.15))',whiteSpace:'nowrap',zIndex:20 }}>
              {f.text}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Targets */}
        <AnimatePresence>
          {targets.map(t => (
            <motion.div key={t.id}
              initial={{ scale:0, opacity:0 }}
              animate={{ scale:1, opacity:1 }}
              exit={{ scale:0, opacity:0, transition:{ duration:0.15 } }}
              onPointerDown={e => handleTap(t, e)}
              style={{
                position:'absolute',
                left: t.x, top: t.y,
                width: t.size, height: t.size,
                background: t.color,
                clipPath: HEX_CLIP,
                transform: `rotate(${t.rotation}deg)`,
                cursor: 'pointer',
                touchAction: 'manipulation',
                boxShadow: t.isDecoy
                  ? '0 4px 12px rgba(0,0,0,0.1)'
                  : `0 6px 20px ${t.color}55`,
                display:'flex',alignItems:'center',justifyContent:'center',
                userSelect:'none',
              }}>
              {/* Inner highlight */}
              <div style={{ width:'40%',height:'40%',background:'rgba(255,255,255,0.35)',
                clipPath:HEX_CLIP,pointerEvents:'none' }}/>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
