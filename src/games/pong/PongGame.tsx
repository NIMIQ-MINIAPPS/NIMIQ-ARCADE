import { useRef, useEffect, useCallback, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, GameOverOverlay, StartOverlay } from '../../components/games/GameShell'

const T = getGameTheme('pong-duel')
const W = 380, H = 560, PAD_W = 80, PAD_H = 10, BALL_S = 10, WIN = 7

export default function PongGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)
  const [pScore, setPScore] = useState(0)
  const [aScore, setAScore] = useState(0)
  const [won, setWon] = useState(false)

  const playerX = useRef(W / 2 - PAD_W / 2)
  const aiX = useRef(W / 2 - PAD_W / 2)
  const ball = useRef({ x: W / 2, y: H / 2, vx: 3, vy: 3 })
  const ps = useRef(0), as_ = useRef(0)
  const animRef = useRef(0)
  const isRunning = useRef(false)

  const resetBall = useCallback((toPlayer: boolean) => {
    ball.current = { x: W / 2, y: H / 2, vx: (Math.random() > 0.5 ? 1 : -1) * 3, vy: toPlayer ? 3 : -3 }
  }, [])

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = T.bg
    ctx.fillRect(0, 0, W, H)

    ctx.setLineDash([8, 8])
    ctx.strokeStyle = T.gridLine
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = T.accent
    ctx.beginPath(); ctx.roundRect(playerX.current, H - 50, PAD_W, PAD_H, 5); ctx.fill()
    ctx.fillStyle = T.hudMuted
    ctx.beginPath(); ctx.roundRect(aiX.current, 40, PAD_W, PAD_H, 5); ctx.fill()

    const b = ball.current
    ctx.fillStyle = T.hudText
    ctx.fillRect(b.x - BALL_S / 2, b.y - BALL_S / 2, BALL_S, BALL_S)

    ctx.fillStyle = T.hudMuted
    ctx.font = 'bold 32px system-ui'; ctx.textAlign = 'center'
    ctx.fillText(`${as_.current}`, W / 2, H / 2 - 20)
    ctx.fillStyle = T.hudText
    ctx.fillText(`${ps.current}`, W / 2, H / 2 + 48)
  }, [])

  const finish = useCallback(() => {
    const sc = ps.current * 100
    addXp(Math.floor(sc * 0.3))
    setHighScore('pong-duel', sc)
    setGameOver(true)
  }, [addXp, setHighScore])

  const gameLoop = useCallback(() => {
    if (!isRunning.current) return
    const b = ball.current
    b.x += b.vx; b.y += b.vy
    if (b.x < BALL_S / 2 || b.x > W - BALL_S / 2) b.vx *= -1
    if (b.vy > 0 && b.y + BALL_S / 2 >= H - 50 && b.y + BALL_S / 2 <= H - 40 &&
      b.x >= playerX.current && b.x <= playerX.current + PAD_W) {
      b.vy *= -1; b.vx += (b.x - (playerX.current + PAD_W / 2)) * 0.08; b.vy *= 1.03
    }
    if (b.vy < 0 && b.y - BALL_S / 2 <= 50 && b.y - BALL_S / 2 >= 40 &&
      b.x >= aiX.current && b.x <= aiX.current + PAD_W) {
      b.vy *= -1; b.vy *= 1.03
    }
    const ac = aiX.current + PAD_W / 2
    const spd = 2.5 + Math.min(ps.current, 5) * 0.3
    if (b.x < ac - 5) aiX.current -= spd
    else if (b.x > ac + 5) aiX.current += spd
    aiX.current = Math.max(0, Math.min(W - PAD_W, aiX.current))

    if (b.y > H) {
      as_.current++; setAScore(as_.current)
      if (as_.current >= WIN) { isRunning.current = false; setWon(false); finish(); return }
      resetBall(true)
    }
    if (b.y < 0) {
      ps.current++; setPScore(ps.current)
      if (ps.current >= WIN) { isRunning.current = false; setWon(true); finish(); return }
      resetBall(false)
    }
    draw(); animRef.current = requestAnimationFrame(gameLoop)
  }, [draw, resetBall, finish])

  const start = useCallback(() => {
    ps.current = 0; as_.current = 0; setPScore(0); setAScore(0)
    setGameOver(false); setStarted(true); setWon(false)
    playerX.current = W / 2 - PAD_W / 2; aiX.current = W / 2 - PAD_W / 2
    resetBall(true); isRunning.current = true; gameLoop()
  }, [gameLoop, resetBall])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr; draw()
    return () => { isRunning.current = false; cancelAnimationFrame(animRef.current) }
  }, [draw])

  const handleMove = useCallback((clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    playerX.current = Math.max(0, Math.min(W - PAD_W, ((clientX - rect.left) / rect.width) * W - PAD_W / 2))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onM = (e: MouseEvent) => handleMove(e.clientX)
    const onT = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX) }
    const onTS = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX) }
    canvas.addEventListener('mousemove', onM)
    canvas.addEventListener('touchmove', onT, { passive: false })
    canvas.addEventListener('touchstart', onTS, { passive: false })
    return () => { canvas.removeEventListener('mousemove', onM); canvas.removeEventListener('touchmove', onT) }
  }, [handleMove])

  const sc = pScore * 100
  const best = highScores['pong-duel'] ?? 0

  return (
    <GameShell theme={T} onExit={onExit} hud={[
      { label: 'YOU', value: pScore, color: T.accent },
      { label: 'AI', value: aScore, color: T.hudMuted },
    ]}>
      <div className="flex items-center justify-center h-full">
        <canvas ref={canvasRef} style={{ width: W, height: H }} />
      </div>
      {!started && !gameOver && <StartOverlay theme={T} onStart={start} />}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={sc} onRestart={start} onExit={onExit}
          xpEarned={Math.floor(sc * 0.3)} isNewBest={sc > 0 && sc >= best}
          won={won}
          stats={[{ label: 'YOU', value: pScore }, { label: 'AI', value: aScore }]}
        />
      )}
    </GameShell>
  )
}
