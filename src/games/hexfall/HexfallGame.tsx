import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'

const BG = '#FFF9E8'
const PASTELS = ['#86EFAC','#C4B5FD','#93DCFF','#FCA5A5','#FDBA74']
const COLS = 7, ROWS = 8, R = 24
const sqrt3 = Math.sqrt(3)

let _uid = 0
const uid = () => ++_uid

type HexCell = { id: number; row: number; col: number; color: string }

function hexCenter(row: number, col: number) {
  const cx = col * sqrt3 * R + (row % 2) * (sqrt3 / 2) * R + R
  const cy = row * 1.5 * R + R
  return { cx, cy }
}

const SVG_W = Math.ceil((COLS - 1) * sqrt3 * R + (sqrt3 / 2) * R + R * 2)
const SVG_H = Math.ceil((ROWS - 1) * 1.5 * R + R * 2)

function hexPts(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 3 * i - Math.PI / 6
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
}

function randColor() {
  return PASTELS[Math.floor(Math.random() * PASTELS.length)]
}

function hexNeighbors(row: number, col: number): [number, number][] {
  return row % 2 === 0
    ? [[row-1,col-1],[row-1,col],[row,col-1],[row,col+1],[row+1,col-1],[row+1,col]]
    : [[row-1,col],[row-1,col+1],[row,col-1],[row,col+1],[row+1,col],[row+1,col+1]]
}

function findGroup(cells: HexCell[], start: HexCell): HexCell[] {
  const visited = new Set<number>()
  const queue = [start]
  const group: HexCell[] = []
  const lookup = new Map<string, HexCell>()
  cells.forEach(c => lookup.set(`${c.row},${c.col}`, c))

  while (queue.length) {
    const cur = queue.pop()!
    if (visited.has(cur.id)) continue
    visited.add(cur.id)
    group.push(cur)
    hexNeighbors(cur.row, cur.col).forEach(([r, c]) => {
      const nb = lookup.get(`${r},${c}`)
      if (nb && !visited.has(nb.id) && nb.color === start.color) queue.push(nb)
    })
  }
  return group
}

function applyGravity(cells: HexCell[]): HexCell[] {
  const result: HexCell[] = []
  for (let col = 0; col < COLS; col++) {
    const col_cells = cells.filter(c => c.col === col).sort((a, b) => b.row - a.row)
    col_cells.forEach((cell, i) => {
      result.push({ ...cell, row: ROWS - 1 - i })
    })
  }
  return result
}

function fillEmpty(cells: HexCell[]): HexCell[] {
  const result = [...cells]
  for (let col = 0; col < COLS; col++) {
    const existing = cells.filter(c => c.col === col).map(c => c.row)
    for (let row = 0; row < ROWS; row++) {
      if (!existing.includes(row)) {
        result.push({ id: uid(), row, col, color: randColor() })
      }
    }
  }
  return result
}

function initCells(): HexCell[] {
  const cells: HexCell[] = []
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++)
      cells.push({ id: uid(), row, col, color: randColor() })
  return cells
}

// Audio
let _ac: AudioContext | null = null
function snd(type: 'pop' | 'combo' | 'doom') {
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const note = (f: number, at: number, dur: number, vol: number, osc: OscillatorType = 'sine') => {
      const o = c.createOscillator(), g = c.createGain()
      o.type = osc; o.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur)
      o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur)
    }
    if (type === 'pop')   { note(440, t, 0.06, 0.08); note(600, t+0.04, 0.06, 0.07) }
    if (type === 'combo') [550,770,990].forEach((f,i) => note(f, t+i*0.05, 0.1, 0.08))
    if (type === 'doom')  { note(200, t, 0.4, 0.18, 'sawtooth'); note(140, t+0.3, 0.4, 0.14, 'square') }
  } catch { /**/ }
}

export default function HexfallGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()

  const [cells, setCells]   = useState<HexCell[]>(initCells)
  const [phase, setPhase]   = useState<'start'|'howto'|'play'|'over'>('start')
  const [score, setScore]   = useState(0)
  const [moves, setMoves]   = useState(30)
  const [comboFlash, setComboFlash] = useState<string|null>(null)

  const scoreRef  = useRef(0)
  const comboRef  = useRef(0)
  const movesRef  = useRef(30)
  const busyRef   = useRef(false)
  const aliveRef  = useRef(false)

  const startGame = useCallback(() => {
    scoreRef.current = 0; comboRef.current = 0; movesRef.current = 30
    setScore(0); setMoves(30)
    setCells(initCells())
    setComboFlash(null)
    setPhase('play')
    busyRef.current = false
    aliveRef.current = true
  }, [])

  const exitPlay = useCallback(() => {
    if (aliveRef.current) {
      aliveRef.current = false
      if (scoreRef.current > 0) {
        addXp(Math.floor(scoreRef.current * 0.3))
        setHighScore('hexfall', scoreRef.current)
      }
    }
    onExit()
  }, [addXp, setHighScore, onExit])

  const handleTap = useCallback((cell: HexCell) => {
    if (phase !== 'play' || busyRef.current) return
    const group = findGroup(cells, cell)
    if (group.length < 2) return

    busyRef.current = true
    comboRef.current++
    const pts = group.length * 10 * comboRef.current
    scoreRef.current += pts
    setScore(scoreRef.current)

    if (comboRef.current >= 3) {
      setComboFlash(`COMBO ×${comboRef.current}`)
      snd('combo')
      setTimeout(() => setComboFlash(null), 900)
    } else {
      snd('pop')
    }

    const removedIds = new Set(group.map(c => c.id))
    const remaining = cells.filter(c => !removedIds.has(c.id))

    // Remove → gravity after 280ms
    setCells(prev => prev.filter(c => !removedIds.has(c.id)))

    setTimeout(() => {
      const fallen = applyGravity(remaining)
      setCells(fallen)

      setTimeout(() => {
        const filled = fillEmpty(fallen)
        setCells(filled)

        movesRef.current--
        const newMoves = movesRef.current
        setMoves(newMoves)

        if (newMoves <= 0) {
          aliveRef.current = false
          snd('doom')
          addXp(Math.floor(scoreRef.current * 0.3))
          setHighScore('hexfall', scoreRef.current)
          setTimeout(() => setPhase('over'), 300)
        } else {
          comboRef.current = 0 // reset combo after fill
          busyRef.current = false
        }
      }, 250)
    }, 280)
  }, [phase, cells, addXp, setHighScore])

  const best = highScores['hexfall'] ?? 0
  const xp   = Math.floor(scoreRef.current * 0.3)

  // ── START ─────────────────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, fontFamily:'system-ui,sans-serif', position:'relative' }}>
        <button onClick={onExit} style={{ position:'absolute', top:20, left:20, background:'none', border:'none', color:'#CCC', fontSize:22, cursor:'pointer' }}>←</button>
        {/* Illustration: small hex grid */}
        <svg width={SVG_W * 0.72} height={SVG_H * 0.72} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ filter:'drop-shadow(0 8px 24px rgba(0,0,0,0.07))' }}>
          <rect width={SVG_W} height={SVG_H} rx={16} fill="white" opacity={0.7}/>
          {[...Array(4)].map((_,row) => [...Array(COLS)].map((__,col) => {
            const {cx,cy} = hexCenter(row+2, col)
            return (
              <polygon key={`${row}${col}`}
                points={hexPts(cx, cy, R-3)}
                fill={PASTELS[(row*COLS+col)%PASTELS.length]}
                opacity={0.85}
              />
            )
          }))}
        </svg>
        <div style={{ textAlign:'center' }}>
          <h1 style={{ fontSize:30, fontWeight:900, color:'#1A1A2E', margin:'0 0 8px', letterSpacing:'0.05em' }}>HEX FALL</h1>
          <p style={{ color:'#AAA', fontSize:12, fontWeight:700, letterSpacing:'0.14em', margin:0 }}>TAP GROUPS TO CLEAR</p>
        </div>
        <motion.button whileTap={{ scale:0.96 }} onClick={() => { if (hasSeenTutorial('hexfall')) startGame(); else setPhase('howto') }}
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
      <div style={{ width:'100%', height:'100%', background:BG, position:'relative', fontFamily:'system-ui,sans-serif' }}>
        <HowToPlayOverlay bg={BG} accent="#1A1A2E" textColor="#1A1A2E" mutedColor="#999" bullets={TUTORIALS['hexfall']} onStart={() => { markTutorialSeen('hexfall'); startGame() }} />
      </div>
    )
  }

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  if (phase === 'over') {
    return (
      <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, fontFamily:'system-ui,sans-serif' }}>
        <p style={{ fontSize:12, fontWeight:800, color:'#FF6B6B', letterSpacing:'0.22em', margin:0 }}>GAME OVER</p>
        <p style={{ fontSize:52, fontWeight:900, color:'#1A1A2E', margin:0, lineHeight:1 }}>{scoreRef.current.toLocaleString()}</p>
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
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px 8px', flexShrink:0 }}>
        <button onClick={exitPlay} style={{ background:'none', border:'none', color:'#CCC', fontSize:20, cursor:'pointer', padding:0 }}>←</button>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>MOVES</p>
          <p style={{ fontSize:22, fontWeight:900, margin:0, lineHeight:1.1, transition:'color 0.3s',
            color: moves <= 5 ? '#FF6B6B' : '#1A1A2E' }}>{moves}</p>
        </div>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>SCORE</p>
          <p style={{ fontSize:22, fontWeight:900, color:'#1A1A2E', margin:0, lineHeight:1.1 }}>{score.toLocaleString()}</p>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', overflow:'hidden', position:'relative' }}>

        {/* Combo flash */}
        <AnimatePresence>
          {comboFlash && (
            <motion.div key={comboFlash}
              initial={{ scale:0.6, opacity:0 }}
              animate={{ scale:1, opacity:1 }}
              exit={{ scale:1.3, opacity:0 }}
              transition={{ duration:0.25 }}
              style={{ position:'absolute', zIndex:20, fontSize:26, fontWeight:900, color:'#C4B5FD', pointerEvents:'none',
                filter:'drop-shadow(0 2px 8px rgba(196,181,253,0.5))', letterSpacing:'0.08em' }}>
              {comboFlash}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hex grid */}
        <div style={{ position:'relative', width:SVG_W, height:SVG_H }}>
          <AnimatePresence>
            {cells.map(cell => {
              const { cx, cy } = hexCenter(cell.row, cell.col)
              return (
                <motion.div
                  key={cell.id}
                  initial={{ opacity:0, scale:0, y: -(cell.row + 1) * R * 2 }}
                  animate={{ opacity:1, scale:1, y:0, top: cy - R, left: cx - R }}
                  exit={{ scale:0, opacity:0 }}
                  transition={{ type:'spring', stiffness:300, damping:28, opacity:{ duration:0.15 } }}
                  onClick={() => handleTap(cell)}
                  style={{
                    position:'absolute', width:R*2, height:R*2,
                    cursor:'pointer', touchAction:'manipulation',
                  }}>
                  <motion.svg
                    width={R*2} height={R*2}
                    whileTap={{ scale:0.88 }}>
                    <polygon
                      points={hexPts(R, R, R - 2)}
                      fill={cell.color}
                    />
                    <polygon
                      points={hexPts(R, R, R - 2)}
                      fill="rgba(255,255,255,0.22)"
                      clipPath={`polygon(${hexPts(R, R*0.3, R-2).split(' ').slice(0,3).join(' ')})`}
                    />
                  </motion.svg>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
