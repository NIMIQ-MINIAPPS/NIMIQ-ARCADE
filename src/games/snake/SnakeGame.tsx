import { useRef, useEffect, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'

const BG = '#FFF9E8'
const SNAKE_COLOR = '#52D681'
const CELL = 22
const COLS = 16, ROWS = 18
const W = COLS * CELL, H = ROWS * CELL
const FOOD_COLORS = ['#FF6B6B','#93DCFF','#C4B5FD','#FDBA74','#F9A8D4','#67E8F9']
const GOLDEN_INTERVAL = 5   // every N foods, spawn golden fruit
const GOLDEN_TTL = 3000     // ms

type Dir  = 'up'|'down'|'left'|'right'
type Pos  = { x:number; y:number }

// Audio
let _ac: AudioContext | null = null
function snd(type: 'eat'|'gold'|'doom') {
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const note = (f: number, at: number, dur: number, vol: number, osc: OscillatorType = 'sine') => {
      const o = c.createOscillator(), g = c.createGain()
      o.type = osc; o.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur)
      o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur)
    }
    if (type === 'eat')  { note(500, t, 0.07, 0.09); note(700, t+0.05, 0.08, 0.08) }
    if (type === 'gold') [550,770,990,1210].forEach((f,i) => note(f, t+i*0.055, 0.12, 0.09))
    if (type === 'doom') { note(180, t, 0.45, 0.18, 'sawtooth'); note(130, t+0.3, 0.4, 0.14, 'square') }
  } catch { /**/ }
}

function randFoodColor() {
  return FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)]
}

function randPos(snake: Pos[], excluded?: Pos): Pos {
  let pos: Pos
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
  } while (
    snake.some(s => s.x === pos.x && s.y === pos.y) ||
    (excluded && excluded.x === pos.x && excluded.y === pos.y)
  )
  return pos
}

export default function SnakeGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [phase, setPhase]         = useState<'start'|'play'|'over'>('start')
  const [score, setScore]         = useState(0)
  const [length, setLength]       = useState(3)
  const [elapsed, setElapsed]     = useState(0)
  const [scoreFlash, setScoreFlash] = useState<{pts:number,gold:boolean}|null>(null)

  const snakeRef   = useRef<Pos[]>([{x:5,y:8},{x:4,y:8},{x:3,y:8}])
  const dirRef     = useRef<Dir>('right')
  const nextDirRef = useRef<Dir>('right')
  const foodRef    = useRef<{pos:Pos,color:string}>({ pos:{x:12,y:8}, color:randFoodColor() })
  const goldenRef  = useRef<{pos:Pos,expiry:number}|null>(null)
  const scoreRef   = useRef(0)
  const speedRef   = useRef(140)
  const foodCountRef = useRef(0)
  const loopRef    = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)
  const timerRef   = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const goldenTimRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)
  const aliveRef   = useRef(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, W, H)

    // Subtle dots grid (invisible feel)
    ctx.fillStyle = 'rgba(0,0,0,0.04)'
    for (let x = 0; x < COLS; x++)
      for (let y = 0; y < ROWS; y++)
        ctx.fillRect(x * CELL + CELL/2 - 1, y * CELL + CELL/2 - 1, 2, 2)

    // Golden fruit
    const gold = goldenRef.current
    if (gold && gold.expiry > Date.now()) {
      const {x,y} = gold.pos
      const cx = x*CELL + CELL/2, cy = y*CELL + CELL/2
      const rg = ctx.createRadialGradient(cx-2, cy-2, 1, cx, cy, CELL/2)
      rg.addColorStop(0, '#FFF4A0')
      rg.addColorStop(0.5, '#E9B213')
      rg.addColorStop(1, '#C8940A')
      ctx.fillStyle = rg
      ctx.shadowColor = '#E9B21380'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(cx, cy, CELL/2 - 2, 0, Math.PI*2)
      ctx.fill()
      ctx.shadowBlur = 0
      // star hint
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.arc(cx - 3, cy - 3, 2.5, 0, Math.PI*2)
      ctx.fill()
    }

    // Food
    const food = foodRef.current
    const fx = food.pos.x*CELL + CELL/2, fy = food.pos.y*CELL + CELL/2
    const rg2 = ctx.createRadialGradient(fx-2, fy-3, 1, fx, fy, CELL/2 - 1)
    rg2.addColorStop(0, food.color + 'FF')
    rg2.addColorStop(0.6, food.color + 'CC')
    rg2.addColorStop(1, food.color + '88')
    ctx.fillStyle = rg2
    ctx.shadowColor = food.color + '60'
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(fx, fy, CELL/2 - 2, 0, Math.PI*2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.arc(fx - 2, fy - 3, 2, 0, Math.PI*2)
    ctx.fill()
    ctx.shadowBlur = 0

    // Snake body
    const snake = snakeRef.current
    snake.forEach((seg, i) => {
      const isHead = i === 0
      const t = 1 - i / snake.length
      const alpha = 0.3 + t * 0.7
      const pad = isHead ? 1 : 2

      if (isHead) {
        ctx.fillStyle = SNAKE_COLOR
        ctx.shadowColor = SNAKE_COLOR + '60'
        ctx.shadowBlur = 6
      } else {
        ctx.fillStyle = `rgba(82,214,129,${alpha})`
        ctx.shadowBlur = 0
      }

      const r = isHead ? 8 : 6
      const x = seg.x * CELL + pad, y = seg.y * CELL + pad
      const s = CELL - pad*2
      ctx.beginPath()
      ctx.roundRect(x, y, s, s, r)
      ctx.fill()
      ctx.shadowBlur = 0

      // Eyes on head
      if (isHead) {
        const d = dirRef.current
        const hx = seg.x * CELL + CELL/2, hy = seg.y * CELL + CELL/2
        const eyeOffset = 4
        let e1x = hx, e1y = hy, e2x = hx, e2y = hy
        if (d === 'right') { e1x = hx+4; e1y = hy-eyeOffset; e2x = hx+4; e2y = hy+eyeOffset }
        if (d === 'left')  { e1x = hx-4; e1y = hy-eyeOffset; e2x = hx-4; e2y = hy+eyeOffset }
        if (d === 'up')    { e1x = hx-eyeOffset; e1y = hy-4; e2x = hx+eyeOffset; e2y = hy-4 }
        if (d === 'down')  { e1x = hx-eyeOffset; e1y = hy+4; e2x = hx+eyeOffset; e2y = hy+4 }
        ctx.fillStyle = '#1A1A2E'
        ;[{x:e1x,y:e1y},{x:e2x,y:e2y}].forEach(e => {
          ctx.beginPath(); ctx.arc(e.x, e.y, 2.5, 0, Math.PI*2); ctx.fill()
        })
      }
    })
  }, [])

  const tick = useCallback(() => {
    if (!aliveRef.current) return
    dirRef.current = nextDirRef.current
    const head = { ...snakeRef.current[0] }
    if (dirRef.current === 'up')    head.y--
    if (dirRef.current === 'down')  head.y++
    if (dirRef.current === 'left')  head.x--
    if (dirRef.current === 'right') head.x++

    // Collision: wall or self
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
        snakeRef.current.some(s => s.x === head.x && s.y === head.y)) {
      aliveRef.current = false
      clearTimeout(loopRef.current)
      clearInterval(timerRef.current)
      snd('doom')
      addXp(Math.floor(scoreRef.current * 0.5))
      setHighScore('snake-path', scoreRef.current)
      draw()
      setPhase('over')
      return
    }

    snakeRef.current.unshift(head)
    let grew = false

    // Check golden fruit
    const gold = goldenRef.current
    if (gold && gold.expiry > Date.now() && head.x === gold.pos.x && head.y === gold.pos.y) {
      scoreRef.current += 50
      setScore(scoreRef.current)
      setScoreFlash({pts:50,gold:true})
      setTimeout(() => setScoreFlash(null), 700)
      snd('gold')
      goldenRef.current = null
      grew = true
    }

    // Check regular food
    const food = foodRef.current
    if (head.x === food.pos.x && head.y === food.pos.y) {
      scoreRef.current += 10
      setScore(scoreRef.current)
      setScoreFlash({pts:10,gold:false})
      setTimeout(() => setScoreFlash(null), 500)
      snd('eat')
      foodCountRef.current++

      // Speed up
      if (speedRef.current > 65) speedRef.current -= 3

      // Spawn golden fruit every N foods
      if (foodCountRef.current % GOLDEN_INTERVAL === 0) {
        const gpos = randPos(snakeRef.current, food.pos)
        const expiry = Date.now() + GOLDEN_TTL
        goldenRef.current = { pos: gpos, expiry }
        clearTimeout(goldenTimRef.current)
        goldenTimRef.current = setTimeout(() => {
          goldenRef.current = null
          draw()
        }, GOLDEN_TTL)
      }

      foodRef.current = { pos: randPos(snakeRef.current), color: randFoodColor() }
      grew = true
    }

    if (!grew) snakeRef.current.pop()
    setLength(snakeRef.current.length)
    draw()
    loopRef.current = setTimeout(tick, speedRef.current)
  }, [draw, addXp, setHighScore])

  const startGame = useCallback(() => {
    aliveRef.current = true
    snakeRef.current = [{x:5,y:8},{x:4,y:8},{x:3,y:8}]
    dirRef.current = 'right'; nextDirRef.current = 'right'
    scoreRef.current = 0; speedRef.current = 140; foodCountRef.current = 0
    foodRef.current = { pos: randPos(snakeRef.current), color: randFoodColor() }
    goldenRef.current = null
    setScore(0); setLength(3); setElapsed(0); setScoreFlash(null)
    setPhase('play')
    clearTimeout(loopRef.current)
    clearTimeout(goldenTimRef.current)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (canvas) {
        const dpr = window.devicePixelRatio || 1
        canvas.width  = W * dpr
        canvas.height = H * dpr
      }
      draw()
      loopRef.current = setTimeout(tick, speedRef.current)
    })
  }, [draw, tick])

  const turn = useCallback((d: Dir) => {
    const opp: Record<Dir,Dir> = {up:'down',down:'up',left:'right',right:'left'}
    if (d !== opp[dirRef.current]) nextDirRef.current = d
  }, [])

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')    { e.preventDefault(); turn('up') }
      if (e.key === 'ArrowDown')  { e.preventDefault(); turn('down') }
      if (e.key === 'ArrowLeft')  turn('left')
      if (e.key === 'ArrowRight') turn('right')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [turn])

  useEffect(() => () => {
    aliveRef.current = false
    clearTimeout(loopRef.current)
    clearTimeout(goldenTimRef.current)
    clearInterval(timerRef.current)
  }, [])

  const best = highScores['snake-path'] ?? 0
  const xp   = Math.floor(scoreRef.current * 0.5)
  const fmt  = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  // ── START ─────────────────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, fontFamily:'system-ui,sans-serif', position:'relative' }}>
        <button onClick={onExit} style={{ position:'absolute', top:20, left:20, background:'none', border:'none', color:'#CCC', fontSize:22, cursor:'pointer' }}>←</button>
        {/* Illustration */}
        <svg width={180} height={150} viewBox={`0 0 ${W} ${H}`}
          style={{ borderRadius:16, filter:'drop-shadow(0 8px 24px rgba(0,0,0,0.08))' }}>
          <rect width={W} height={H} fill="white" rx={12}/>
          {[{x:7,y:8},{x:6,y:8},{x:5,y:8},{x:5,y:9},{x:5,y:10},{x:6,y:10},{x:7,y:10},{x:8,y:10}].map((seg,i) => {
            const t = 1 - i/8
            return (
              <rect key={i} x={seg.x*CELL+2} y={seg.y*CELL+2} width={CELL-4} height={CELL-4}
                rx={6} fill={`rgba(82,214,129,${0.35+t*0.65})`}/>
            )
          })}
          <circle cx={11*CELL+CELL/2} cy={8*CELL+CELL/2} r={CELL/2-2} fill="#FF6B6B"/>
        </svg>
        <div style={{ textAlign:'center' }}>
          <h1 style={{ fontSize:30, fontWeight:900, color:'#1A1A2E', margin:'0 0 8px', letterSpacing:'0.05em' }}>SNAKE PATH</h1>
          <p style={{ color:'#AAA', fontSize:12, fontWeight:700, letterSpacing:'0.14em', margin:0 }}>EAT. GROW. SURVIVE.</p>
        </div>
        <motion.button whileTap={{ scale:0.96 }} onClick={startGame}
          style={{ background:'#1A1A2E', color:BG, border:'none', borderRadius:16, padding:'16px 64px', fontSize:18, fontWeight:900, cursor:'pointer', letterSpacing:'0.12em' }}>
          PLAY
        </motion.button>
        {best > 0 && <p style={{ color:'#BBB', fontSize:13, margin:0 }}>BEST: {best.toLocaleString()}</p>}
      </div>
    )
  }

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  if (phase === 'over') {
    return (
      <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, fontFamily:'system-ui,sans-serif' }}>
        <p style={{ fontSize:12, fontWeight:800, color:'#FF6B6B', letterSpacing:'0.22em', margin:0 }}>GAME OVER</p>
        <p style={{ fontSize:52, fontWeight:900, color:'#1A1A2E', margin:0, lineHeight:1 }}>{scoreRef.current.toLocaleString()}</p>
        <div style={{ display:'flex', gap:36 }}>
          {([['LENGTH',snakeRef.current.length],['TIME',elapsed]] as [string,number][]).map(([lbl,val]) => (
            <div key={lbl} style={{ textAlign:'center' }}>
              <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>{lbl}</p>
              <p style={{ fontSize:24, fontWeight:900, color:'#1A1A2E', margin:0 }}>
                {lbl === 'TIME' ? fmt(val) : val}
              </p>
            </div>
          ))}
        </div>
        <p style={{ fontSize:13, color:'#AAA', margin:0 }}>XP +{xp}</p>
        {scoreRef.current > 0 && scoreRef.current >= best && (
          <p style={{ fontSize:11, color:'#E9B213', fontWeight:800, margin:0, letterSpacing:'0.15em' }}>NEW BEST</p>
        )}
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <motion.button whileTap={{ scale:0.96 }} onClick={startGame}
            style={{ background:'#1A1A2E', color:BG, border:'none', borderRadius:14, padding:'15px 32px', fontSize:14, fontWeight:900, cursor:'pointer', letterSpacing:'0.1em' }}>
            PLAY AGAIN
          </motion.button>
          <motion.button whileTap={{ scale:0.96 }} onClick={onExit}
            style={{ background:'none', color:'#AAA', border:'1.5px solid rgba(0,0,0,0.12)', borderRadius:14, padding:'15px 22px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
            HOME
          </motion.button>
        </div>
      </div>
    )
  }

  // ── PLAY ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', fontFamily:'system-ui,sans-serif', overflow:'hidden' }}>

      {/* HUD */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px 6px', flexShrink:0 }}>
        <div style={{ textAlign:'center', minWidth:60 }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>TIME</p>
          <p style={{ fontSize:18, fontWeight:900, color:'#1A1A2E', margin:0, lineHeight:1.2 }}>{fmt(elapsed)}</p>
        </div>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>SCORE</p>
          <p style={{ fontSize:22, fontWeight:900, color:'#1A1A2E', margin:0, lineHeight:1.1 }}>{score.toLocaleString()}</p>
        </div>
        <div style={{ textAlign:'center', minWidth:60 }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>LENGTH</p>
          <p style={{ fontSize:18, fontWeight:900, color:'#1A1A2E', margin:0, lineHeight:1.2 }}>{length}</p>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', position:'relative', overflow:'hidden' }}>
        <canvas ref={canvasRef}
          style={{ maxWidth:'100%', maxHeight:'100%', width:W, height:H, borderRadius:10, boxShadow:'0 4px 24px rgba(0,0,0,0.07)', objectFit:'contain' }}
        />
        {/* Score flash */}
        {scoreFlash && (
          <motion.div
            key={String(Date.now())}
            initial={{ y:0, opacity:1 }}
            animate={{ y:-50, opacity:0 }}
            transition={{ duration:0.55 }}
            style={{
              position:'absolute', top:'35%', left:'50%', transform:'translateX(-50%)',
              fontSize:scoreFlash.gold ? 22 : 18, fontWeight:900, pointerEvents:'none', whiteSpace:'nowrap',
              color: scoreFlash.gold ? '#E9B213' : SNAKE_COLOR,
              filter: scoreFlash.gold ? 'drop-shadow(0 2px 6px #E9B21380)' : 'none',
            }}>
            {scoreFlash.gold ? `⭐ +${scoreFlash.pts}` : `+${scoreFlash.pts}`}
          </motion.div>
        )}
      </div>

      {/* D-pad */}
      <div style={{ flexShrink:0, padding:'8px 0', paddingBottom:'max(14px, env(safe-area-inset-bottom, 14px))', display:'flex', justifyContent:'center' }}>
        <div style={{ display:'grid', gridTemplateColumns:'76px 76px 76px', gridTemplateRows:'72px 72px 72px', gap:6 }}>
          {/* Up */}
          <div style={{ gridColumn:2, gridRow:1 }}>
            <DBtn label="▲" onPress={() => turn('up')} />
          </div>
          {/* Left */}
          <div style={{ gridColumn:1, gridRow:2 }}>
            <DBtn label="◀" onPress={() => turn('left')} />
          </div>
          {/* Right */}
          <div style={{ gridColumn:3, gridRow:2 }}>
            <DBtn label="▶" onPress={() => turn('right')} />
          </div>
          {/* Down */}
          <div style={{ gridColumn:2, gridRow:3 }}>
            <DBtn label="▼" onPress={() => turn('down')} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <motion.button
      whileTap={{ scale:0.88, backgroundColor:'#E8FFE8' }}
      onPointerDown={e => { e.preventDefault(); onPress() }}
      style={{
        width:'100%', height:'100%', background:'white', border:'none',
        borderRadius:16, fontSize:20, cursor:'pointer',
        boxShadow:'0 2px 10px rgba(0,0,0,0.07)', color:'#444', fontWeight:800,
        touchAction:'manipulation', userSelect:'none', WebkitUserSelect:'none',
      }}>
      {label}
    </motion.button>
  )
}
