import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { ArrowLeft } from 'lucide-react'

const COLS = 10
const ROWS = 20
const BLOCK = 28

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
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const nr = y + r, nc = x + c
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return true
      if (board[nr][nc]) return true
    }
  }
  return false
}

function merge(board: Board, shape: number[][], x: number, y: number, color: string): Board {
  const b = board.map(r => [...r])
  shape.forEach((row, r) => row.forEach((v, c) => {
    if (v) b[y + r][x + c] = color
  }))
  return b
}

function clearLines(board: Board): { board: Board; lines: number } {
  const newBoard = board.filter(r => r.some(c => !c))
  const lines = ROWS - newBoard.length
  const empty = Array.from({ length: lines }, () => Array(COLS).fill(null))
  return { board: [...empty, ...newBoard], lines }
}

interface Props { onExit: () => void }

export default function NimtrisGame({ onExit }: Props) {
  const { addXp, setHighScore } = useGameStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)

  const boardRef = useRef<Board>(emptyBoard())
  const pieceRef = useRef(randomPiece())
  const nextPieceRef = useRef(randomPiece())
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const intervalRef = useRef<number>(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#080808'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grid
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 0.5
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK)
      }
    }

    // Board
    boardRef.current.forEach((row, r) => row.forEach((cell, c) => {
      if (cell) {
        ctx.fillStyle = cell
        ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2)
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, 4)
      }
    }))

    // Active piece
    const { shape, color, x, y } = pieceRef.current
    ctx.fillStyle = color
    shape.forEach((row, r) => row.forEach((v, c) => {
      if (v) {
        ctx.fillRect((x + c) * BLOCK + 1, (y + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2)
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        ctx.fillRect((x + c) * BLOCK + 1, (y + r) * BLOCK + 1, BLOCK - 2, 4)
        ctx.fillStyle = color
      }
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
        const xpEarned = Math.floor(scoreRef.current * 0.5)
        addXp(xpEarned)
        setHighScore('nimtris', scoreRef.current)
        return
      }
      boardRef.current = merge(boardRef.current, p.shape, p.x, p.y, p.color)
      const { board, lines: cleared } = clearLines(boardRef.current)
      boardRef.current = board

      if (cleared > 0) {
        comboRef.current++
        const pts = cleared === 4 ? 800 : cleared * 100
        const combo = comboRef.current > 1 ? pts + (comboRef.current - 1) * 50 : pts
        scoreRef.current += combo
        setScore(scoreRef.current)
        setLines(l => l + cleared)
      } else {
        comboRef.current = 0
      }

      pieceRef.current = { ...nextPieceRef.current, x: Math.floor(COLS / 2) - 1, y: 0 }
      nextPieceRef.current = randomPiece()
    }
    draw()
  }, [draw, addXp, setHighScore])

  const startGame = useCallback(() => {
    boardRef.current = emptyBoard()
    pieceRef.current = randomPiece()
    nextPieceRef.current = randomPiece()
    scoreRef.current = 0
    comboRef.current = 0
    setScore(0)
    setLines(0)
    setGameOver(false)
    setStarted(true)
    clearInterval(intervalRef.current)
    intervalRef.current = window.setInterval(step, 600)
  }, [step])

  useEffect(() => {
    if (started) draw()
  }, [started, draw])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!started || gameOver) return
      const p = pieceRef.current
      switch (e.key) {
        case 'ArrowLeft':
          if (!collides(boardRef.current, p.shape, p.x - 1, p.y))
            pieceRef.current = { ...p, x: p.x - 1 }
          break
        case 'ArrowRight':
          if (!collides(boardRef.current, p.shape, p.x + 1, p.y))
            pieceRef.current = { ...p, x: p.x + 1 }
          break
        case 'ArrowDown':
          step()
          break
        case 'ArrowUp': {
          const rot = rotate(p.shape)
          if (!collides(boardRef.current, rot, p.x, p.y))
            pieceRef.current = { ...p, shape: rot }
          break
        }
        case ' ': {
          let ny = p.y
          while (!collides(boardRef.current, p.shape, p.x, ny + 1)) ny++
          pieceRef.current = { ...p, y: ny }
          step()
          break
        }
      }
      draw()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [started, gameOver, step, draw])

  useEffect(() => () => clearInterval(intervalRef.current), [])

  // Touch controls
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current || !started || gameOver) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    const p = pieceRef.current
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 20 && !collides(boardRef.current, p.shape, p.x + 1, p.y))
        pieceRef.current = { ...p, x: p.x + 1 }
      if (dx < -20 && !collides(boardRef.current, p.shape, p.x - 1, p.y))
        pieceRef.current = { ...p, x: p.x - 1 }
    } else {
      if (dy > 20) step()
      if (dy < -20) {
        const rot = rotate(p.shape)
        if (!collides(boardRef.current, rot, p.x, p.y))
          pieceRef.current = { ...p, shape: rot }
      }
    }
    draw()
    touchStart.current = null
  }

  return (
    <div className="flex flex-col h-full bg-[#080808]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <button onClick={onExit} className="text-[#555] hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-black text-white tracking-widest text-sm">NIMTRIS</h2>
        <div className="text-right">
          <p className="text-[10px] text-[#555]">SCORE</p>
          <p className="font-black text-[#FFC107]">{score.toLocaleString()}</p>
        </div>
      </div>

      {/* Game area */}
      <div className="flex-1 flex items-center justify-center relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          width={COLS * BLOCK}
          height={ROWS * BLOCK}
          className="border border-[#222]"
        />

        {!started && !gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80"
          >
            <p className="text-4xl mb-2">🟦</p>
            <h3 className="text-xl font-black text-white mb-1">NIMTRIS</h3>
            <p className="text-[12px] text-[#555] mb-6">Clear lines to earn XP</p>
            <button onClick={startGame} className="px-8 py-3 bg-[#FFC107] text-[#080808] font-black rounded-xl glow-yellow">
              START GAME
            </button>
          </motion.div>
        )}

        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80"
          >
            <p className="text-3xl mb-2">💥</p>
            <h3 className="text-xl font-black text-white mb-1">GAME OVER</h3>
            <p className="text-[#FFC107] font-black text-2xl mb-1">{score.toLocaleString()}</p>
            <p className="text-[12px] text-[#555] mb-1">{lines} lines</p>
            <p className="text-[12px] text-[#888] mb-6">+{Math.floor(score * 0.5)} XP earned</p>
            <div className="flex gap-3">
              <button onClick={startGame} className="px-6 py-3 bg-[#FFC107] text-[#080808] font-black rounded-xl">
                PLAY AGAIN
              </button>
              <button onClick={onExit} className="px-6 py-3 bg-[#222] text-white font-black rounded-xl">
                EXIT
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Controls hint */}
      <div className="px-4 pb-4 flex justify-center gap-4">
        {['←→ Move', '↑ Rotate', '↓ Drop', 'Space Hard Drop'].map(h => (
          <span key={h} className="text-[10px] text-[#333]">{h}</span>
        ))}
      </div>
    </div>
  )
}
