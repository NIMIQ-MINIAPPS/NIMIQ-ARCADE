import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'

const BG = '#FFF9E8'

type Phase = 'start' | 'memorize' | 'navigate' | 'over'

function gridSize(lvl: number)   { return lvl <= 4 ? 5 : lvl <= 7 ? 6 : 7 }
function mineCount(lvl: number, sz: number) { return Math.min(2 + lvl, Math.floor(sz * sz * 0.35)) }
function decoyCount(lvl: number) { return lvl < 4 ? 0 : lvl < 7 ? 1 : lvl < 10 ? 2 : 3 }
function memTime(lvl: number)    { return Math.max(1200, 4000 - lvl * 180) }

function mineColor(lvl: number): string {
  if (lvl <= 3)  return '#FF6B6B'
  if (lvl <= 6)  return '#FF9F43'
  if (lvl <= 9)  return '#FCD34D'
  if (lvl <= 12) return '#C3E6C3'
  return '#E8D5B0'
}
function decoyColor(lvl: number): string {
  if (lvl <= 6)  return '#FDBA74'
  if (lvl <= 9)  return '#FEF08A'
  return '#D4F0D4'
}

function genBoard(size: number, nMines: number, nDecoys: number) {
  const total = size * size
  const start = 0, end = total - 1
  const mines = new Set<number>()
  while (mines.size < nMines) {
    const i = Math.floor(Math.random() * total)
    if (i !== start && i !== end) mines.add(i)
  }
  const decoys = new Set<number>()
  while (decoys.size < nDecoys) {
    const i = Math.floor(Math.random() * total)
    if (i !== start && i !== end && !mines.has(i)) decoys.add(i)
  }
  return { size, mines, decoys, start, end }
}

let _ac: AudioContext | null = null
function snd(type: 'step' | 'hit' | 'clear' | 'doom') {
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const note = (f: number, at: number, dur: number, vol: number, osc: OscillatorType = 'sine') => {
      const o = c.createOscillator(), g = c.createGain()
      o.type = osc; o.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur)
      o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur)
    }
    if (type === 'step')  note(440, t, 0.04, 0.04, 'triangle')
    if (type === 'hit')   note(200, t, 0.2, 0.2, 'sawtooth')
    if (type === 'clear') [660,880,1100].forEach((f,i) => note(f, t+i*0.06, 0.13, 0.09))
    if (type === 'doom')  { note(180, t, 0.4, 0.18, 'sawtooth'); note(130, t+0.3, 0.4, 0.14, 'square') }
  } catch { /**/ }
}

export default function PerilousPathGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()

  const [phase,   setPhase]   = useState<Phase>('start')
  const [level,   setLevel]   = useState(1)
  const [score,   setScore]   = useState(0)
  const [lives,   setLives]   = useState(3)
  const [combo,   setCombo]   = useState(1)
  const [board,   setBoard]   = useState(() => genBoard(5, 3, 0))
  const [path,    setPath]    = useState<number[]>([0])
  const [hitMine, setHitMine] = useState<number | null>(null)
  const [memPct,  setMemPct]  = useState(100)

  const scoreRef = useRef(0), livesRef = useRef(3), levelRef = useRef(1), comboRef = useRef(1)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)
  const barRef   = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)

  const setupLevel = useCallback((lvl: number) => {
    const sz = gridSize(lvl)
    const b  = genBoard(sz, mineCount(lvl, sz), decoyCount(lvl))
    const mt = memTime(lvl)
    clearTimeout(timerRef.current); clearInterval(barRef.current)
    setBoard(b); setPath([b.start]); setHitMine(null); setPhase('memorize'); setMemPct(100)
    const start = Date.now()
    barRef.current = setInterval(() => {
      setMemPct(Math.max(0, 100 - ((Date.now() - start) / mt) * 100))
    }, 50)
    timerRef.current = setTimeout(() => {
      clearInterval(barRef.current); setMemPct(0); setPhase('navigate')
    }, mt)
  }, [])

  const startGame = useCallback(() => {
    scoreRef.current = 0; livesRef.current = 3; levelRef.current = 1; comboRef.current = 1
    setScore(0); setLives(3); setLevel(1); setCombo(1)
    setupLevel(1)
  }, [setupLevel])

  const handleTap = useCallback((idx: number) => {
    if (phase !== 'navigate') return
    const last = path[path.length - 1]
    const { size, mines, end } = board
    const lr = Math.floor(last / size), lc = last % size
    const tr = Math.floor(idx / size),  tc = idx % size
    if (Math.abs(lr - tr) + Math.abs(lc - tc) !== 1) return
    if (path.includes(idx)) return

    if (mines.has(idx)) {
      snd('hit')
      setHitMine(idx); setPath(p => [...p, idx])
      livesRef.current--; setLives(livesRef.current)
      comboRef.current = 1; setCombo(1)
      if (livesRef.current <= 0) {
        snd('doom')
        addXp(Math.floor(scoreRef.current * 0.4))
        setHighScore('perilous-path', scoreRef.current)
        setPhase('over')
      } else {
        setTimeout(() => setupLevel(levelRef.current), 900)
      }
      return
    }

    snd('step')
    const newPath = [...path, idx]
    setPath(newPath)

    if (idx === end) {
      snd('clear')
      const base = board.size * 20 + levelRef.current * 10
      const pts  = base * comboRef.current
      scoreRef.current += pts; setScore(scoreRef.current)
      comboRef.current++;      setCombo(comboRef.current)
      levelRef.current++;      setLevel(levelRef.current)
      setTimeout(() => setupLevel(levelRef.current), 700)
    }
  }, [phase, path, board, setupLevel, addXp, setHighScore])

  useEffect(() => () => { clearTimeout(timerRef.current); clearInterval(barRef.current) }, [])

  const best = highScores['perilous-path'] ?? 0
  const cell = Math.min(52, (310 - (board.size - 1) * 5) / board.size)
  const mc   = mineColor(level)
  const dc   = decoyColor(level)

  // ── START ─────────────────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, fontFamily:'system-ui,sans-serif', position:'relative' }}>
        <button onClick={onExit} style={{ position:'absolute', top:20, left:20, background:'none', border:'none', color:'#BBB', fontSize:22, cursor:'pointer' }}>←</button>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,32px)', gap:4 }}>
          {Array.from({length:25},(_,i) => {
            const isMine  = [3,7,11,18].includes(i)
            const isStart = i===0, isEnd = i===24
            return (
              <div key={i} style={{ width:32, height:32, borderRadius:7,
                background: isStart ? '#86EFAC' : isEnd ? '#93DCFF' : isMine ? '#FF6B6B22' : 'white',
                border: isMine ? '2px solid #FF6B6B' : '1.5px solid rgba(0,0,0,0.07)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:900, color:'#1A1A2E',
                boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                {isStart ? 'A' : isEnd ? 'B' : isMine ? '×' : ''}
              </div>
            )
          })}
        </div>
        <div style={{ textAlign:'center' }}>
          <h1 style={{ fontSize:28, fontWeight:900, color:'#1A1A2E', margin:'0 0 8px', letterSpacing:'0.05em' }}>PERILOUS PATH</h1>
          <p style={{ color:'#BBB', fontSize:11, fontWeight:700, letterSpacing:'0.14em', margin:0 }}>MEMORIZE · NAVIGATE · SURVIVE</p>
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
          {([['LEVEL',level],['COMBO',combo]] as [string,number][]).map(([lbl,val]) => (
            <div key={lbl} style={{ textAlign:'center' }}>
              <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>{lbl}</p>
              <p style={{ fontSize:26, fontWeight:900, color: lbl==='COMBO'&&val>2?'#C4B5FD':'#1A1A2E', margin:0 }}>
                {lbl==='COMBO'?`×${val}`:val}
              </p>
            </div>
          ))}
        </div>
        <p style={{ fontSize:13, color:'#AAA', margin:0 }}>XP +{Math.floor(scoreRef.current * 0.4)}</p>
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

      {/* Memorize progress bar */}
      <div style={{ height:3, background:'rgba(0,0,0,0.06)', flexShrink:0 }}>
        <div style={{ height:'100%', background: phase==='memorize' ? '#C4B5FD' : 'transparent',
          width:`${memPct}%`, transition:'width 0.05s linear' }} />
      </div>

      {/* HUD */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px 4px', flexShrink:0 }}>
        <button onClick={onExit} style={{ background:'none', border:'none', color:'#CCC', fontSize:20, cursor:'pointer', padding:0 }}>←</button>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>SCORE</p>
          <p style={{ fontSize:20, fontWeight:900, color:'#1A1A2E', margin:0, lineHeight:1.1 }}>{score.toLocaleString()}</p>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'#BBB', margin:0 }}>LV</p>
            <p style={{ fontSize:16, fontWeight:900, color:'#1A1A2E', margin:0 }}>{level}</p>
          </div>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'#BBB', margin:0 }}>COMBO</p>
            <p style={{ fontSize:16, fontWeight:900, color: combo > 2 ? '#C4B5FD' : '#1A1A2E', margin:0 }}>×{combo}</p>
          </div>
        </div>
      </div>

      {/* Phase label */}
      <div style={{ textAlign:'center', padding:'2px 0 6px', flexShrink:0 }}>
        <AnimatePresence mode="wait">
          <motion.p key={phase}
            initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ fontSize:10, fontWeight:800, letterSpacing:'0.18em', margin:0,
              color: phase === 'memorize' ? '#C4B5FD' : '#93DCFF' }}>
            {phase === 'memorize' ? 'MEMORIZE THE MINES' : 'NAVIGATE A → B'}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Lives */}
      <div style={{ display:'flex', justifyContent:'center', gap:8, paddingBottom:8, flexShrink:0 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:10, height:10, borderRadius:'50%',
            background: i < lives ? '#FF6B6B' : 'rgba(0,0,0,0.1)', transition:'background 0.3s' }} />
        ))}
      </div>

      {/* Grid */}
      <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center' }}>
        <div style={{ display:'grid', gap:5, gridTemplateColumns:`repeat(${board.size},${cell}px)` }}>
          {Array.from({ length: board.size * board.size }, (_, i) => {
            const isStart  = i === board.start
            const isEnd    = i === board.end
            const isMine   = board.mines.has(i)
            const isDecoy  = board.decoys.has(i)
            const inPath   = path.includes(i)
            const isHit    = hitMine === i
            const showMine = phase === 'memorize' && isMine
            const showDec  = phase === 'memorize' && isDecoy

            let bg = 'white'
            if (isHit)                  bg = mc
            else if (inPath && !isMine) bg = 'rgba(147,220,255,0.3)'
            else if (showMine)          bg = `${mc}28`
            else if (showDec)           bg = `${dc}22`
            else if (isStart)           bg = '#86EFAC30'
            else if (isEnd)             bg = '#93DCFF30'

            return (
              <motion.button key={`${level}-${i}`}
                whileTap={phase === 'navigate' ? { scale:0.88 } : {}}
                animate={isHit ? { x:[0,-5,5,-5,0] } : {}}
                onClick={() => handleTap(i)}
                style={{
                  width:cell, height:cell, borderRadius:Math.round(cell*0.18),
                  background:bg, cursor:'pointer', touchAction:'manipulation',
                  border:`1.5px solid ${showMine ? mc+'55' : showDec ? dc+'55' : 'rgba(0,0,0,0.07)'}`,
                  boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:cell * 0.32, fontWeight:900,
                  color: isStart||isEnd ? '#1A1A2E' : showMine ? mc : showDec ? dc : 'transparent',
                  transition:'background 0.2s, border-color 0.2s',
                }}>
                {isStart ? 'A' : isEnd ? 'B' : showMine ? '×' : showDec ? '·' : ''}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
