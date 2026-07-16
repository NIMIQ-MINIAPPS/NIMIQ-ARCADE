import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronDown, RotateCw } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'

const BG = '#FFF8E8'
const COLS = 8, ROWS = 16, BLOCK = 28

const PIECES = [
  { shape: [[1,1,1,1]],         color: '#93DCFF' }, // I – celeste
  { shape: [[1,1],[1,1]],       color: '#C4B5FD' }, // O – lavanda
  { shape: [[0,1,0],[1,1,1]],   color: '#86EFAC' }, // T – verde menta
  { shape: [[1,0,0],[1,1,1]],   color: '#FDBA74' }, // L – durazno
  { shape: [[0,0,1],[1,1,1]],   color: '#FCD34D' }, // J – amarillo
  { shape: [[0,1,1],[1,1,0]],   color: '#F9A8D4' }, // S – rosa
  { shape: [[1,1,0],[0,1,1]],   color: '#67E8F9' }, // Z – azul
]

type Board = (string | null)[][]
type Piece = { idx: number; shape: number[][]; color: string; x: number; y: number }

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function spawnPiece(): Piece {
  const idx = Math.floor(Math.random() * PIECES.length)
  const p = PIECES[idx]
  return { idx, shape: p.shape.map(r => [...r]), color: p.color, x: Math.floor(COLS / 2) - 1, y: 0 }
}

function collides(board: Board, shape: number[][], x: number, y: number): boolean {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const nr = y + r, nc = x + c
      if (nr >= ROWS || nc < 0 || nc >= COLS) return true
      if (nr >= 0 && board[nr][nc]) return true
    }
  return false
}

function tryRotate(board: Board, piece: Piece): Piece | null {
  const rot = piece.shape[0].map((_, i) => piece.shape.map(r => r[i]).reverse())
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(board, rot, piece.x + kick, piece.y))
      return { ...piece, shape: rot, x: piece.x + kick }
  }
  return null
}

// ── Audio ────────────────────────────────────────────────────────────────────
let _ctx: AudioContext | null = null
function snd(type: 'move' | 'rotate' | 'drop' | 'line' | 'tetris' | 'doom') {
  try {
    if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ctx, t = c.currentTime
    const note = (f: number, at: number, dur: number, vol: number, osc: OscillatorType = 'sine') => {
      const o = c.createOscillator(), g = c.createGain()
      o.type = osc; o.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur)
      o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur)
    }
    if (type === 'move')   note(440, t, 0.04, 0.05, 'square')
    if (type === 'rotate') note(600, t, 0.05, 0.07, 'triangle')
    if (type === 'drop')   { note(220, t, 0.04, 0.12, 'square'); note(160, t+0.035, 0.07, 0.1, 'square') }
    if (type === 'line')   [550, 770].forEach((f, i) => note(f, t+i*0.06, 0.13, 0.09))
    if (type === 'tetris') [550, 770, 990, 1210].forEach((f, i) => note(f, t+i*0.055, 0.14, 0.1))
    if (type === 'doom')   { note(180, t, 0.5, 0.18, 'sawtooth'); note(130, t+0.3, 0.45, 0.14, 'square') }
  } catch { /**/ }
}

// ── Mini piece preview ───────────────────────────────────────────────────────
function MiniPiece({ piece }: { piece: Piece | null }) {
  if (!piece) return <div style={{ width: 50, height: 34 }} />
  const S = 11
  const cols = piece.shape[0].length, rows = piece.shape.length
  return (
    <svg width={cols * S + 2} height={rows * S + 2} style={{ display: 'block' }}>
      {piece.shape.map((row, r) => row.map((v, c) =>
        v ? <rect key={`${r}${c}`} x={c*S+1} y={r*S+1} width={S-2} height={S-2} rx={2} fill={piece.color} /> : null
      ))}
    </svg>
  )
}

// ── Start screen illustration ────────────────────────────────────────────────
function StartIllustration() {
  const S = 17
  const stack = [
    ['#93DCFF','#93DCFF','#C4B5FD','#C4B5FD','#86EFAC','#86EFAC'],
    ['#FDBA74','#FDBA74','#FCD34D','#FCD34D','#F9A8D4','#67E8F9'],
    [null,'#C4B5FD','#C4B5FD','#86EFAC','#86EFAC',null],
    [null,null,'#93DCFF','#93DCFF',null,null],
  ]
  return (
    <svg viewBox="0 0 140 124" width={158} height={140}>
      <rect x={6} y={6} width={128} height={112} rx={16} fill="white" opacity={0.75}/>
      {/* stacked layers */}
      {stack.map((row, ri) => row.map((col, ci) => col && (
        <rect key={`${ri}${ci}`}
          x={ci*(S+1)+11} y={(stack.length - 1 - ri)*(S+1) + 72}
          width={S} height={S} rx={3} fill={col}
        />
      )))}
      {/* falling I-piece */}
      {[0,1,2,3].map(i => (
        <rect key={i} x={i*(S+1)+11} y={16} width={S} height={S} rx={3} fill="#93DCFF" opacity={0.9}/>
      ))}
      {/* speed lines */}
      {[0,1,2,3].map(i => (
        <line key={i} x1={i*(S+1)+20} y1={8} x2={i*(S+1)+20} y2={13}
          stroke="#93DCFF" strokeWidth={2} opacity={0.45}/>
      ))}
    </svg>
  )
}

// ── Control button ────────────────────────────────────────────────────────────
function Btn({ label, onPress, wide }: { label: React.ReactNode; onPress: () => void; wide?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onPointerDown={e => { e.preventDefault(); onPress() }}
      style={{
        background: 'white', border: 'none', borderRadius: 14,
        height: 68, fontSize: wide ? 13 : 22, cursor: 'pointer',
        boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
        color: '#444', fontWeight: 800, letterSpacing: wide ? '0.1em' : 0,
        touchAction: 'manipulation', userSelect: 'none',
        WebkitUserSelect: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
      {label}
    </motion.button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NimtrisGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [score, setScore]   = useState(0)
  const [lines, setLines]   = useState(0)
  const [level, setLevel]   = useState(1)
  const [nextDisp, setNextDisp] = useState<Piece>(() => spawnPiece())
  const [holdDisp, setHoldDisp] = useState<Piece | null>(null)

  const boardRef    = useRef<Board>(emptyBoard())
  const pieceRef    = useRef<Piece>(spawnPiece())
  const nextRef     = useRef<Piece>(spawnPiece())
  const holdRef     = useRef<Piece | null>(null)
  const canHoldRef  = useRef(true)
  const scoreRef    = useRef(0)
  const linesRef    = useRef(0)
  const levelRef    = useRef(1)
  const comboRef    = useRef(0)
  const intervalRef = useRef<number>(0)
  const aliveRef    = useRef(false)
  const flashRef    = useRef(false)

  const getSpeed = (lvl: number) => Math.max(80, 600 - (lvl - 1) * 45)

  // ── Draw ───────────────────────────────────────────────────────────────────
  const draw = useCallback((flashLines: number[] = []) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK)

    // grid
    ctx.strokeStyle = 'rgba(0,0,0,0.04)'
    ctx.lineWidth = 0.5
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r*BLOCK); ctx.lineTo(COLS*BLOCK, r*BLOCK); ctx.stroke()
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c*BLOCK, 0); ctx.lineTo(c*BLOCK, ROWS*BLOCK); ctx.stroke()
    }

    // board cells
    boardRef.current.forEach((row, r) => {
      if (flashLines.includes(r)) {
        ctx.fillStyle = 'rgba(255,255,255,0.96)'
        ctx.fillRect(0, r*BLOCK, COLS*BLOCK, BLOCK)
      } else {
        row.forEach((cell, c) => {
          if (!cell) return
          ctx.fillStyle = cell
          ctx.fillRect(c*BLOCK+1, r*BLOCK+1, BLOCK-2, BLOCK-2)
          ctx.fillStyle = 'rgba(255,255,255,0.28)'
          ctx.fillRect(c*BLOCK+2, r*BLOCK+2, BLOCK-4, 4)
        })
      }
    })

    const p = pieceRef.current

    // ghost piece
    let gy = p.y
    while (!collides(boardRef.current, p.shape, p.x, gy + 1)) gy++
    if (gy > p.y) {
      p.shape.forEach((row, r) => row.forEach((v, c) => {
        if (!v) return
        ctx.fillStyle = p.color + '22'
        ctx.fillRect((p.x+c)*BLOCK+2, (gy+r)*BLOCK+2, BLOCK-4, BLOCK-4)
        ctx.strokeStyle = p.color + '55'
        ctx.lineWidth = 1
        ctx.strokeRect((p.x+c)*BLOCK+2, (gy+r)*BLOCK+2, BLOCK-4, BLOCK-4)
      }))
    }

    // active piece
    p.shape.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return
      ctx.fillStyle = p.color
      ctx.fillRect((p.x+c)*BLOCK+1, (p.y+r)*BLOCK+1, BLOCK-2, BLOCK-2)
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.fillRect((p.x+c)*BLOCK+2, (p.y+r)*BLOCK+2, BLOCK-4, 4)
    }))

    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, COLS*BLOCK, ROWS*BLOCK)
  }, [])

  // ── Lock piece (via ref to avoid circular dep with step) ──────────────────
  const lockRef = useRef<() => void>(() => {})
  const stepRef = useRef<() => void>(() => {})

  lockRef.current = () => {
    if (!aliveRef.current) return
    const p = pieceRef.current

    if (p.y <= 0) {
      aliveRef.current = false
      clearInterval(intervalRef.current)
      snd('doom')
      addXp(Math.floor(scoreRef.current * 0.5))
      setHighScore('nimtris', scoreRef.current)
      setPhase('over')
      return
    }

    const b = boardRef.current.map(r => [...r])
    p.shape.forEach((row, r) => row.forEach((v, c) => { if (v) b[p.y+r][p.x+c] = p.color }))
    boardRef.current = b
    canHoldRef.current = true

    const full: number[] = []
    boardRef.current.forEach((row, i) => { if (row.every(c => c !== null)) full.push(i) })

    if (full.length > 0) {
      flashRef.current = true
      clearInterval(intervalRef.current)
      draw(full) // white flash

      setTimeout(() => {
        if (!aliveRef.current) return
        const nb = boardRef.current.filter((_, i) => !full.includes(i))
        boardRef.current = [...Array.from({ length: full.length }, () => Array(COLS).fill(null)), ...nb]

        comboRef.current++
        const pts = full.length === 4 ? 1200 : full.length * 200
        const bonus = comboRef.current > 1 ? (comboRef.current - 1) * 80 : 0
        scoreRef.current += pts + bonus
        linesRef.current += full.length
        const newLvl = Math.floor(linesRef.current / 10) + 1
        levelRef.current = newLvl

        setScore(scoreRef.current)
        setLines(linesRef.current)
        setLevel(newLvl)
        snd(full.length >= 4 ? 'tetris' : 'line')

        pieceRef.current = { ...nextRef.current, x: Math.floor(COLS/2)-1, y: 0 }
        nextRef.current = spawnPiece()
        setNextDisp({ ...nextRef.current })

        draw()
        flashRef.current = false
        intervalRef.current = window.setInterval(() => stepRef.current(), getSpeed(levelRef.current))
      }, 150)
    } else {
      comboRef.current = 0
      pieceRef.current = { ...nextRef.current, x: Math.floor(COLS/2)-1, y: 0 }
      nextRef.current = spawnPiece()
      setNextDisp({ ...nextRef.current })
      draw()
    }
  }

  stepRef.current = () => {
    if (!aliveRef.current || flashRef.current) return
    const p = pieceRef.current
    if (!collides(boardRef.current, p.shape, p.x, p.y + 1)) {
      pieceRef.current = { ...p, y: p.y + 1 }
      draw()
    } else {
      lockRef.current()
    }
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    aliveRef.current = true
    flashRef.current = false
    boardRef.current = emptyBoard()
    const p1 = spawnPiece(), p2 = spawnPiece()
    pieceRef.current = p1
    nextRef.current = p2
    holdRef.current = null
    canHoldRef.current = true
    scoreRef.current = 0; linesRef.current = 0; levelRef.current = 1; comboRef.current = 0
    setScore(0); setLines(0); setLevel(1)
    setNextDisp({ ...p2 }); setHoldDisp(null)
    setPhase('play')
    clearInterval(intervalRef.current)
    requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (canvas) {
        const dpr = window.devicePixelRatio || 1
        canvas.width = COLS * BLOCK * dpr
        canvas.height = ROWS * BLOCK * dpr
      }
      draw()
      intervalRef.current = window.setInterval(() => stepRef.current(), getSpeed(1))
    })
  }, [draw])

  // ── Hold ─────────────────────────────────────────────────────────────────
  const doHold = () => {
    if (!canHoldRef.current || flashRef.current) return
    const p = pieceRef.current
    const orig = PIECES[p.idx]
    const reset: Piece = { idx: p.idx, shape: orig.shape.map(r => [...r]), color: p.color, x: Math.floor(COLS/2)-1, y: 0 }
    if (holdRef.current) {
      pieceRef.current = { ...holdRef.current, x: Math.floor(COLS/2)-1, y: 0 }
      holdRef.current = reset
    } else {
      holdRef.current = reset
      pieceRef.current = { ...nextRef.current, x: Math.floor(COLS/2)-1, y: 0 }
      nextRef.current = spawnPiece()
      setNextDisp({ ...nextRef.current })
    }
    canHoldRef.current = false
    setHoldDisp({ ...holdRef.current })
    snd('rotate'); draw()
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'play' || flashRef.current) return
      const p = pieceRef.current
      if (e.key === 'ArrowLeft') {
        if (!collides(boardRef.current, p.shape, p.x-1, p.y)) { pieceRef.current = {...p,x:p.x-1}; snd('move'); draw() }
      } else if (e.key === 'ArrowRight') {
        if (!collides(boardRef.current, p.shape, p.x+1, p.y)) { pieceRef.current = {...p,x:p.x+1}; snd('move'); draw() }
      } else if (e.key === 'ArrowDown') {
        stepRef.current()
      } else if (e.key === 'ArrowUp') {
        const rot = tryRotate(boardRef.current, p)
        if (rot) { pieceRef.current = rot; snd('rotate'); draw() }
      } else if (e.key === ' ') {
        e.preventDefault()
        let ny = p.y
        while (!collides(boardRef.current, p.shape, p.x, ny+1)) ny++
        pieceRef.current = {...p, y:ny}; snd('drop'); draw()
        lockRef.current()
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'Shift') {
        doHold()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, draw])

  useEffect(() => () => { aliveRef.current = false; clearInterval(intervalRef.current) }, [])

  const exitPlay = useCallback(() => {
    if (aliveRef.current) {
      aliveRef.current = false
      clearInterval(intervalRef.current)
      if (scoreRef.current > 0) {
        addXp(Math.floor(scoreRef.current * 0.5))
        setHighScore('nimtris', scoreRef.current)
      }
    }
    onExit()
  }, [addXp, setHighScore, onExit])

  const best = highScores['nimtris'] ?? 0

  // ── START SCREEN ──────────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:22, fontFamily:'system-ui,sans-serif', position:'relative' }}>
        <button onClick={onExit} style={{ position:'absolute', top:20, left:20, background:'none', border:'none', color:'#CCC', fontSize:22, cursor:'pointer' }}>←</button>
        <StartIllustration />
        <div style={{ textAlign:'center' }}>
          <h1 style={{ fontSize:36, fontWeight:900, color:'#1A1A2E', margin:'0 0 8px', letterSpacing:'0.06em' }}>NIMTRIS</h1>
          <p style={{ color:'#AAA', fontSize:12, fontWeight:700, letterSpacing:'0.14em', lineHeight:2.2, margin:0 }}>STACK. CLEAR. SURVIVE.</p>
        </div>
        <motion.button whileTap={{ scale:0.96 }} onClick={() => { if (hasSeenTutorial('nimtris')) startGame(); else setPhase('howto') }}
          style={{ background:'#1A1A2E', color:BG, border:'none', borderRadius:16, padding:'16px 68px', fontSize:18, fontWeight:900, cursor:'pointer', letterSpacing:'0.12em' }}>
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
        <HowToPlayOverlay bg={BG} accent="#1A1A2E" textColor="#1A1A2E" mutedColor="#999" bullets={TUTORIALS['nimtris']} onStart={() => { markTutorialSeen('nimtris'); startGame() }} />
      </div>
    )
  }

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  if (phase === 'over') {
    const xp = Math.floor(scoreRef.current * 0.5)
    return (
      <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, fontFamily:'system-ui,sans-serif' }}>
        <p style={{ fontSize:12, fontWeight:800, color:'#FF6B6B', letterSpacing:'0.22em', margin:0 }}>GAME OVER</p>
        <p style={{ fontSize:52, fontWeight:900, color:'#1A1A2E', margin:0, lineHeight:1 }}>{scoreRef.current.toLocaleString()}</p>
        <div style={{ display:'flex', gap:36, margin:'4px 0' }}>
          {([['LINES', lines], ['LEVEL', level]] as [string, number][]).map(([lbl, val]) => (
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

  // ── PLAY SCREEN ───────────────────────────────────────────────────────────
  return (
    <div style={{ width:'100%', height:'100%', background:BG, display:'flex', flexDirection:'column', fontFamily:'system-ui,sans-serif', overflow:'hidden' }}>

      {/* HUD */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px 6px', flexShrink:0 }}>
        <button onClick={exitPlay} style={{ background:'none', border:'none', color:'#CCC', fontSize:18, cursor:'pointer', padding:0, alignSelf:'flex-start' }}>←</button>
        <div style={{ textAlign:'center', minWidth:50 }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:'0 0 3px' }}>HOLD</p>
          <MiniPiece piece={holdDisp} />
        </div>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:0 }}>SCORE</p>
          <p style={{ fontSize:22, fontWeight:900, color:'#1A1A2E', margin:0, lineHeight:1.1 }}>{score.toLocaleString()}</p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:2 }}>
            <span style={{ fontSize:10, color:'#BBB', fontWeight:700 }}>L{lines}</span>
            <span style={{ fontSize:10, color:'#BBB', fontWeight:700 }}>LV{level}</span>
          </div>
        </div>
        <div style={{ textAlign:'center', minWidth:50 }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.15em', color:'#BBB', margin:'0 0 3px' }}>NEXT</p>
          <MiniPiece piece={nextDisp} />
        </div>
      </div>

      {/* Board */}
      <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', overflow:'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ maxWidth:'100%', maxHeight:'100%', width:COLS*BLOCK, height:ROWS*BLOCK, borderRadius:6, boxShadow:'0 4px 24px rgba(0,0,0,0.07)', objectFit:'contain' }}
        />
      </div>

      {/* Controls */}
      <div style={{ flexShrink:0, padding:'8px 16px', paddingBottom:'max(14px, env(safe-area-inset-bottom, 14px))', display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          <Btn label={<ChevronLeft size={22} />} onPress={() => {
            if (flashRef.current) return
            const p = pieceRef.current
            if (!collides(boardRef.current, p.shape, p.x-1, p.y)) { pieceRef.current = {...p,x:p.x-1}; snd('move'); draw() }
          }} />
          <Btn label={<RotateCw size={20} />} onPress={() => {
            if (flashRef.current) return
            const rot = tryRotate(boardRef.current, pieceRef.current)
            if (rot) { pieceRef.current = rot; snd('rotate'); draw() }
          }} />
          <Btn label={<ChevronRight size={22} />} onPress={() => {
            if (flashRef.current) return
            const p = pieceRef.current
            if (!collides(boardRef.current, p.shape, p.x+1, p.y)) { pieceRef.current = {...p,x:p.x+1}; snd('move'); draw() }
          }} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:8 }}>
          <Btn label="HOLD" onPress={doHold} wide />
          <Btn label={<>DROP <ChevronDown size={16} /></>} onPress={() => {
            if (flashRef.current) return
            const p = pieceRef.current
            let ny = p.y
            while (!collides(boardRef.current, p.shape, p.x, ny+1)) ny++
            pieceRef.current = {...p, y:ny}; snd('drop'); draw()
            lockRef.current()
          }} wide />
        </div>
      </div>
    </div>
  )
}
