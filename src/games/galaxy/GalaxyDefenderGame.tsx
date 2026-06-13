import { useRef, useEffect, useCallback, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('galaxy-defender')
const W = 380, H = 560
const SHIP_W = 28, SHIP_H = 20

interface Bullet { x: number; y: number }
interface Enemy { x: number; y: number; w: number; h: number; vx: number; vy: number; hp: number; color: string }

export default function GalaxyDefenderGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [wave, setWave] = useState(1)
  const [started, setStarted] = useState(false)
  const [lives, setLives] = useState(3)

  const shipX = useRef(W / 2)
  const bullets = useRef<Bullet[]>([])
  const enemies = useRef<Enemy[]>([])
  const eBullets = useRef<Bullet[]>([])
  const scoreRef = useRef(0)
  const waveRef = useRef(1)
  const livesRef = useRef(3)
  const animRef = useRef(0)
  const shootTimer = useRef(0)
  const spawnTimer = useRef(0)
  const isRunning = useRef(false)

  const ENEMY_COLORS = ['#C0675C', '#5B8DB8', '#5BAA7E', '#C4A24D', '#8B6BAD']

  const spawnWave = useCallback((w: number) => {
    const count = Math.min(3 + w * 2, 20)
    const cols = Math.min(count, 8)
    const rows = Math.ceil(count / cols)
    const spacing = 42
    const startX = (W - cols * spacing) / 2 + spacing / 2
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols && r * cols + c < count; c++) {
        enemies.current.push({
          x: startX + c * spacing, y: -40 - r * 36,
          w: 24, h: 18,
          vx: 0.5 + w * 0.1, vy: 0.3 + w * 0.05,
          hp: w >= 5 ? 2 : 1,
          color: ENEMY_COLORS[(r * cols + c) % ENEMY_COLORS.length],
        })
      }
    }
  }, [])

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#020218')
    grad.addColorStop(1, T.bg)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97 + Date.now() / 50) % W
      const sy = (i * 53 + Date.now() / 80) % H
      ctx.fillRect(sx, sy, 1, 1)
    }

    // Ship
    const sx = shipX.current
    ctx.fillStyle = T.accent
    ctx.beginPath()
    ctx.moveTo(sx, H - 60); ctx.lineTo(sx - SHIP_W / 2, H - 60 + SHIP_H)
    ctx.lineTo(sx + SHIP_W / 2, H - 60 + SHIP_H); ctx.closePath(); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.fillRect(sx - 2, H - 58, 4, SHIP_H - 4)

    // Player bullets
    ctx.fillStyle = T.accent
    bullets.current.forEach(b => { ctx.fillRect(b.x - 1.5, b.y, 3, 10) })

    // Enemy bullets
    ctx.fillStyle = T.danger
    eBullets.current.forEach(b => { ctx.fillRect(b.x - 1.5, b.y, 3, 8) })

    // Enemies
    enemies.current.forEach(e => {
      ctx.fillStyle = e.color
      ctx.fillRect(e.x - e.w / 2, e.y, e.w, e.h)
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(e.x - e.w / 2, e.y + e.h - 3, e.w, 3)
    })
  }, [])

  const gameLoop = useCallback(() => {
    if (!isRunning.current) return

    // Bullets
    bullets.current = bullets.current.map(b => ({ ...b, y: b.y - 8 })).filter(b => b.y > -10)
    eBullets.current = eBullets.current.map(b => ({ ...b, y: b.y + 4 })).filter(b => b.y < H + 10)

    // Auto shoot
    shootTimer.current++
    if (shootTimer.current % 12 === 0) {
      bullets.current.push({ x: shipX.current, y: H - 62 })
    }

    // Enemy movement
    let hitWall = false
    enemies.current.forEach(e => {
      e.x += e.vx
      if (e.y < 80) e.y += e.vy
      if (e.x < 20 || e.x > W - 20) hitWall = true
    })
    if (hitWall) {
      enemies.current.forEach(e => { e.vx *= -1; e.y += 8 })
    }

    // Enemy shooting
    if (Math.random() < 0.01 + waveRef.current * 0.005 && enemies.current.length > 0) {
      const shooter = enemies.current[Math.floor(Math.random() * enemies.current.length)]
      eBullets.current.push({ x: shooter.x, y: shooter.y + shooter.h })
    }

    // Bullet-enemy collision
    bullets.current = bullets.current.filter(b => {
      for (let i = enemies.current.length - 1; i >= 0; i--) {
        const e = enemies.current[i]
        if (b.x > e.x - e.w / 2 && b.x < e.x + e.w / 2 && b.y > e.y && b.y < e.y + e.h) {
          e.hp--
          if (e.hp <= 0) {
            enemies.current.splice(i, 1)
            scoreRef.current += 10 * waveRef.current
            setScore(scoreRef.current)
          }
          return false
        }
      }
      return true
    })

    // Enemy bullet-player collision
    const px = shipX.current
    eBullets.current = eBullets.current.filter(b => {
      if (b.x > px - SHIP_W / 2 && b.x < px + SHIP_W / 2 && b.y > H - 60 && b.y < H - 40) {
        livesRef.current--; setLives(livesRef.current)
        if (livesRef.current <= 0) {
          isRunning.current = false
          addXp(Math.floor(scoreRef.current * 0.3))
          setHighScore('galaxy-defender', scoreRef.current)
          setGameOver(true)
        }
        return false
      }
      return true
    })

    // Enemy reaches bottom
    for (const e of enemies.current) {
      if (e.y + e.h > H - 80) {
        isRunning.current = false
        addXp(Math.floor(scoreRef.current * 0.3))
        setHighScore('galaxy-defender', scoreRef.current)
        setGameOver(true)
        draw(); return
      }
    }

    // Wave clear
    if (enemies.current.length === 0) {
      waveRef.current++; setWave(waveRef.current)
      spawnWave(waveRef.current)
    }

    draw()
    animRef.current = requestAnimationFrame(gameLoop)
  }, [draw, spawnWave, addXp, setHighScore])

  const startGame = useCallback(() => {
    shipX.current = W / 2; bullets.current = []; enemies.current = []; eBullets.current = []
    scoreRef.current = 0; waveRef.current = 1; livesRef.current = 3
    shootTimer.current = 0; spawnTimer.current = 0
    setScore(0); setWave(1); setLives(3); setGameOver(false); setStarted(true)
    isRunning.current = true
    spawnWave(1); gameLoop()
  }, [gameLoop, spawnWave])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr; draw()
    return () => { isRunning.current = false; cancelAnimationFrame(animRef.current) }
  }, [draw])

  const handleMove = useCallback((cx: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    shipX.current = Math.max(20, Math.min(W - 20, ((cx - rect.left) / rect.width) * W))
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

  const best = highScores['galaxy-defender'] ?? 0
  const xp = Math.floor(score * 0.3)

  return (
    <GameShell theme={T} onExit={onExit} hud={[
      { label: 'WAVE', value: wave },
      { label: 'SCORE', value: score },
    ]} hudRight={
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-[9px] tracking-widest font-semibold" style={{ color: T.hudMuted }}>SCORE</p>
          <p className="font-black text-[15px] leading-none" style={{ color: T.accent }}>{score.toLocaleString()}</p>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: i < lives ? T.accent : `${T.hudMuted}30` }} />
          ))}
        </div>
      </div>
    }>
      <div className="flex items-center justify-center h-full">
        <canvas ref={canvasRef} style={{ width: W, height: H }} />
      </div>
      {!started && !gameOver && <StartOverlay theme={T} onStart={startGame} />}
      {gameOver && (
        <GameOverOverlay theme={T} score={score} onRestart={startGame} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'WAVE', value: wave }, { label: 'LIVES', value: livesRef.current }]} />
      )}
    </GameShell>
  )
}
