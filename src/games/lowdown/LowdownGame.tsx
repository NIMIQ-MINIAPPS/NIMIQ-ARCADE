import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'

const BG = '#FFF8E8'
const COL_HI = '#80ED99'
const COL_LO = '#FFB5C2'

type Answer = 'higher' | 'lower'
interface Question { display: string; result: number; ref: number; answer: Answer }

function genQ(level: number): Question {
  let display: string, result: number

  if (level <= 5) {
    const a = 2 + Math.floor(Math.random() * (6 + level * 3))
    const b = 2 + Math.floor(Math.random() * (6 + level * 3))
    display = `${a} + ${b}`; result = a + b
  } else if (level <= 10) {
    const max = 20 + (level - 5) * 10
    const a = 15 + Math.floor(Math.random() * max)
    const b = 5  + Math.floor(Math.random() * Math.min(a - 5, max))
    display = `${a} - ${b}`; result = a - b
  } else if (level <= 15) {
    const fm = 4 + (level - 10) * 2
    const a = 2 + Math.floor(Math.random() * fm)
    const b = 2 + Math.floor(Math.random() * fm)
    display = `${a} × ${b}`; result = a * b
  } else if (level <= 20) {
    const neg = -(1 + Math.floor(Math.random() * 20))
    const pos = 5 + Math.floor(Math.random() * 40)
    display = `${neg} + ${pos}`; result = neg + pos
  } else if (level <= 30) {
    const a = 2 + Math.floor(Math.random() * 9)
    const b = 2 + Math.floor(Math.random() * 9)
    const c = 5 + Math.floor(Math.random() * 25)
    const op = Math.random() > 0.5 ? '+' : '-'
    display = `${a} × ${b} ${op} ${c}`; result = a * b + (op === '+' ? c : -c)
  } else if (level <= 50) {
    const a = 5 + Math.floor(Math.random() * 20)
    const b = 2 + Math.floor(Math.random() * 8)
    const c = 2 + Math.floor(Math.random() * 8)
    display = `${a} + ${b} × ${c}`; result = a + b * c
  } else {
    const a = 50 + Math.floor(Math.random() * 100)
    const b = 10 + Math.floor(Math.random() * 50)
    const c = 5  + Math.floor(Math.random() * 30)
    display = `${a} - ${b} + ${c}`; result = a - b + c
  }

  const range  = Math.max(2, Math.min(18, Math.floor(Math.abs(result) * 0.2) + 2))
  const sign   = Math.random() > 0.5 ? 1 : -1
  const offset = sign * (1 + Math.floor(Math.random() * range))
  const ref    = result + offset
  return { display, result, ref, answer: result > ref ? 'higher' : 'lower' }
}

function qTime(level: number): number {
  if (level <= 5)  return 5000
  if (level <= 10) return 4000
  if (level <= 15) return 3000
  if (level <= 25) return 2500
  if (level <= 35) return 2000
  return 1500
}

let _ac: AudioContext | null = null
function snd(type: 'ok' | 'no' | 'up') {
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const n = (f: number, at: number, d: number, v: number, o: OscillatorType = 'sine') => {
      const osc = c.createOscillator(), g = c.createGain()
      osc.type = o; osc.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.001, at + d)
      osc.connect(g); g.connect(c.destination); osc.start(at); osc.stop(at + d)
    }
    if (type === 'ok') [550,770].forEach((f,i)=>n(f,t+i*0.06,0.12,0.09))
    if (type === 'no') n(200,t,0.18,0.12,'sawtooth')
    if (type === 'up') [660,880,1100,1320].forEach((f,i)=>n(f,t+i*0.07,0.13,0.1))
  } catch {/**/}
}

export default function LowdownGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()

  const [phase,    setPhase]    = useState<'start'|'howto'|'play'|'over'>('start')
  const [question, setQuestion] = useState<Question>(() => genQ(1))
  const [score,    setScore]    = useState(0)
  const [streak,   setStreak]   = useState(0)
  const [level,    setLevel]    = useState(1)
  const [clock,    setClock]    = useState(30)
  const [barPct,   setBarPct]   = useState(100)
  const [fbText,   setFbText]   = useState<string|null>(null)
  const [fbOk,     setFbOk]     = useState(true)
  const [flash,    setFlash]    = useState<string|null>(null)

  const scoreRef  = useRef(0), levelRef = useRef(1), streakRef = useRef(0)
  const clockRef  = useRef(30), qRef = useRef<Question>(genQ(1))
  const alive     = useRef(false), locked = useRef(false)
  const gId       = useRef<any>(0), bId = useRef<any>(0)

  const doEnd = useCallback(() => {
    alive.current = false
    clearInterval(gId.current); clearInterval(bId.current)
    addXp(Math.floor(scoreRef.current * 0.4))
    setHighScore('lowdown', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const startBar = useCallback((lvl: number) => {
    clearInterval(bId.current)
    const qt = qTime(lvl), start = Date.now()
    setBarPct(100)
    bId.current = setInterval(() => {
      if (!alive.current) { clearInterval(bId.current); return }
      const pct = Math.max(0, 100 - ((Date.now() - start) / qt) * 100)
      setBarPct(pct)
      if (pct <= 0) {
        clearInterval(bId.current)
        if (locked.current) return
        locked.current = true
        snd('no')
        streakRef.current = 0; setStreak(0)
        setFbText('TOO SLOW'); setFbOk(false)
        clockRef.current = Math.max(0, clockRef.current - 3)
        if (clockRef.current <= 0) { doEnd(); return }
        setTimeout(() => {
          if (!alive.current) return
          setFbText(null)
          const q = genQ(levelRef.current)
          qRef.current = q; setQuestion(q)
          locked.current = false
          startBar(levelRef.current)
        }, 500)
      }
    }, 30)
  }, [doEnd])

  const startGame = useCallback(() => {
    alive.current = true; locked.current = false
    scoreRef.current = 0; levelRef.current = 1; streakRef.current = 0; clockRef.current = 30
    setScore(0); setLevel(1); setStreak(0); setClock(30)
    setFbText(null); setFlash(null)
    const q = genQ(1); qRef.current = q; setQuestion(q)
    setPhase('play')
    clearInterval(gId.current)
    gId.current = setInterval(() => {
      if (!alive.current) { clearInterval(gId.current); return }
      clockRef.current -= 1/60
      if (clockRef.current <= 0) doEnd()
      else setClock(Math.ceil(clockRef.current))
    }, 16)
    startBar(1)
  }, [doEnd, startBar])

  const handleAnswer = useCallback((choice: Answer) => {
    if (!alive.current || locked.current) return
    locked.current = true
    clearInterval(bId.current)
    const q = qRef.current
    if (choice === q.answer) {
      snd('ok')
      streakRef.current++
      const pts = Math.round((10 + levelRef.current * 2) + Math.min(streakRef.current, 15) * 5)
      scoreRef.current += pts; setScore(scoreRef.current)
      setStreak(streakRef.current)
      setFlash(`+${pts}`)
      setTimeout(() => setFlash(null), 800)
      clockRef.current = Math.min(clockRef.current + 2.5, 99)
      if (streakRef.current % 5 === 0) {
        levelRef.current++; setLevel(levelRef.current); snd('up')
      }
      setFbText('CORRECT'); setFbOk(true)
      setTimeout(() => {
        if (!alive.current) return
        setFbText(null)
        const nq = genQ(levelRef.current); qRef.current = nq; setQuestion(nq)
        locked.current = false; startBar(levelRef.current)
      }, 250)
    } else {
      snd('no')
      streakRef.current = 0; setStreak(0)
      setFbText(`WRONG — ${q.result}`); setFbOk(false)
      clockRef.current = Math.max(0, clockRef.current - 3)
      if (clockRef.current <= 0) { doEnd(); return }
      setTimeout(() => {
        if (!alive.current) return
        setFbText(null)
        const nq = genQ(levelRef.current); qRef.current = nq; setQuestion(nq)
        locked.current = false; startBar(levelRef.current)
      }, 600)
    }
  }, [doEnd, startBar])

  useEffect(() => () => { alive.current = false; clearInterval(gId.current); clearInterval(bId.current) }, [])

  const best = highScores['lowdown'] ?? 0

  // ── HOW TO PLAY ──────────────────────────────────────────────────────────
  if (phase === 'howto') return (
    <div style={{ width:'100%',height:'100%',position:'relative' }}>
      <HowToPlayOverlay
        bg={BG}
        accent="#1A1A2E"
        bullets={TUTORIALS['lowdown']}
        onStart={() => { markTutorialSeen('lowdown'); startGame() }}
      />
    </div>
  )

  // ── START ─────────────────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ width:'100%',height:'100%',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,fontFamily:'system-ui,sans-serif',position:'relative' }}>
      <button onClick={onExit} style={{ position:'absolute',top:20,left:20,background:'none',border:'none',color:'#BBB',fontSize:22,cursor:'pointer' }}>←</button>
      {/* Illustration: floating cards */}
      <div style={{ position:'relative',width:260,height:120 }}>
        {[{ t:'14 + 27',rot:-8,x:0,y:10 },{ t:'83 - 19',rot:4,x:80,y:0 },{ t:'6 × 8',rot:-3,x:160,y:15 }].map((c,i)=>(
          <div key={i} style={{ position:'absolute',left:c.x,top:c.y,transform:`rotate(${c.rot}deg)`,
            width:80,height:52,background:'white',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 4px 16px rgba(0,0,0,0.08)',fontSize:13,fontWeight:900,color:'#1A1A2E' }}>
            {c.t}
          </div>
        ))}
      </div>
      <div style={{ textAlign:'center' }}>
        <h1 style={{ fontSize:28,fontWeight:900,color:'#1A1A2E',margin:'0 0 8px',letterSpacing:'0.05em' }}>LOWDOWN</h1>
        <p style={{ color:'#BBB',fontSize:11,fontWeight:700,letterSpacing:'0.14em',margin:0 }}>HIGHER OR LOWER?</p>
      </div>
      <div style={{ display:'flex',gap:10 }}>
        <div style={{ padding:'10px 22px',background:COL_HI,borderRadius:12,fontWeight:900,fontSize:13,color:'#1A1A2E' }}>HIGHER</div>
        <div style={{ padding:'10px 22px',background:COL_LO,borderRadius:12,fontWeight:900,fontSize:13,color:'#1A1A2E' }}>LOWER</div>
      </div>
      <motion.button whileTap={{ scale:0.96 }} onClick={() => { if (hasSeenTutorial('lowdown')) startGame(); else setPhase('howto') }}
        style={{ background:'#1A1A2E',color:BG,border:'none',borderRadius:16,padding:'16px 64px',fontSize:18,fontWeight:900,cursor:'pointer',letterSpacing:'0.12em' }}>
        PLAY
      </motion.button>
      {best>0 && <p style={{ color:'#BBB',fontSize:13,margin:0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  if (phase === 'over') return (
    <div style={{ width:'100%',height:'100%',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,fontFamily:'system-ui,sans-serif' }}>
      <p style={{ fontSize:12,fontWeight:800,color:'#FF6B6B',letterSpacing:'0.22em',margin:0 }}>TIME'S UP</p>
      <p style={{ fontSize:52,fontWeight:900,color:'#1A1A2E',margin:0,lineHeight:1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display:'flex',gap:36 }}>
        {([['LEVEL',levelRef.current],['STREAK',streakRef.current]] as [string,number][]).map(([l,v])=>(
          <div key={l} style={{ textAlign:'center' }}>
            <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#BBB',margin:0 }}>{l}</p>
            <p style={{ fontSize:26,fontWeight:900,color:'#1A1A2E',margin:0 }}>{v}</p>
          </div>
        ))}
      </div>
      <p style={{ fontSize:13,color:'#AAA',margin:0 }}>XP +{Math.floor(scoreRef.current*0.4)}</p>
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

      {/* Timer bar */}
      <div style={{ height:3,background:'rgba(0,0,0,0.06)',flexShrink:0 }}>
        <div style={{ height:'100%',background: clock<=8?'#FF6B6B':COL_HI,
          width:`${Math.min(100,(clockRef.current/30)*100)}%`,transition:'background 0.3s' }}/>
      </div>

      {/* HUD */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 20px 4px',flexShrink:0 }}>
        <button onClick={()=>{
          if (alive.current) {
            alive.current = false
            clearInterval(gId.current); clearInterval(bId.current)
            if (scoreRef.current > 0) {
              addXp(Math.floor(scoreRef.current * 0.4))
              setHighScore('lowdown', scoreRef.current)
            }
          }
          onExit()
        }}
          style={{ background:'none',border:'none',color:'#CCC',fontSize:20,cursor:'pointer',padding:0 }}>←</button>
        <div style={{ display:'flex',gap:20,alignItems:'center' }}>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#BBB',margin:0 }}>TIME</p>
            <p style={{ fontSize:18,fontWeight:900,color:clock<=8?'#FF6B6B':'#1A1A2E',margin:0,lineHeight:1.1 }}>{clock}s</p>
          </div>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#BBB',margin:0 }}>SCORE</p>
            <p style={{ fontSize:18,fontWeight:900,color:'#1A1A2E',margin:0,lineHeight:1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9,fontWeight:700,letterSpacing:'0.1em',color:'#BBB',margin:0 }}>LV</p>
          <p style={{ fontSize:18,fontWeight:900,color:'#1A1A2E',margin:0 }}>{level}</p>
        </div>
      </div>

      {/* Streak */}
      <div style={{ textAlign:'center',height:18,flexShrink:0 }}>
        <AnimatePresence>
          {streak > 1 && (
            <motion.p key={streak} initial={{ scale:0.7,opacity:0 }} animate={{ scale:1,opacity:1 }} exit={{ opacity:0 }}
              style={{ fontSize:10,fontWeight:800,letterSpacing:'0.18em',margin:0,color:COL_HI }}>
              STREAK ×{streak}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Question card */}
      <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:'0 24px',position:'relative' }}>

        {/* Score flash */}
        <AnimatePresence>
          {flash && (
            <motion.p key={flash+Date.now()} initial={{ y:0,opacity:1 }} animate={{ y:-40,opacity:0 }}
              transition={{ duration:0.7 }}
              style={{ position:'absolute',top:'15%',fontSize:28,fontWeight:900,color:COL_HI,
                filter:'drop-shadow(0 2px 8px rgba(128,237,153,0.5))',pointerEvents:'none',margin:0 }}>
              {flash}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Main card */}
        <motion.div key={question.display}
          initial={{ scale:0.9,opacity:0,y:12 }} animate={{ scale:1,opacity:1,y:0 }}
          style={{ width:'100%',maxWidth:340,background:'white',borderRadius:24,
            boxShadow:'0 8px 32px rgba(0,0,0,0.08)',padding:'32px 24px',textAlign:'center' }}>
          <p style={{ fontSize:44,fontWeight:900,color:'#1A1A2E',margin:'0 0 16px',letterSpacing:'0.02em',lineHeight:1 }}>
            {question.display}
          </p>
          {/* Per-question bar */}
          <div style={{ height:4,background:'rgba(0,0,0,0.06)',borderRadius:2,overflow:'hidden',marginBottom:16 }}>
            <div style={{ height:'100%',background:barPct>30?'#C4B5FD':'#FF6B6B',
              width:`${barPct}%`,transition:'background 0.3s' }}/>
          </div>
          <p style={{ fontSize:14,color:'#AAA',margin:0,fontWeight:600 }}>
            vs <span style={{ fontSize:22,fontWeight:900,color:'#1A1A2E' }}>{question.ref}</span>
          </p>
        </motion.div>

        {/* Feedback */}
        <AnimatePresence>
          {fbText && (
            <motion.p key={fbText} initial={{ scale:0.8,opacity:0 }} animate={{ scale:1,opacity:1 }} exit={{ opacity:0 }}
              style={{ fontSize:12,fontWeight:800,letterSpacing:'0.2em',margin:0,
                color: fbOk ? COL_HI : '#FF6B6B' }}>
              {fbText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Buttons */}
      <div style={{ display:'flex',gap:12,padding:'12px 20px',paddingBottom:'max(20px, env(safe-area-inset-bottom, 20px))',flexShrink:0 }}>
        <motion.button whileTap={{ scale:0.95 }} onPointerDown={() => handleAnswer('higher')}
          style={{ flex:1,height:72,background:COL_HI,border:'none',borderRadius:20,
            fontSize:18,fontWeight:900,color:'#1A1A2E',cursor:'pointer',touchAction:'manipulation',
            letterSpacing:'0.08em',boxShadow:'0 4px 16px rgba(128,237,153,0.3)',
            display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
          HIGHER <ArrowUp size={18} strokeWidth={3} />
        </motion.button>
        <motion.button whileTap={{ scale:0.95 }} onPointerDown={() => handleAnswer('lower')}
          style={{ flex:1,height:72,background:COL_LO,border:'none',borderRadius:20,
            fontSize:18,fontWeight:900,color:'#1A1A2E',cursor:'pointer',touchAction:'manipulation',
            letterSpacing:'0.08em',boxShadow:'0 4px 16px rgba(255,181,194,0.3)',
            display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
          LOWER <ArrowDown size={18} strokeWidth={3} />
        </motion.button>
      </div>
    </div>
  )
}
