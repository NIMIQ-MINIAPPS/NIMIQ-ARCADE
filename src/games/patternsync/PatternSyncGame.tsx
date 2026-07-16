import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import LivesHearts from '../../components/games/LivesHearts'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'

const BG = '#FFF9E8'
const PASTELS = ['#93DCFF','#C4B5FD','#86EFAC','#FDBA74','#F9A8D4','#67E8F9','#FCD34D']
const SHAPES = ['circle','square','hex','triangle'] as const
type Shape = typeof SHAPES[number]
type Item = { color: string; shape: Shape; id: number }

let _uid = 0
const uid = () => ++_uid

// Scattered positions as % of play area (left, top)
const LAYOUTS: Record<number, {x:number,y:number}[]> = {
  3: [{x:22,y:22},{x:70,y:18},{x:46,y:64}],
  4: [{x:18,y:16},{x:72,y:18},{x:16,y:68},{x:72,y:70}],
  5: [{x:18,y:12},{x:70,y:14},{x:44,y:46},{x:14,y:72},{x:74,y:70}],
  6: [{x:16,y:10},{x:70,y:12},{x:14,y:46},{x:76,y:48},{x:18,y:80},{x:74,y:78}],
  7: [{x:12,y:8},{x:50,y:6},{x:80,y:10},{x:12,y:48},{x:80,y:46},{x:24,y:82},{x:76,y:80}],
}

function randColor(lvl: number): string {
  const pool = lvl >= 5
    ? ['#93DCFF','#A8E4FF','#C4B5FD','#D4C8FE','#86EFAC','#A0F4C0','#FDBA74','#F9A8D4','#67E8F9','#FCD34D']
    : PASTELS
  const count = Math.min(4 + Math.floor(lvl / 2), pool.length)
  return pool[Math.floor(Math.random() * count)]
}

function randShape(lvl: number): Shape {
  const shapes: Shape[] = lvl < 3 ? ['circle','square'] : lvl < 5 ? ['circle','square','hex'] : [...SHAPES]
  return shapes[Math.floor(Math.random() * shapes.length)]
}

function genItem(lvl: number): Item {
  return { color: randColor(lvl), shape: randShape(lvl), id: uid() }
}

function genSeq(len: number, lvl: number): Item[] {
  return Array.from({ length: len }, () => genItem(lvl))
}

function genOptions(correct: Item, lvl: number): Item[] {
  const key = (i: Item) => `${i.color}|${i.shape}`
  const seen = new Set([key(correct)])
  const opts = [{ ...correct, id: uid() }]
  let tries = 0
  while (opts.length < 4 && tries < 200) {
    tries++
    const c = genItem(lvl)
    if (!seen.has(key(c))) { seen.add(key(c)); opts.push(c) }
  }
  return opts.sort(() => Math.random() - 0.5)
}

// Audio
let _ac: AudioContext | null = null
function snd(type: 'correct' | 'wrong') {
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const note = (f: number, at: number, dur: number, vol: number, osc: OscillatorType = 'sine') => {
      const o = c.createOscillator(), g = c.createGain()
      o.type = osc; o.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur)
      o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur)
    }
    if (type === 'correct') [660, 880].forEach((f, i) => note(f, t + i*0.06, 0.14, 0.09))
    if (type === 'wrong')   note(200, t, 0.18, 0.18, 'sawtooth')
  } catch { /**/ }
}

// Shape renderer
function Shape({ shape, color, size }: { shape: Shape; color: string; size: number }) {
  const shadow = `drop-shadow(0 6px 14px ${color}66)`
  if (shape === 'circle') {
    return <div style={{ width:size, height:size, borderRadius:'50%', background:color, filter:shadow }} />
  }
  if (shape === 'square') {
    return <div style={{ width:size, height:size, borderRadius:size*0.2, background:color, filter:shadow }} />
  }
  const R = size / 2
  if (shape === 'hex') {
    const pts = Array.from({length:6}, (_,i) => {
      const a = Math.PI/3*i - Math.PI/6
      return `${R+R*Math.cos(a)},${R+R*Math.sin(a)}`
    }).join(' ')
    return (
      <svg width={size} height={size} style={{ filter:shadow }}>
        <polygon points={pts} fill={color} />
      </svg>
    )
  }
  // triangle
  const pts = `${R},${R*0.12} ${R*1.88},${R*1.88} ${R*0.12},${R*1.88}`
  return (
    <svg width={size} height={size} style={{ filter:shadow }}>
      <polygon points={pts} fill={color} />
    </svg>
  )
}

export default function PatternSyncGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()

  const [phase, setPhase] = useState<'start'|'howto'|'memorize'|'find'|'over'>('start')
  const [sequence, setSequence] = useState<Item[]>([])
  const [missingIdx, setMissingIdx] = useState(0)
  const [options, setOptions] = useState<Item[]>([])
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [seqLen, setSeqLen] = useState(3)
  const [tapped, setTapped] = useState<string|null>(null)   // "color|shape" of tapped opt
  const [scoreFlash, setScoreFlash] = useState<string|null>(null)
  const [shake, setShake] = useState(false)

  const scoreRef   = useRef(0)
  const livesRef   = useRef(3)
  const seqLenRef  = useRef(3)
  const levelRef   = useRef(1)
  const correctRef = useRef(0)
  const isAliveRef = useRef(false)
  const timerRef   = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)

  const setupRound = useCallback((len: number, lvl: number) => {
    const seq = genSeq(len, lvl)
    const idx = Math.floor(Math.random() * len)
    setSequence(seq); setMissingIdx(idx)
    setOptions(genOptions(seq[idx], lvl))
    setTapped(null); setScoreFlash(null)
    setPhase('memorize')
    const showTime = Math.max(1400, 2200 - lvl * 60)
    timerRef.current = setTimeout(() => setPhase('find'), showTime)
  }, [])

  const start = useCallback(() => {
    scoreRef.current = 0; livesRef.current = 3; seqLenRef.current = 3; levelRef.current = 1; correctRef.current = 0
    setScore(0); setLives(3); setSeqLen(3); setLevel(1)
    isAliveRef.current = true
    setupRound(3, 1)
  }, [setupRound])

  const handlePick = useCallback((opt: Item) => {
    if (phase !== 'find' || tapped !== null) return
    const correct = sequence[missingIdx]
    const ok = opt.color === correct.color && opt.shape === correct.shape
    const key = `${opt.color}|${opt.shape}`
    setTapped(key)

    if (ok) {
      snd('correct')
      correctRef.current++
      const pts = seqLenRef.current * 25
      scoreRef.current += pts
      setScore(scoreRef.current)
      setScoreFlash(`+${pts}`)

      if (correctRef.current % 2 === 0) {
        seqLenRef.current = Math.min(7, seqLenRef.current + 1)
        setSeqLen(seqLenRef.current)
      }
      const newLvl = Math.floor(correctRef.current / 4) + 1
      levelRef.current = newLvl
      setLevel(newLvl)
      timerRef.current = setTimeout(() => setupRound(seqLenRef.current, levelRef.current), 650)
    } else {
      snd('wrong')
      setShake(true); setTimeout(() => setShake(false), 380)
      livesRef.current--; setLives(livesRef.current)
      if (livesRef.current <= 0) {
        isAliveRef.current = false
        timerRef.current = setTimeout(() => {
          addXp(Math.floor(scoreRef.current * 0.4))
          setHighScore('pattern-sync', scoreRef.current)
          setPhase('over')
        }, 700)
      } else {
        timerRef.current = setTimeout(() => setupRound(seqLenRef.current, levelRef.current), 800)
      }
    }
  }, [phase, tapped, sequence, missingIdx, setupRound, addXp, setHighScore])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const best = highScores['pattern-sync'] ?? 0
  const xp   = Math.floor(scoreRef.current * 0.4)
  const positions = LAYOUTS[sequence.length] || LAYOUTS[3]
  const correct = sequence[missingIdx]

  // ── HOW TO PLAY ───────────────────────────────────────────────────────────
  if (phase === 'howto') {
    return (
      <div style={{ width:'100%', height:'100%', position:'relative' }}>
        <HowToPlayOverlay
          bg={BG}
          accent="#1A1A2E"
          textColor="#1A1A2E"
          mutedColor="#999"
          bullets={TUTORIALS['pattern-sync']}
          onStart={() => { markTutorialSeen('pattern-sync'); start() }}
        />
      </div>
    )
  }

  // ── START ──────────────────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, fontFamily:'system-ui,sans-serif', position:'relative' }}>
        <button onClick={onExit} style={{ position:'absolute', top:20, left:20, background:'none', border:'none', color:'#CCC', fontSize:22, cursor:'pointer' }}>←</button>
        <div style={{ position:'relative', width:190, height:170 }}>
          {([
            {shape:'circle' as Shape,color:'#93DCFF',x:10,y:14,size:70},
            {shape:'hex'    as Shape,color:'#C4B5FD',x:118,y:8 ,size:64},
            {shape:'square' as Shape,color:'#86EFAC',x:16 ,y:96,size:58},
            {shape:'triangle' as Shape,color:'#FDBA74',x:118,y:96,size:60},
          ]).map((el,i) => (
            <motion.div key={i}
              initial={{ scale:0, opacity:0 }}
              animate={{ scale:1, opacity:1 }}
              transition={{ delay:i*0.1, type:'spring', stiffness:260, damping:20 }}
              style={{ position:'absolute', left:el.x, top:el.y }}>
              <Shape shape={el.shape} color={el.color} size={el.size} />
            </motion.div>
          ))}
        </div>
        <div style={{ textAlign:'center' }}>
          <h1 style={{ fontSize:30, fontWeight:900, color:'#1A1A2E', margin:'0 0 8px', letterSpacing:'0.05em' }}>PATTERN SYNC</h1>
          <p style={{ color:'#AAA', fontSize:12, fontWeight:700, letterSpacing:'0.14em', margin:0 }}>MEMORIZE. FIND. MATCH.</p>
        </div>
        <motion.button whileTap={{ scale:0.96 }} onClick={() => { if (hasSeenTutorial('pattern-sync')) start(); else setPhase('howto') }}
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
          {([['LEVEL',level],['SEQ',seqLen]] as [string,number][]).map(([lbl,val]) => (
            <div key={lbl} style={{ textAlign:'center' }}>
              <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>{lbl}</p>
              <p style={{ fontSize:26, fontWeight:900, color:'#1A1A2E', margin:0 }}>{val}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize:13, color:'#AAA', margin:0 }}>XP +{xp}</p>
        {scoreRef.current > 0 && scoreRef.current >= best && (
          <p style={{ fontSize:11, color:'#E9B213', fontWeight:800, margin:0, letterSpacing:'0.15em' }}>NEW BEST</p>
        )}
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <motion.button whileTap={{ scale:0.96 }} onClick={start}
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
    <motion.div
      animate={shake ? { x:[-8,8,-8,8,0] } : { x:0 }}
      transition={{ duration:0.35 }}
      style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', fontFamily:'system-ui,sans-serif', overflow:'hidden' }}>

      {/* HUD */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px 6px', flexShrink:0 }}>
        <button onClick={() => {
          if (isAliveRef.current) {
            isAliveRef.current = false
            clearTimeout(timerRef.current)
            if (scoreRef.current > 0) {
              addXp(Math.floor(scoreRef.current * 0.4))
              setHighScore('pattern-sync', scoreRef.current)
            }
          }
          onExit()
        }} style={{ background:'none', border:'none', color:'#CCC', fontSize:20, cursor:'pointer', padding:0 }}>←</button>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>SCORE</p>
          <p style={{ fontSize:22, fontWeight:900, color:'#1A1A2E', margin:0, lineHeight:1.1 }}>{score.toLocaleString()}</p>
        </div>
        <LivesHearts lives={lives} maxLives={3} color="#FF6B6B" />
      </div>

      {/* Phase label */}
      <div style={{ textAlign:'center', padding:'4px 0 0', flexShrink:0 }}>
        <p style={{ fontSize:10, fontWeight:800, letterSpacing:'0.18em', margin:0, transition:'color 0.3s',
          color: phase === 'memorize' ? '#C4B5FD' : '#93DCFF' }}>
          {phase === 'memorize' ? 'MEMORIZE' : 'FIND THE MISSING SHAPE'}
        </p>
      </div>

      {/* Play area */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        {sequence.map((item, i) => {
          const pos = positions[i] || {x:50,y:50}
          const isMissing = phase === 'find' && i === missingIdx
          return (
            <motion.div key={item.id}
              initial={{ scale:0, opacity:0 }}
              animate={isMissing ? { scale:0, opacity:0 } : { scale:1, opacity:1 }}
              transition={{ type:'spring', stiffness:280, damping:22, delay: phase==='memorize' ? i*0.09 : 0 }}
              style={{ position:'absolute', left:`${pos.x}%`, top:`${pos.y}%`, transform:'translate(-50%,-50%)' }}>
              <Shape shape={item.shape} color={item.color} size={80} />
            </motion.div>
          )
        })}

        {/* Missing slot */}
        <AnimatePresence>
          {phase === 'find' && correct && (
            <motion.div key="slot"
              initial={{ scale:0, opacity:0 }}
              animate={{ scale:1, opacity:1 }}
              exit={{ scale:0, opacity:0 }}
              style={{
                position:'absolute',
                left:`${positions[missingIdx]?.x ?? 50}%`,
                top:`${positions[missingIdx]?.y ?? 50}%`,
                transform:'translate(-50%,-50%)',
                width:84, height:84,
                border:'3px dashed rgba(0,0,0,0.14)',
                borderRadius:14,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
              <span style={{ fontSize:30, fontWeight:900, color:'rgba(0,0,0,0.18)' }}>?</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Score flash */}
        <AnimatePresence>
          {scoreFlash && (
            <motion.div key={scoreFlash + String(Date.now())}
              initial={{ y:0, opacity:1 }}
              animate={{ y:-70, opacity:0 }}
              transition={{ duration:0.7 }}
              style={{ position:'absolute', top:'38%', left:'50%', transform:'translateX(-50%)', fontSize:20, fontWeight:900, color:'#86EFAC', pointerEvents:'none', whiteSpace:'nowrap', zIndex:20 }}>
              CORRECT {scoreFlash}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Options */}
      <AnimatePresence>
        {phase === 'find' && (
          <motion.div
            initial={{ y:120, opacity:0 }}
            animate={{ y:0, opacity:1 }}
            exit={{ y:120, opacity:0 }}
            transition={{ type:'spring', stiffness:280, damping:28 }}
            style={{ flexShrink:0, padding:'0 16px 18px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {options.map(opt => {
                const key = `${opt.color}|${opt.shape}`
                const isCorrect = correct && opt.color === correct.color && opt.shape === correct.shape
                let border = '2px solid rgba(0,0,0,0.07)'
                if (tapped !== null) {
                  if (isCorrect)      border = '2px solid #86EFAC'
                  else if (tapped === key) border = '2px solid #FF6B6B'
                }
                return (
                  <motion.button key={opt.id}
                    whileTap={{ scale:0.92 }}
                    onClick={() => handlePick(opt)}
                    style={{
                      background:'white', border, borderRadius:16,
                      padding:'18px 0', display:'flex', alignItems:'center', justifyContent:'center',
                      cursor:'pointer', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', transition:'border-color 0.2s',
                      touchAction:'manipulation',
                    }}>
                    <Shape shape={opt.shape} color={opt.color} size={60} />
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
