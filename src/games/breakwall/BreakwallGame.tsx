import { useRef, useEffect, useCallback, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('breakwall')
const W = 380, H = 520, PAD_W = 80, PAD_H = 12, BALL_R = 5
const BRICK_ROWS = 5, BRICK_COLS = 10
const BRICK_W = (W - 20) / BRICK_COLS, BRICK_H = 16, BRICK_TOP = 40
const ROW_COLORS = ['#C0675C', '#C48B5A', '#C4A24D', '#5BAA7E', '#5B8DB8']

export default function BreakwallGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [started, setStarted] = useState(false)
  const [lives, setLives] = useState(3)

  const padX = useRef(W / 2 - PAD_W / 2)
  const ball = useRef({ x: W / 2, y: H - 70, vx: 3, vy: -4 })
  const bricks = useRef<(number | null)[][]>([])
  const scoreRef = useRef(0), livesRef = useRef(3)
  const animRef = useRef(0)
  const isRunning = useRef(false), launched = useRef(false)

  const initBricks = useCallback(() => {
    bricks.current = Array.from({ length: BRICK_ROWS }, () => Array.from({ length: BRICK_COLS }, () => 1))
  }, [])

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = T.bg
    ctx.fillRect(0, 0, W, H)

    bricks.current.forEach((row, r) => row.forEach((brick, c) => {
      if (brick === null) return
      const x = 10 + c * BRICK_W + 1, y = BRICK_TOP + r * (BRICK_H + 1)
      ctx.fillStyle = ROW_COLORS[r]
      ctx.beginPath(); ctx.roundRect(x, y, BRICK_W - 2, BRICK_H, 3); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(x, y, BRICK_W - 2, 3)
    }))

    ctx.fillStyle = T.accent
    ctx.beginPath(); ctx.roundRect(padX.current, H - 50, PAD_W, PAD_H, 6); ctx.fill()

    const b = ball.current
    ctx.fillStyle = T.hudText
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill()
  }, [])

  const gameLoop = useCallback(() => {
    if (!isRunning.current) return
    const b = ball.current
    if (!launched.current) {
      b.x = padX.current + PAD_W / 2; b.y = H - 62; draw()
      animRef.current = requestAnimationFrame(gameLoop); return
    }
    b.x += b.vx; b.y += b.vy
    if (b.x - BALL_R < 0 || b.x + BALL_R > W) b.vx *= -1
    if (b.y - BALL_R < 0) b.vy *= -1
    if (b.vy > 0 && b.y + BALL_R >= H - 50 && b.y + BALL_R <= H - 38 &&
      b.x >= padX.current && b.x <= padX.current + PAD_W) {
      b.vy = -Math.abs(b.vy); b.vx += (b.x - (padX.current + PAD_W / 2)) * 0.1
    }
    for (let r = 0; r < BRICK_ROWS; r++) for (let c = 0; c < BRICK_COLS; c++) {
      if (bricks.current[r][c] === null) continue
      const bx = 10 + c * BRICK_W + 1, by = BRICK_TOP + r * (BRICK_H + 1)
      if (b.x + BALL_R > bx && b.x - BALL_R < bx + BRICK_W - 2 && b.y + BALL_R > by && b.y - BALL_R < by + BRICK_H) {
        bricks.current[r][c] = null; b.vy *= -1
        scoreRef.current += (BRICK_ROWS - r) * 10; setScore(scoreRef.current)
        if (bricks.current.every(row => row.every(b => b === null))) {
          isRunning.current = false; scoreRef.current += 500; setScore(scoreRef.current)
          addXp(Math.floor(scoreRef.current * 0.3)); setHighScore('breakwall', scoreRef.current)
          setGameOver(true); draw(); return
        }
        break
      }
    }
    if (b.y > H + 20) {
      livesRef.current--; setLives(livesRef.current)
      if (livesRef.current <= 0) {
        isRunning.current = false; addXp(Math.floor(scoreRef.current * 0.3))
        setHighScore('breakwall', scoreRef.current); setGameOver(true); draw(); return
      }
      launched.current = false; ball.current = { x: padX.current + PAD_W / 2, y: H - 62, vx: 3, vy: -4 }
    }
    draw(); animRef.current = requestAnimationFrame(gameLoop)
  }, [draw, addXp, setHighScore])

  const start = useCallback(() => {
    initBricks(); padX.current = W / 2 - PAD_W / 2
    ball.current = { x: W / 2, y: H - 62, vx: 3, vy: -4 }
    scoreRef.current = 0; livesRef.current = 3; launched.current = false
    setScore(0); setLives(3); setGameOver(false); setStarted(true)
    isRunning.current = true; gameLoop()
  }, [initBricks, gameLoop])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr; initBricks(); draw()
    return () => { isRunning.current = false; cancelAnimationFrame(animRef.current) }
  }, [draw, initBricks])

  const handleMove = useCallback((cx: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    padX.current = Math.max(0, Math.min(W - PAD_W, ((cx - rect.left) / rect.width) * W - PAD_W / 2))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onM = (e: MouseEvent) => handleMove(e.clientX)
    const onT = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX) }
    canvas.addEventListener('mousemove', onM)
    canvas.addEventListener('touchmove', onT, { passive: false })
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleMove(e.touches[0].clientX) }, { passive: false })
    return () => { canvas.removeEventListener('mousemove', onM); canvas.removeEventListener('touchmove', onT) }
  }, [handleMove])

  const best = highScores['breakwall'] ?? 0
  const xp = Math.floor(score * 0.3)

  return (
    <GameShell theme={T} onExit={onExit} hudRight={
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-[9px] tracking-widest font-semibold" style={{ color: T.hudMuted }}>SCORE</p>
          <p className="font-black text-[15px] leading-none" style={{ color: T.accent }}>{score.toLocaleString()}</p>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: i < lives ? T.danger : `${T.hudMuted}30` }} />
          ))}
        </div>
      </div>
    }>
      <div className="flex items-center justify-center h-full"
        onClick={() => { if (!started) start(); else if (!launched.current && isRunning.current) launched.current = true }}
      >
        <canvas ref={canvasRef} style={{ width: W, height: H }} />
      </div>
      {!started && !gameOver && <StartOverlay theme={T} onStart={start} />}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          won={livesRef.current > 0} title={livesRef.current > 0 ? 'CLEARED!' : 'GAME OVER'}
        />
      )}
    </GameShell>
  )
}
