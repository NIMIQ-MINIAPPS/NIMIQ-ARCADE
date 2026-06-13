import { useRef, useEffect, useCallback, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('runner')
const W = 380, H = 480, GRAVITY = 0.6, JUMP = -13, GROUND = H - 80

export default function RunnerGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [gameOver, setGameOver] = useState(false)
  const [dist, setDist] = useState(0)
  const [started, setStarted] = useState(false)

  const player = useRef({ y: GROUND - 24, vy: 0, jumps: 0 })
  const obstacles = useRef<{ x: number; w: number; h: number }[]>([])
  const distRef = useRef(0)
  const speedRef = useRef(4)
  const animRef = useRef(0)
  const isRunning = useRef(false)

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#0C1020')
    grad.addColorStop(1, T.bg)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = `${T.accent}50`
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke()

    const p = player.current
    ctx.save()
    ctx.translate(60, p.y)
    ctx.fillStyle = T.accent
    ctx.beginPath()
    ctx.moveTo(14, 0); ctx.lineTo(28, 7); ctx.lineTo(28, 17)
    ctx.lineTo(14, 24); ctx.lineTo(0, 17); ctx.lineTo(0, 7)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.beginPath()
    ctx.moveTo(14, 0); ctx.lineTo(28, 7); ctx.lineTo(14, 14); ctx.lineTo(0, 7)
    ctx.closePath(); ctx.fill()
    ctx.restore()

    ctx.fillStyle = '#1F2348'
    obstacles.current.forEach(o => {
      ctx.fillRect(o.x, GROUND - o.h, o.w, o.h)
      ctx.strokeStyle = '#2E3565'
      ctx.strokeRect(o.x, GROUND - o.h, o.w, o.h)
    })

    ctx.fillStyle = T.hudText
    ctx.font = 'bold 16px system-ui'
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.floor(distRef.current)}m`, W - 16, 28)
  }, [])

  const gameLoop = useCallback(() => {
    if (!isRunning.current) return
    const p = player.current
    p.vy += GRAVITY; p.y += p.vy
    if (p.y >= GROUND - 24) { p.y = GROUND - 24; p.vy = 0; p.jumps = 0 }

    speedRef.current = Math.min(10, 4 + distRef.current / 200)
    distRef.current += speedRef.current / 10
    setDist(Math.floor(distRef.current))

    if (obstacles.current.length === 0 || obstacles.current[obstacles.current.length - 1].x < W - 200) {
      if (Math.random() < 0.03) {
        obstacles.current.push({ x: W, w: 30 + Math.random() * 20, h: 30 + Math.random() * 60 })
      }
    }
    obstacles.current.forEach(o => { o.x -= speedRef.current })
    obstacles.current = obstacles.current.filter(o => o.x + o.w > -10)

    const px = 60, py = p.y, pw = 28, ph = 24
    for (const o of obstacles.current) {
      if (px + pw > o.x && px < o.x + o.w && py + ph > GROUND - o.h) {
        isRunning.current = false
        addXp(Math.floor(distRef.current))
        setHighScore('runner', Math.floor(distRef.current))
        setDist(Math.floor(distRef.current))
        setGameOver(true)
        draw()
        return
      }
    }
    draw()
    animRef.current = requestAnimationFrame(gameLoop)
  }, [draw, addXp, setHighScore])

  const jump = useCallback(() => {
    if (!isRunning.current) return
    const p = player.current
    if (p.jumps < 2) { p.vy = JUMP; p.jumps++ }
  }, [])

  const start = useCallback(() => {
    player.current = { y: GROUND - 24, vy: 0, jumps: 0 }
    obstacles.current = []; distRef.current = 0; speedRef.current = 4
    setDist(0); setGameOver(false); setStarted(true)
    isRunning.current = true
    gameLoop()
  }, [gameLoop])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    draw()
    return () => { isRunning.current = false; cancelAnimationFrame(animRef.current) }
  }, [draw])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'ArrowUp') && started && !gameOver) {
        e.preventDefault(); jump()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [started, gameOver, jump])

  const best = highScores['runner'] ?? 0
  const xp = Math.floor(dist)

  return (
    <GameShell theme={T} onExit={onExit} hud={[{ label: 'DIST', value: `${dist}m` }]}>
      <div className="flex items-center justify-center h-full"
        onClick={() => started && !gameOver && jump()}
        onTouchStart={e => { e.preventDefault(); started && !gameOver && jump() }}
      >
        <canvas ref={canvasRef} style={{ width: W, height: H }} />
      </div>

      {!started && !gameOver && <StartOverlay theme={T} onStart={start} />}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={dist} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={dist > 0 && dist >= best}
        />
      )}
    </GameShell>
  )
}
