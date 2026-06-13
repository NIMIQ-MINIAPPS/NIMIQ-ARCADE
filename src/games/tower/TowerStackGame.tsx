import { useRef, useEffect, useCallback, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('tower-stack')
const W = 380, H = 560, BLOCK_H = 24

interface Block { x: number; y: number; w: number; h: number }

export default function TowerStackGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [started, setStarted] = useState(false)
  const [perfect, setPerfect] = useState(0)

  const tower = useRef<Block[]>([])
  const moving = useRef({ x: 0, w: 200, dir: 3 })
  const animRef = useRef(0)
  const isRunning = useRef(false)
  const scoreRef = useRef(0)
  const perfectRef = useRef(0)
  const cameraY = useRef(0)

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#1A0E2E')
    grad.addColorStop(1, T.bg)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    const cam = cameraY.current
    tower.current.forEach((b, i) => {
      const t = 1 - i / Math.max(tower.current.length, 1)
      ctx.fillStyle = `hsl(43, ${40 + t * 30}%, ${38 + t * 18}%)`
      ctx.fillRect(b.x, b.y - cam, b.w, b.h - 1)
      ctx.strokeStyle = `hsl(43, ${30 + t * 20}%, ${30 + t * 12}%)`
      ctx.lineWidth = 0.5
      ctx.strokeRect(b.x, b.y - cam, b.w, b.h - 1)
    })

    if (isRunning.current) {
      const m = moving.current
      const y = H - (tower.current.length + 1) * BLOCK_H - cam
      ctx.fillStyle = T.accent
      ctx.fillRect(m.x, y, m.w, BLOCK_H - 1)
      ctx.strokeStyle = '#C49210'
      ctx.lineWidth = 0.5
      ctx.strokeRect(m.x, y, m.w, BLOCK_H - 1)
    }
  }, [])

  const gameLoop = useCallback(() => {
    if (!isRunning.current) return
    const m = moving.current
    m.x += m.dir
    if (m.x + m.w > W) { m.x = W - m.w; m.dir = -Math.abs(m.dir) }
    if (m.x < 0) { m.x = 0; m.dir = Math.abs(m.dir) }
    const towerTop = tower.current.length > 0
      ? tower.current[tower.current.length - 1].y - BLOCK_H : H - BLOCK_H
    if (towerTop < H * 0.4) cameraY.current = (H - BLOCK_H) - towerTop - H * 0.6
    draw()
    animRef.current = requestAnimationFrame(gameLoop)
  }, [draw])

  const dropBlock = useCallback(() => {
    if (!isRunning.current) return
    const m = moving.current
    const y = H - (tower.current.length + 1) * BLOCK_H
    if (tower.current.length === 0) {
      tower.current.push({ x: m.x, y, w: m.w, h: BLOCK_H })
      scoreRef.current++; perfectRef.current++
      setScore(scoreRef.current); setPerfect(perfectRef.current)
    } else {
      const prev = tower.current[tower.current.length - 1]
      const start = Math.max(m.x, prev.x)
      const end = Math.min(m.x + m.w, prev.x + prev.w)
      const ow = end - start
      if (ow <= 0) {
        isRunning.current = false
        addXp(Math.floor(scoreRef.current * 2))
        setHighScore('tower-stack', scoreRef.current)
        setScore(scoreRef.current); setGameOver(true); draw(); return
      }
      const isPerfect = Math.abs(ow - prev.w) < 3
      tower.current.push(isPerfect ? { x: prev.x, y, w: prev.w, h: BLOCK_H } : { x: start, y, w: ow, h: BLOCK_H })
      if (isPerfect) { perfectRef.current++; setPerfect(perfectRef.current) }
      else { perfectRef.current = 0; setPerfect(0) }
      scoreRef.current++; setScore(scoreRef.current)
      moving.current = { x: 0, w: isPerfect ? prev.w : ow, dir: 3 + scoreRef.current * 0.15 }
    }
  }, [addXp, setHighScore, draw])

  const start = useCallback(() => {
    tower.current = []; moving.current = { x: 0, w: 200, dir: 3 }
    scoreRef.current = 0; perfectRef.current = 0; cameraY.current = 0
    setScore(0); setPerfect(0); setGameOver(false); setStarted(true)
    isRunning.current = true; gameLoop()
  }, [gameLoop])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    draw()
    return () => { isRunning.current = false; cancelAnimationFrame(animRef.current) }
  }, [draw])

  const best = highScores['tower-stack'] ?? 0
  const xp = Math.floor(score * 2)

  return (
    <GameShell theme={T} onExit={onExit} hud={[
      { label: 'HEIGHT', value: score },
      ...(perfect > 2 ? [{ label: 'PERFECT', value: `×${perfect}`, color: T.accent }] : []),
    ]}>
      <div className="flex items-center justify-center h-full"
        onClick={() => { if (!started) start(); else if (!gameOver) dropBlock() }}
      >
        <canvas ref={canvasRef} style={{ width: W, height: H }} />
      </div>
      {!started && !gameOver && <StartOverlay theme={T} onStart={start} />}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'BLOCKS', value: score }]}
        />
      )}
    </GameShell>
  )
}
