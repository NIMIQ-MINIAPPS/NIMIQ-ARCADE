import { useRef, useEffect, useCallback, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('snake-path')
const W = 380, H = 440, CELL = 20
const COLS = Math.floor(W / CELL), ROWS = Math.floor(H / CELL)

type Dir = 'up' | 'down' | 'left' | 'right'
type Pos = { x: number; y: number }

export default function SnakeGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [started, setStarted] = useState(false)

  const snake = useRef<Pos[]>([{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }])
  const dir = useRef<Dir>('right')
  const nextDir = useRef<Dir>('right')
  const food = useRef<Pos>({ x: 12, y: 10 })
  const scoreRef = useRef(0)
  const speedRef = useRef(150)
  const loopRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)
  const isRunning = useRef(false)

  const spawnFood = useCallback(() => {
    let pos: Pos
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
    } while (snake.current.some(s => s.x === pos.x && s.y === pos.y))
    food.current = pos
  }, [])

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = T.bg
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = T.gridLine
    for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke() }
    for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke() }

    const f = food.current
    ctx.shadowColor = T.accent + '80'
    ctx.shadowBlur = 8
    ctx.fillStyle = T.accent
    ctx.beginPath()
    ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    snake.current.forEach((seg, i) => {
      const t = 1 - i / snake.current.length
      if (i === 0) {
        ctx.shadowColor = T.accent + '60'
        ctx.shadowBlur = 6
        ctx.fillStyle = T.accent
      } else {
        ctx.fillStyle = `rgba(39,174,96,${0.25 + t * 0.65})`
      }
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2)
      ctx.shadowBlur = 0
    })
  }, [])

  const tick = useCallback(() => {
    if (!isRunning.current) return
    dir.current = nextDir.current
    const head = { ...snake.current[0] }
    if (dir.current === 'up') head.y--
    else if (dir.current === 'down') head.y++
    else if (dir.current === 'left') head.x--
    else head.x++

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
      snake.current.some(s => s.x === head.x && s.y === head.y)) {
      isRunning.current = false
      addXp(Math.floor(scoreRef.current * 0.5))
      setHighScore('snake-path', scoreRef.current)
      setScore(scoreRef.current)
      setGameOver(true)
      draw()
      return
    }
    snake.current.unshift(head)
    if (head.x === food.current.x && head.y === food.current.y) {
      scoreRef.current += 10
      setScore(scoreRef.current)
      spawnFood()
      if (speedRef.current > 60) speedRef.current -= 3
    } else {
      snake.current.pop()
    }
    draw()
    loopRef.current = setTimeout(tick, speedRef.current)
  }, [draw, spawnFood, addXp, setHighScore])

  const start = useCallback(() => {
    snake.current = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }]
    dir.current = 'right'; nextDir.current = 'right'
    scoreRef.current = 0; speedRef.current = 150
    setScore(0); setGameOver(false); setStarted(true)
    spawnFood(); isRunning.current = true; tick()
  }, [spawnFood, tick])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    draw()
    return () => { isRunning.current = false; clearTimeout(loopRef.current) }
  }, [draw])

  const turn = useCallback((d: Dir) => {
    const opp: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
    if (d !== opp[dir.current]) nextDir.current = d
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') turn('up')
      else if (e.key === 'ArrowDown') turn('down')
      else if (e.key === 'ArrowLeft') turn('left')
      else if (e.key === 'ArrowRight') turn('right')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [turn])

  const best = highScores['snake-path'] ?? 0
  const xp = Math.floor(score * 0.5)
  const btnStyle = { background: `${T.hudMuted}18`, color: T.hudText }

  return (
    <GameShell theme={T} onExit={onExit} hud={[{ label: 'LENGTH', value: snake.current.length }, { label: 'SCORE', value: score }]}>
      <div className="flex flex-col items-center justify-center h-full">
        <canvas ref={canvasRef} style={{ width: W, height: H, borderRadius: 8 }} />
        {started && !gameOver && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => turn('left')} className="w-14 h-12 rounded-xl font-black text-lg" style={btnStyle}>←</button>
            <div className="flex flex-col gap-1">
              <button onClick={() => turn('up')} className="w-14 h-5 rounded-md font-black text-xs" style={btnStyle}>↑</button>
              <button onClick={() => turn('down')} className="w-14 h-5 rounded-md font-black text-xs" style={btnStyle}>↓</button>
            </div>
            <button onClick={() => turn('right')} className="w-14 h-12 rounded-xl font-black text-lg" style={btnStyle}>→</button>
          </div>
        )}
      </div>
      {!started && !gameOver && <StartOverlay theme={T} onStart={start} />}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'LENGTH', value: snake.current.length }]}
        />
      )}
    </GameShell>
  )
}
