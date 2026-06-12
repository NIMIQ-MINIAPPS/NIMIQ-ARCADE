import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { ArrowLeft } from 'lucide-react'

const W = 380
const H = 480
const GROUND = H - 60
const GRAVITY = 0.6
const JUMP_FORCE = -13
const OBSTACLE_W = 18
const PLAYER_W = 24
const PLAYER_H = 36

interface Obstacle {
  x: number
  h: number
  color: string
}

const OBS_COLORS = ['#4FC3F7', '#FFC107', '#CE93D8', '#F06292']

interface Props { onExit: () => void }

export default function RunnerGame({ onExit }: Props) {
  const { addXp, setHighScore } = useGameStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)

  const playerY = useRef(GROUND - PLAYER_H)
  const velY = useRef(0)
  const obstacles = useRef<Obstacle[]>([])
  const speed = useRef(4)
  const dist = useRef(0)
  const frameRef = useRef<number>(0)
  const spawnCounter = useRef(0)
  const isRunning = useRef(false)

  const jump = useCallback(() => {
    if (playerY.current >= GROUND - PLAYER_H - 2) {
      velY.current = JUMP_FORCE
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#080808'
    ctx.fillRect(0, 0, W, H)

    // Ground
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, GROUND, W, H - GROUND)
    ctx.fillStyle = '#FFC107'
    ctx.fillRect(0, GROUND, W, 2)

    // Player (hex shape simplified)
    const px = 60
    const py = playerY.current
    ctx.fillStyle = '#FFC107'
    ctx.beginPath()
    ctx.roundRect(px, py, PLAYER_W, PLAYER_H, 4)
    ctx.fill()
    ctx.fillStyle = '#080808'
    ctx.beginPath()
    ctx.arc(px + PLAYER_W / 2, py + 10, 5, 0, Math.PI * 2)
    ctx.fill()

    // Obstacles
    obstacles.current.forEach(ob => {
      ctx.fillStyle = ob.color
      ctx.beginPath()
      ctx.roundRect(ob.x, GROUND - ob.h, OBSTACLE_W, ob.h, 3)
      ctx.fill()
      ctx.fillStyle = ob.color + '60'
      ctx.fillRect(ob.x - 3, GROUND - ob.h - 3, OBSTACLE_W + 6, 3)
    })

    // Score overlay
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(8, 8, 120, 26)
    ctx.fillStyle = '#FFC107'
    ctx.font = 'bold 13px monospace'
    ctx.fillText(`${Math.floor(dist.current)}m`, 14, 26)
  }, [])

  const loop = useCallback(() => {
    if (!isRunning.current) return

    // Physics
    velY.current += GRAVITY
    playerY.current += velY.current
    if (playerY.current >= GROUND - PLAYER_H) {
      playerY.current = GROUND - PLAYER_H
      velY.current = 0
    }

    // Obstacles
    spawnCounter.current++
    const spawnRate = Math.max(50, 100 - Math.floor(dist.current / 50))
    if (spawnCounter.current >= spawnRate) {
      spawnCounter.current = 0
      const h = 30 + Math.random() * 40
      obstacles.current.push({
        x: W + 20,
        h,
        color: OBS_COLORS[Math.floor(Math.random() * OBS_COLORS.length)],
      })
    }

    // Move obstacles
    speed.current = Math.min(10, 4 + dist.current / 200)
    obstacles.current = obstacles.current
      .map(ob => ({ ...ob, x: ob.x - speed.current }))
      .filter(ob => ob.x > -OBSTACLE_W - 5)

    // Collision
    const px = 60
    const py = playerY.current
    for (const ob of obstacles.current) {
      if (
        px + PLAYER_W - 4 > ob.x + 2 &&
        px + 4 < ob.x + OBSTACLE_W - 2 &&
        py + PLAYER_H - 4 > GROUND - ob.h
      ) {
        isRunning.current = false
        setGameOver(true)
        const xp = Math.floor(dist.current)
        addXp(xp)
        setHighScore('runner', Math.floor(dist.current))
        return
      }
    }

    dist.current += speed.current / 10
    setScore(Math.floor(dist.current))
    draw()
    frameRef.current = requestAnimationFrame(loop)
  }, [draw, addXp, setHighScore])

  const startGame = useCallback(() => {
    playerY.current = GROUND - PLAYER_H
    velY.current = 0
    obstacles.current = []
    speed.current = 4
    dist.current = 0
    spawnCounter.current = 0
    isRunning.current = true
    setScore(0)
    setGameOver(false)
    setStarted(true)
    cancelAnimationFrame(frameRef.current!)
    frameRef.current = requestAnimationFrame(loop)
  }, [loop])

  useEffect(() => () => {
    isRunning.current = false
    cancelAnimationFrame(frameRef.current!)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'ArrowUp') && started && !gameOver) {
        e.preventDefault()
        jump()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [started, gameOver, jump])

  const handleTap = () => {
    if (started && !gameOver) jump()
  }

  return (
    <div className="flex flex-col h-full bg-[#080808]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <button onClick={onExit} className="text-[#555]"><ArrowLeft size={20} /></button>
        <h2 className="font-black text-white tracking-widest text-sm">HEX RUNNER</h2>
        <div className="text-right">
          <p className="text-[10px] text-[#555]">DISTANCE</p>
          <p className="font-black text-[#FFC107]">{score}m</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative">
        <canvas
          ref={canvasRef}
          width={W * (window.devicePixelRatio || 1)}
          height={H * (window.devicePixelRatio || 1)}
          style={{ width: W, height: H }}
          onClick={handleTap}
          onTouchStart={handleTap}
          className="cursor-pointer"
        />

        {!started && !gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80"
          >
            <p className="text-4xl mb-2">🏃</p>
            <h3 className="text-xl font-black text-white mb-1">HEX RUNNER</h3>
            <p className="text-[12px] text-[#555] mb-6">Tap to jump over obstacles</p>
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
            <h3 className="text-xl font-black text-white mb-1">CRASHED!</h3>
            <p className="text-[#FFC107] font-black text-2xl mb-1">{score}m</p>
            <p className="text-[12px] text-[#888] mb-6">+{score} XP earned</p>
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

      <p className="text-center text-[11px] text-[#333] pb-3">TAP or SPACE to jump</p>
    </div>
  )
}
