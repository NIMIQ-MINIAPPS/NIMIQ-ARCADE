import { useEffect, useRef, useState, useCallback } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('nimtris')
const COLS = 10, ROWS = 20, BLOCK = 28

const PIECES = [
  { shape: [[1,1,1,1]], color: '#4FC3F7' },
  { shape: [[1,1],[1,1]], color: '#FFC107' },
  { shape: [[0,1,0],[1,1,1]], color: '#CE93D8' },
  { shape: [[1,0,0],[1,1,1]], color: '#FF8A65' },
  { shape: [[0,0,1],[1,1,1]], color: '#81C784' },
  { shape: [[0,1,1],[1,1,0]], color: '#F06292' },
  { shape: [[1,1,0],[0,1,1]], color: '#4DD0E1' },
]

type Board = (string | null)[][]

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}
function randomPiece() {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)]
  return { shape: p.shape, color: p.color, x: Math.floor(COLS / 2) - 1, y: 0 }
}
function rotate(shape: number[][]): number[][] {
  return shape[0].map((_, i) => shape.map(r => r[i]).reverse())
}
function collides(board: Board, shape: number[][], x: number, y: number): boolean {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const nr = y + r, nc = x + c
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc]) return true
    }
  return false
}
function merge(board: Board, shape: number[][], x: number, y: number, color: string): Board {
  const b = board.map(r => [...r])
  shape.forEach((row, r) => row.forEach((v, c) => { if (v) b[y + r][x + c] = color }))
  return b
}
function clearLines(board: Board) {
  const nb = board.filter(r => r.some(c => !c))
  const lines = ROWS - nb.length
  return { board: [...Array.from({ length: lines }, () => Array(COLS).fill(null)), ...nb], lines }
}

export default function NimtrisGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [level, setLevel] = useState(1)
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)

  const boardRef = useRef<Board>(emptyBoard())
  const pieceRef = useRef(randomPiece())
  const nextRef = useRef(randomPiece())
  const scoreRef = useRef(0)
  const linesRef = useRef(0)
  const comboRef = useRef(0)
  const intervalRef = useRef(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = T.bg
    ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK)

    ctx.strokeStyle = T.gridLine
    ctx.lineWidth = 0.5
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(COLS * BLOCK, r * BLOCK); ctx.stroke()
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, ROWS * BLOCK); ctx.stroke()
    }

    boardRef.current.forEach((row, r) => row.forEach((cell, c) => {
      if (!cell) return
      ctx.fillStyle = cell
      ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, 3)
    }))

    const p = pieceRef.current

    let gy = p.y
    while (!collides(boardRef.current, p.shape, p.x, gy + 1)) gy++
    if (gy !== p.y) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      p.shape.forEach((row, r) => row.forEach((v, c) => {
        if (v) ctx.fillRect((p.x + c) * BLOCK + 2, (gy + r) * BLOCK + 2, BLOCK - 4, BLOCK - 4)
      }))
    }

    ctx.fillStyle = p.color
    p.shape.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return
      ctx.fillRect((p.x + c) * BLOCK + 1, (p.y + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2)
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect((p.x + c) * BLOCK + 1, (p.y + r) * BLOCK + 1, BLOCK - 2, 3)
      ctx.fillStyle = p.color
    }))
  }, [])

  const step = useCallback(() => {
    const p = pieceRef.current
    if (!collides(boardRef.current, p.shape, p.x, p.y + 1)) {
      pieceRef.current = { ...p, y: p.y + 1 }
    } else {
      if (p.y <= 0) {
        setGameOver(true)
        clearInterval(intervalRef.current)
        addXp(Math.floor(scoreRef.current * 0.5))
        setHighScore('nimtris', scoreRef.current)
        return
      }
      boardRef.current = merge(boardRef.current, p.shape, p.x, p.y, p.color)
      const { board, lines: cleared } = clearLines(boardRef.current)
      boardRef.current = board
      if (cleared > 0) {
        comboRef.current++
        const pts = cleared === 4 ? 800 : cleared * 100
        const bonus = comboRef.current > 1 ? (comboRef.current - 1) * 50 : 0
        scoreRef.current += pts + bonus
        linesRef.current += cleared
        setScore(scoreRef.current)
        setLines(linesRef.current)
        const newLvl = Math.floor(linesRef.current / 10) + 1
        setLevel(newLvl)
        clearInterval(intervalRef.current)
        intervalRef.current = window.setInterval(step, Math.max(80, 600 - (newLvl - 1) * 40))
      } else {
        comboRef.current = 0
      }
      pieceRef.current = { ...nextRef.current, x: Math.floor(COLS / 2) - 1, y: 0 }
      nextRef.current = randomPiece()
    }
    draw()
  }, [draw, addXp, setHighScore])

  const startGame = useCallback(() => {
    boardRef.current = emptyBoard()
    pieceRef.current = randomPiece()
    nextRef.current = randomPiece()
    scoreRef.current = 0; linesRef.current = 0; comboRef.current = 0
    setScore(0); setLines(0); setLevel(1); setGameOver(false); setStarted(true)
    clearInterval(intervalRef.current)
    intervalRef.current = window.setInterval(step, 600)
  }, [step])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = COLS * BLOCK * dpr
    canvas.height = ROWS * BLOCK * dpr
    if (started) draw()
  }, [started, draw])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!started || gameOver) return
      const p = pieceRef.current
      switch (e.key) {
        case 'ArrowLeft':
          if (!collides(boardRef.current, p.shape, p.x - 1, p.y)) pieceRef.current = { ...p, x: p.x - 1 }; break
        case 'ArrowRight':
          if (!collides(boardRef.current, p.shape, p.x + 1, p.y)) pieceRef.current = { ...p, x: p.x + 1 }; break
        case 'ArrowDown': step(); break
        case 'ArrowUp': { const rot = rotate(p.shape); if (!collides(boardRef.current, rot, p.x, p.y)) pieceRef.current = { ...p, shape: rot }; break }
        case ' ': { let ny = p.y; while (!collides(boardRef.current, p.shape, p.x, ny + 1)) ny++; pieceRef.current = { ...p, y: ny }; step(); break }
      }
      draw()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [started, gameOver, step, draw])

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const xp = Math.floor(score * 0.5)
  const best = highScores['nimtris'] ?? 0

  return (
    <GameShell
      theme={T}
      onExit={onExit}
      hud={[
        { label: 'LINES', value: lines },
        { label: 'LV', value: level },
        { label: 'SCORE', value: score },
      ]}
    >
      <div
        className="flex items-center justify-center h-full"
        onTouchStart={e => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchEnd={e => {
          if (!touchStart.current || !started || gameOver) return
          const dx = e.changedTouches[0].clientX - touchStart.current.x
          const dy = e.changedTouches[0].clientY - touchStart.current.y
          const p = pieceRef.current
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 20 && !collides(boardRef.current, p.shape, p.x + 1, p.y)) pieceRef.current = { ...p, x: p.x + 1 }
            if (dx < -20 && !collides(boardRef.current, p.shape, p.x - 1, p.y)) pieceRef.current = { ...p, x: p.x - 1 }
          } else {
            if (dy > 20) step()
            if (dy < -20) { const rot = rotate(p.shape); if (!collides(boardRef.current, rot, p.x, p.y)) pieceRef.current = { ...p, shape: rot } }
          }
          draw(); touchStart.current = null
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: COLS * BLOCK, height: ROWS * BLOCK, border: `1px solid ${T.surface}` }}
        />
      </div>

      {!started && !gameOver && <StartOverlay theme={T} onStart={startGame} />}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={score} onRestart={startGame} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'LINES', value: lines }, { label: 'LEVEL', value: level }]}
        />
      )}
    </GameShell>
  )
}
