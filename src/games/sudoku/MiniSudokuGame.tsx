import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'

const BG = '#FFF9E8'
const BASE4 = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]]
const BASE6 = [[1, 2, 3, 4, 5, 6], [4, 5, 6, 1, 2, 3], [2, 3, 1, 5, 6, 4], [5, 6, 4, 2, 3, 1], [3, 1, 2, 6, 4, 5], [6, 4, 5, 3, 1, 2]]
const PASTELS = ['#93DCFF', '#C4B5FD', '#86EFAC', '#FDBA74', '#FCA5A5', '#FCD34D']

function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5) }

function levelParams(level: number) {
  if (level <= 3) return { size: 4, boxW: 2, blanks: Math.min(6 + level, 10), time: Math.max(35, 95 - level * 10) }
  const l = level - 3
  return { size: 6, boxW: 3, blanks: Math.min(10 + l * 2, 22), time: Math.max(45, 160 - l * 12) }
}

function generatePuzzle(size: number, boxW: number, blanks: number) {
  const base = size === 4 ? BASE4 : BASE6
  const boxH = 2
  const bandsCount = size / boxH, stacksCount = size / boxW
  const perm = shuffle(Array.from({ length: size }, (_, i) => i + 1))
  const solved = base.map(row => row.map(v => perm[v - 1]))

  const rowOrder: number[] = []
  shuffle(Array.from({ length: bandsCount }, (_, i) => i)).forEach(b => {
    rowOrder.push(...shuffle(Array.from({ length: boxH }, (_, i) => b * boxH + i)))
  })
  const colOrder: number[] = []
  shuffle(Array.from({ length: stacksCount }, (_, i) => i)).forEach(s => {
    colOrder.push(...shuffle(Array.from({ length: boxW }, (_, i) => s * boxW + i)))
  })

  const solution = rowOrder.map(r => colOrder.map(c => solved[r][c]))
  const puzzle: (number | null)[][] = solution.map(r => [...r])
  const positions = shuffle(Array.from({ length: size * size }, (_, i) => i))
  for (let i = 0; i < blanks; i++) {
    const pos = positions[i]
    puzzle[Math.floor(pos / size)][pos % size] = null
  }
  return { solution, puzzle }
}

let _ac: AudioContext | null = null
function snd(type: 'place' | 'wrong' | 'solved' | 'over') {
  if (soundMuted) return
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const n = (f: number, at: number, d: number, v: number, o: OscillatorType = 'sine') => {
      const osc = c.createOscillator(), g = c.createGain()
      osc.type = o; osc.frequency.setValueAtTime(f, at)
      g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.001, at + d)
      osc.connect(g); g.connect(c.destination); osc.start(at); osc.stop(at + d)
    }
    if (type === 'place')  n(600, t, 0.05, 0.05, 'triangle')
    if (type === 'wrong')  n(200, t, 0.16, 0.1, 'sawtooth')
    if (type === 'solved') [600, 800, 1000, 1250, 1500].forEach((f, i) => n(f, t + i * 0.06, 0.13, 0.07))
    if (type === 'over')   { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

interface Confetto { id: number; dx: number; dy: number; color: string }
let _cid = 0

export default function MiniSudokuGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [grid, setGrid] = useState<(number | null)[][]>([])
  const [solution, setSolution] = useState<number[][]>([])
  const [fixed, setFixed] = useState<boolean[][]>([])
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null)
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const [errorCount, setErrorCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(90)
  const [won, setWon] = useState(false)
  const [autoCheck, setAutoCheck] = useState(true)
  const [confetti, setConfetti] = useState<Confetto[]>([])
  const [shakeCell, setShakeCell] = useState<string | null>(null)

  const scoreRef = useRef(0), levelRef = useRef(1), errorRef = useRef(0)
  const activeRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)

  const setupPuzzle = useCallback(() => {
    const { size, boxW, blanks, time } = levelParams(levelRef.current)
    const { solution: sol, puzzle } = generatePuzzle(size, boxW, blanks)
    setSolution(sol)
    setGrid(puzzle.map(r => [...r]))
    setFixed(puzzle.map(r => r.map(v => v !== null)))
    setErrors(new Set()); setErrorCount(0); errorRef.current = 0
    setSelectedCell(null)
    setTimeLeft(time)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          activeRef.current = false
          snd('over'); vibrate([30, 40, 60])
          addXp(Math.floor(scoreRef.current * 0.3))
          setHighScore('mini-sudoku', scoreRef.current)
          setPhase('over')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [addXp, setHighScore])

  const start = useCallback(() => {
    scoreRef.current = 0; levelRef.current = 1
    activeRef.current = true
    setScore(0); setLevel(1); setWon(false); setPhase('play')
    setupPuzzle()
  }, [setupPuzzle])

  const handleExit = useCallback(() => {
    if (activeRef.current) {
      activeRef.current = false
      clearInterval(timerRef.current)
      if (scoreRef.current > 0) {
        addXp(Math.floor(scoreRef.current * 0.3))
        setHighScore('mini-sudoku', scoreRef.current)
      }
    }
    onExit()
  }, [addXp, setHighScore, onExit])

  const burstConfetti = useCallback(() => {
    const items: Confetto[] = Array.from({ length: 18 }, (_, i) => ({
      id: _cid++, dx: (Math.random() - 0.5) * 220, dy: -60 - Math.random() * 120, color: PASTELS[i % PASTELS.length],
    }))
    setConfetti(items)
    setTimeout(() => setConfetti([]), 800)
  }, [])

  const placeNumber = useCallback((num: number) => {
    if (!selectedCell || phase !== 'play') return
    const [r, c] = selectedCell
    if (fixed[r][c]) return

    const newGrid = grid.map(row => [...row])
    newGrid[r][c] = num
    setGrid(newGrid)

    if (num !== solution[r][c]) {
      errorRef.current++; setErrorCount(errorRef.current)
      snd('wrong'); vibrate(30)
      setShakeCell(`${r},${c}`); setTimeout(() => setShakeCell(null), 300)
      if (autoCheck) setErrors(prev => new Set([...prev, `${r},${c}`]))
    } else {
      snd('place'); vibrate(8)
      setErrors(prev => { const n = new Set(prev); n.delete(`${r},${c}`); return n })
      const complete = newGrid.every((row, ri) => row.every((v, ci) => v === solution[ri][ci]))
      if (complete) {
        clearInterval(timerRef.current)
        const pts = 100 + timeLeft * 2 + levelRef.current * 20 - errorRef.current * 15
        scoreRef.current += Math.max(20, pts); setScore(scoreRef.current)
        levelRef.current++; setLevel(levelRef.current)
        setWon(true); snd('solved'); vibrate([15, 30, 15, 30, 40]); burstConfetti()
        setTimeout(() => { setWon(false); setupPuzzle() }, 1400)
      }
    }
    setSelectedCell(null)
  }, [selectedCell, grid, solution, fixed, phase, timeLeft, autoCheck, setupPuzzle, burstConfetti])

  useEffect(() => () => clearInterval(timerRef.current), [])

  const { size } = levelParams(level)
  const cellSize = Math.min(size === 4 ? 72 : 48, (320 - 12) / size)
  const best = highScores['mini-sudoku'] ?? 0
  const xp = Math.floor(score * 0.3)

  // ── Start screen ──────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 34px)', gap: 3, padding: 8, borderRadius: 12, background: 'white', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
        {[1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1].map((v, i) => (
          <div key={i} style={{ width: 34, height: 34, borderRadius: 6, background: i % 5 === 0 ? '#86EFAC' : '#F5F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#1A1A2E' }}>{v}</div>
        ))}
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>MINI SUDOKU</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>4×4 → 6×6 · BEAT THE CLOCK</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('mini-sudoku')) start(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  // ── How to play ───────────────────────────────────────────────────────
  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', position: 'relative', fontFamily: 'system-ui,sans-serif' }}>
      <HowToPlayOverlay bg={BG} accent="#1A1A2E" bullets={TUTORIALS['mini-sudoku']}
        onStart={() => { markTutorialSeen('mini-sudoku'); start() }} />
    </div>
  )

  // ── Game over screen ─────────────────────────────────────────────────
  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>TIME'S UP</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{score.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>LEVEL</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{level}</p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{xp}</p>
      {score > 0 && score >= best && <p style={{ fontSize: 11, color: '#E9B213', fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <motion.button whileTap={{ scale: 0.96 }} onClick={start}
          style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 14, padding: '15px 32px', fontSize: 14, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.1em' }}>
          PLAY AGAIN
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onExit}
          style={{ background: 'none', color: '#AAA', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: '15px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          HOME
        </motion.button>
      </div>
    </div>
  )

  // ── Play screen ──────────────────────────────────────────────────────
  const boxW = size === 4 ? 2 : 3
  return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 4px', flexShrink: 0 }}>
        <button onClick={handleExit} style={{ background: 'none', border: 'none', color: '#CCC', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>TIME</p>
            <p style={{ fontSize: 17, fontWeight: 900, color: timeLeft <= 15 ? '#FF6B6B' : '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{timeLeft}s</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>LV</p>
            <p style={{ fontSize: 17, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{level}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 17, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <button onClick={() => setAutoCheck(v => !v)}
          style={{ fontSize: 9, fontWeight: 900, padding: '5px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', background: autoCheck ? '#86EFAC33' : '#EEE', color: autoCheck ? '#14532D' : '#999', letterSpacing: '0.05em' }}>
          CHECK {autoCheck ? 'ON' : 'OFF'}
        </button>
      </div>

      {errorCount > 0 && (
        <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#FF6B6B', margin: '2px 0 0', letterSpacing: '0.08em' }}>{errorCount} ERROR{errorCount > 1 ? 'S' : ''}</p>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, position: 'relative' }}>
        <AnimatePresence>
          {won && (
            <motion.p key={level} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '18%', fontSize: 16, fontWeight: 900, letterSpacing: '0.15em', color: '#27AE60', margin: 0 }}>
              SOLVED!
            </motion.p>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {confetti.map(c => (
            <motion.span key={c.id}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: c.dx, y: c.dy, opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.75, ease: 'easeOut' }}
              style={{ position: 'absolute', top: '30%', left: '50%', width: 8, height: 8, borderRadius: 3, background: c.color, pointerEvents: 'none', zIndex: 15 }}
            />
          ))}
        </AnimatePresence>

        <div className="grid gap-[3px] p-2 rounded-xl" style={{
          gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
          background: '#1A1A2E', borderRadius: 14,
        }}>
          {grid.map((row, r) => row.map((val, c) => {
            const isFixed = fixed[r]?.[c]
            const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c
            const isError = errors.has(`${r},${c}`)
            const isShaking = shakeCell === `${r},${c}`
            const boxRight = (c + 1) % boxW === 0 && c !== size - 1
            const boxBottom = (r + 1) % 2 === 0 && r !== size - 1
            return (
              <motion.button
                key={`${level}-${r}-${c}`}
                onClick={() => !isFixed && setSelectedCell([r, c])}
                whileTap={!isFixed ? { scale: 0.92 } : {}}
                animate={isShaking ? { x: [0, -5, 5, -3, 3, 0] } : {}}
                transition={{ duration: 0.28 }}
                style={{
                  width: cellSize, height: cellSize,
                  borderRadius: 6,
                  marginRight: boxRight ? 4 : 0, marginBottom: boxBottom ? 4 : 0,
                  background: isSelected ? '#FDE68A' : isError ? '#FCA5A5' : isFixed ? '#EFEFE8' : 'white',
                  border: isSelected ? '2px solid #E9B213' : isError ? '2px solid #FF6B6B' : '1px solid rgba(0,0,0,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: cellSize * 0.42, fontWeight: 900,
                  color: isFixed ? '#1A1A2E' : isError ? '#B91C1C' : '#1A1A2E',
                  cursor: isFixed ? 'default' : 'pointer',
                }}
              >{val ?? ''}</motion.button>
            )
          }))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 300 }}>
          {Array.from({ length: size }, (_, i) => i + 1).map(n => (
            <motion.button
              key={n}
              whileTap={{ scale: 0.9 }}
              onClick={() => placeNumber(n)}
              style={{
                width: 48, height: 48, borderRadius: 12, fontWeight: 900, fontSize: 20,
                background: 'white', color: '#1A1A2E', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer',
              }}
            >{n}</motion.button>
          ))}
        </div>

        {selectedCell && (
          <button onClick={() => {
            const [r, c] = selectedCell
            if (!fixed[r][c]) {
              const newGrid = grid.map(row => [...row])
              newGrid[r][c] = null; setGrid(newGrid)
              setErrors(prev => { const n = new Set(prev); n.delete(`${r},${c}`); return n })
            }
            setSelectedCell(null)
          }}
            style={{ fontSize: 12, fontWeight: 700, color: '#BBB', background: 'none', border: 'none', cursor: 'pointer' }}>
            CLEAR
          </button>
        )}
      </div>
    </div>
  )
}
