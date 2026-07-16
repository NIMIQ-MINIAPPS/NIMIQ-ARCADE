import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'

const BG = '#FFF9E8'

// Color palettes per difficulty tier
const TIER1_COLORS = ['#FF6B6B','#4DA8FF','#86EFAC','#FCD34D','#C4B5FD','#FDBA74','#F9A8D4','#67E8F9']
const TIER2_COLORS = [
  ['#4DA8FF','#93DCFF'],['#FF6B6B','#FCA5A5'],['#86EFAC','#B3F0D4'],
  ['#C4B5FD','#E9D5FF'],['#FCD34D','#FEF08A'],['#FDBA74','#FED7AA'],
]
const TIER3_COLOR = '#4DA8FF'
const TIER4_PAIRS = [
  ['#4DA8FF','#67C8FF'],['#86EFAC','#A7F3C2'],['#C4B5FD','#D8CAFF'],
  ['#FCA5A5','#FDBBBB'],['#FCD34D','#FDE47A'],['#FDBA74','#FEC99A'],
]

const SYMBOLS_EASY   = ['★','●','▲','■','◎','⬡','◆','◇']
const SYMBOLS_HARD   = ['◆','◇','⬡','⬢','⊕','⊗','◉','◈']

function diffTier(round: number) {
  if (round <= 3)  return 1  // distinct colors, easy symbols
  if (round <= 6)  return 2  // similar colors
  if (round <= 9)  return 3  // same color, different symbols
  return 4                    // similar color AND similar symbols
}

type CardDef = { symbol: string; color: string }

function genPairs(round: number): CardDef[] {
  const tier  = diffTier(round)
  const count = Math.min(3 + round, 12)
  const pairs: CardDef[] = []

  if (tier === 1) {
    const cols = [...TIER1_COLORS].sort(() => Math.random()-0.5).slice(0, count)
    const syms = [...SYMBOLS_EASY].sort(() => Math.random()-0.5)
    for (let i = 0; i < count; i++) pairs.push({ symbol: syms[i % syms.length], color: cols[i] })
  } else if (tier === 2) {
    const groups = [...TIER2_COLORS].sort(() => Math.random()-0.5).slice(0, count)
    const syms   = [...SYMBOLS_EASY].sort(() => Math.random()-0.5)
    for (let i = 0; i < count; i++) {
      const [c1, c2] = groups[i % groups.length]
      pairs.push({ symbol: syms[i % syms.length], color: i % 2 === 0 ? c1 : c2 })
    }
    // Ensure at least 2 pairs from same group (different shade = the challenge)
    for (let i = 0; i < Math.min(count, groups.length); i++) {
      pairs[i] = { symbol: syms[i % syms.length], color: groups[i][0] }
    }
  } else if (tier === 3) {
    const syms = [...SYMBOLS_HARD].sort(() => Math.random()-0.5).slice(0, count)
    for (let i = 0; i < count; i++) pairs.push({ symbol: syms[i], color: TIER3_COLOR })
  } else {
    const pairDefs = [...TIER4_PAIRS].sort(() => Math.random()-0.5).slice(0, Math.min(count, TIER4_PAIRS.length))
    const syms = [...SYMBOLS_HARD].sort(() => Math.random()-0.5)
    for (let i = 0; i < count; i++) {
      const [c1, c2] = pairDefs[i % pairDefs.length]
      pairs.push({ symbol: syms[i % syms.length], color: i % 2 === 0 ? c1 : c2 })
    }
  }
  return pairs
}

type Card = { id: number; symbol: string; color: string; matched: boolean; pairKey: string }

function buildCards(round: number): Card[] {
  const pairs = genPairs(round)
  const cards: Card[] = []
  pairs.forEach((def, i) => {
    const pairKey = `${def.symbol}__${def.color}__${i}`
    cards.push({ id: cards.length, symbol: def.symbol, color: def.color, matched: false, pairKey })
    cards.push({ id: cards.length, symbol: def.symbol, color: def.color, matched: false, pairKey })
  })
  return cards.sort(() => Math.random() - 0.5)
}

function shuffleUnmatched(cards: Card[]): Card[] {
  const positions: number[] = []
  const unmatched: Card[] = []
  cards.forEach((c, i) => { if (!c.matched) { positions.push(i); unmatched.push(c) } })
  unmatched.sort(() => Math.random() - 0.5)
  const result = [...cards]
  positions.forEach((pos, i) => { result[pos] = unmatched[i] })
  return result
}

function shuffleInterval(round: number): number | null {
  if (round < 4)  return null
  if (round < 7)  return 8000
  if (round < 10) return 6000
  return 4000
}

let _ac: AudioContext | null = null
function snd(type: 'flip' | 'match' | 'wrong' | 'round' | 'shuffle' | 'doom') {
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const note = (f: number, at: number, dur: number, vol: number, osc: OscillatorType = 'sine') => {
      const o = c.createOscillator(), g = c.createGain()
      o.type = osc; o.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur)
      o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur)
    }
    if (type === 'flip')    note(440, t, 0.06, 0.05, 'triangle')
    if (type === 'match')   [550,770].forEach((f,i) => note(f, t+i*0.07, 0.13, 0.08))
    if (type === 'wrong')   note(220, t, 0.15, 0.1, 'sawtooth')
    if (type === 'round')   [660,880,1100,1320].forEach((f,i) => note(f, t+i*0.06, 0.14, 0.09))
    if (type === 'shuffle') [400,350].forEach((f,i) => note(f, t+i*0.06, 0.1, 0.07, 'square'))
    if (type === 'doom')    { note(180, t, 0.4, 0.18, 'sawtooth'); note(130, t+0.3, 0.4, 0.14, 'square') }
  } catch { /**/ }
}

export default function MemoryGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()

  const [phase,     setPhase]     = useState<'start'|'howto'|'play'|'over'>('start')
  const [round,     setRound]     = useState(1)
  const [score,     setScore]     = useState(0)
  const [cards,     setCards]     = useState<Card[]>([])
  const [flipped,   setFlipped]   = useState<number[]>([])
  const [timeLeft,  setTimeLeft]  = useState(30)
  const [streak,    setStreak]    = useState(0)
  const [flash,     setFlash]     = useState<string|null>(null)
  const [shuffling, setShuffling] = useState(false)

  const scoreRef  = useRef(0), roundRef = useRef(1), streakRef = useRef(0)
  const lockRef   = useRef(false)
  const activeRef = useRef(false)
  const timerRef  = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const shuffRef  = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)

  const endGame = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    clearInterval(timerRef.current); clearInterval(shuffRef.current)
    snd('doom')
    addXp(Math.floor(scoreRef.current * 0.35))
    setHighScore('memory', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const handleExit = useCallback(() => {
    if (activeRef.current) {
      activeRef.current = false
      clearInterval(timerRef.current); clearInterval(shuffRef.current)
      if (scoreRef.current > 0) {
        addXp(Math.floor(scoreRef.current * 0.35))
        setHighScore('memory', scoreRef.current)
      }
    }
    onExit()
  }, [addXp, setHighScore, onExit])

  const startRound = useCallback((r: number) => {
    const newCards = buildCards(r)
    const secs = Math.max(10, Math.round(30 - r * 2.5))
    roundRef.current = r
    clearInterval(timerRef.current); clearInterval(shuffRef.current)
    setCards(newCards); setFlipped([]); setTimeLeft(secs); lockRef.current = false

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); endGame(); return 0 }
        return prev - 1
      })
    }, 1000)

    const si = shuffleInterval(r)
    if (si) {
      shuffRef.current = setInterval(() => {
        snd('shuffle')
        setShuffling(true)
        setFlipped([])
        lockRef.current = true
        setTimeout(() => {
          setCards(prev => shuffleUnmatched(prev))
          setShuffling(false)
          lockRef.current = false
        }, 500)
      }, si)
    }
  }, [endGame])

  const startGame = useCallback(() => {
    scoreRef.current = 0; roundRef.current = 1; streakRef.current = 0
    activeRef.current = true
    setScore(0); setRound(1); setStreak(0); setFlash(null)
    startRound(1)
    setPhase('play')
  }, [startRound])

  const handleFlip = useCallback((cardId: number) => {
    if (lockRef.current) return
    if (flipped.includes(cardId)) return
    if (cards.find(c => c.id === cardId)?.matched) return
    if (flipped.length >= 2) return

    snd('flip')
    const newFlipped = [...flipped, cardId]
    setFlipped(newFlipped)

    if (newFlipped.length === 2) {
      lockRef.current = true
      const [a, b] = newFlipped.map(id => cards.find(c => c.id === id)!)
      if (a.pairKey === b.pairKey) {
        // Match!
        snd('match')
        streakRef.current++; setStreak(streakRef.current)
        const bonus = Math.floor(50 * (1 + 0.1 * (streakRef.current - 1)))
        scoreRef.current += bonus; setScore(scoreRef.current)
        setFlash(`+${bonus}`)
        setTimeout(() => setFlash(null), 800)

        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === a.id || c.id === b.id ? { ...c, matched: true } : c
          ))
          setFlipped([])
          lockRef.current = false

          // Check if round complete
          const remaining = cards.filter(c => !c.matched && c.id !== a.id && c.id !== b.id)
          if (remaining.length === 0) {
            clearInterval(timerRef.current); clearInterval(shuffRef.current)
            snd('round')
            const nextRound = roundRef.current + 1
            setRound(nextRound)
            setTimeout(() => startRound(nextRound), 800)
          }
        }, 400)
      } else {
        // No match
        snd('wrong')
        streakRef.current = 0; setStreak(0)
        setTimeout(() => { setFlipped([]); lockRef.current = false }, 900)
      }
    }
  }, [flipped, cards, startRound])

  useEffect(() => () => { clearInterval(timerRef.current); clearInterval(shuffRef.current) }, [])

  const best = highScores['memory'] ?? 0
  const tier = diffTier(round)
  const cols = cards.length <= 8 ? 4 : 4

  // ── START ─────────────────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, fontFamily:'system-ui,sans-serif', position:'relative' }}>
        <button onClick={onExit} style={{ position:'absolute', top:20, left:20, background:'none', border:'none', color:'#BBB', fontSize:22, cursor:'pointer' }}>←</button>
        {/* Illustration */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,44px)', gap:8 }}>
          {['#FF6B6B','#4DA8FF','#86EFAC','#FCD34D','#C4B5FD','#FDBA74','#FF6B6B','#4DA8FF'].map((col, i) => (
            <div key={i} style={{ width:44, height:56, borderRadius:10, background: i<4?col:'white',
              border:`1.5px solid ${i<4?'transparent':'rgba(0,0,0,0.08)'}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:20, boxShadow:'0 2px 8px rgba(0,0,0,0.07)',
              color: i<4?'white':'rgba(0,0,0,0.12)' }}>
              {i<4?['★','●','▲','■'][i]:'⬡'}
            </div>
          ))}
        </div>
        <div style={{ textAlign:'center' }}>
          <h1 style={{ fontSize:28, fontWeight:900, color:'#1A1A2E', margin:'0 0 8px', letterSpacing:'0.05em' }}>MEMORY RUSH</h1>
          <p style={{ color:'#BBB', fontSize:11, fontWeight:700, letterSpacing:'0.14em', margin:0 }}>MATCH COLORS & SYMBOLS</p>
        </div>
        <motion.button whileTap={{ scale:0.96 }} onClick={() => { if (hasSeenTutorial('memory')) startGame(); else setPhase('howto') }}
          style={{ background:'#1A1A2E', color:BG, border:'none', borderRadius:16, padding:'16px 64px', fontSize:18, fontWeight:900, cursor:'pointer', letterSpacing:'0.12em' }}>
          PLAY
        </motion.button>
        {best > 0 && <p style={{ color:'#BBB', fontSize:13, margin:0 }}>BEST: {best.toLocaleString()}</p>}
      </div>
    )
  }

  // ── HOW TO PLAY ───────────────────────────────────────────────────────────
  if (phase === 'howto') {
    return (
      <div style={{ width:'100%', height:'100%', position:'relative', fontFamily:'system-ui,sans-serif' }}>
        <HowToPlayOverlay bg={BG} accent="#1A1A2E" bullets={TUTORIALS['memory']}
          onStart={() => { markTutorialSeen('memory'); startGame() }} />
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
          {([['ROUND',round],['STREAK',streak]] as [string,number][]).map(([lbl,val]) => (
            <div key={lbl} style={{ textAlign:'center' }}>
              <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>{lbl}</p>
              <p style={{ fontSize:26, fontWeight:900, color:'#1A1A2E', margin:0 }}>{val}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize:13, color:'#AAA', margin:0 }}>XP +{Math.floor(scoreRef.current * 0.35)}</p>
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
  const tierLabels = ['','DISTINCT COLORS','SIMILAR COLORS','SAME COLOR','VERY SIMILAR']

  return (
    <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', fontFamily:'system-ui,sans-serif', overflow:'hidden' }}>

      {/* Timer bar */}
      <div style={{ height:3, background:'rgba(0,0,0,0.06)', flexShrink:0 }}>
        <motion.div style={{ height:'100%', background: timeLeft <= 5 ? '#FF6B6B' : '#C4B5FD',
          width:`${(timeLeft / Math.max(10, Math.round(30 - round * 2.5))) * 100}%`, transition:'background 0.3s' }}
          animate={{ width:`${(timeLeft / Math.max(10, Math.round(30 - round * 2.5))) * 100}%` }}
          transition={{ duration:0.5 }}
        />
      </div>

      {/* HUD */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px 4px', flexShrink:0 }}>
        <button onClick={handleExit} style={{ background:'none', border:'none', color:'#CCC', fontSize:20, cursor:'pointer', padding:0 }}>←</button>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>SCORE</p>
          <p style={{ fontSize:20, fontWeight:900, color:'#1A1A2E', margin:0, lineHeight:1.1 }}>{score.toLocaleString()}</p>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'#BBB', margin:0 }}>TIME</p>
            <p style={{ fontSize:16, fontWeight:900, color: timeLeft<=5?'#FF6B6B':'#1A1A2E', margin:0 }}>{timeLeft}s</p>
          </div>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'#BBB', margin:0 }}>ROUND</p>
            <p style={{ fontSize:16, fontWeight:900, color:'#1A1A2E', margin:0 }}>{round}</p>
          </div>
        </div>
      </div>

      {/* Tier + streak */}
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12, padding:'2px 0 6px', flexShrink:0 }}>
        <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#C4B5FD', margin:0 }}>
          {tierLabels[tier]}
        </p>
        {streak > 1 && (
          <p style={{ fontSize:9, fontWeight:800, color:'#FCD34D', margin:0, letterSpacing:'0.1em' }}>
            STREAK ×{streak}
          </p>
        )}
      </div>

      {/* Cards grid */}
      <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', padding:'0 12px', position:'relative' }}>

        {/* Score flash */}
        <AnimatePresence>
          {flash && (
            <motion.div key={flash + Date.now()}
              initial={{ scale:0.7, opacity:0, y:0 }} animate={{ scale:1, opacity:1, y:-20 }} exit={{ opacity:0, scale:1.2 }}
              style={{ position:'absolute', top:'30%', zIndex:20, fontSize:28, fontWeight:900, color:'#86EFAC',
                filter:'drop-shadow(0 2px 8px rgba(134,239,172,0.5))', pointerEvents:'none' }}>
              {flash}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shuffle overlay */}
        <AnimatePresence>
          {shuffling && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              style={{ position:'absolute', inset:0, zIndex:10, display:'flex', alignItems:'center', justifyContent:'center',
                background:'rgba(255,249,232,0.6)', backdropFilter:'blur(2px)' }}>
              <p style={{ fontSize:14, fontWeight:900, color:'#C4B5FD', letterSpacing:'0.2em' }}>SHUFFLE</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:8, width:'100%', maxWidth:340 }}>
          {cards.map(card => {
            const isFlipped  = flipped.includes(card.id) || card.matched
            const cardHeight = cards.length <= 8 ? 72 : cards.length <= 16 ? 60 : 52
            return (
              <motion.button key={card.id}
                whileTap={{ scale:0.92 }}
                onClick={() => handleFlip(card.id)}
                style={{
                  height:cardHeight, borderRadius:10,
                  background: isFlipped ? card.color : 'white',
                  border:`1.5px solid ${isFlipped ? 'transparent' : 'rgba(0,0,0,0.08)'}`,
                  boxShadow:'0 2px 8px rgba(0,0,0,0.07)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize: cardHeight * 0.42, cursor:'pointer', touchAction:'manipulation',
                  opacity: card.matched ? 0.45 : 1,
                  transition:'background 0.18s, opacity 0.3s',
                  color: isFlipped ? 'white' : 'rgba(0,0,0,0.12)',
                }}>
                {isFlipped ? card.symbol : '⬡'}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
