import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'

const BG = '#FFF9E8'
const CW = 380
type Dir = [number, number]
const UP: Dir = [0, -1], DOWN: Dir = [0, 1], LEFT: Dir = [-1, 0], RIGHT: Dir = [1, 0], NONE: Dir = [0, 0]
const GHOST_COLORS = ['#FF6B6B', '#C4B5FD', '#4CC9F0', '#F5B942', '#86EFAC']

interface Ghost { x: number; y: number; dir: Dir; color: string; frightened: boolean; eaten: boolean; homeX: number; homeY: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }

function mazeParams(level: number) {
  const cells = Math.min(6 + Math.floor(level / 2), 16)
  const ghostCount = Math.min(2 + Math.floor((level - 1) / 2), 8)
  const tickMs = Math.max(80, 165 - level * 5)
  const frightMs = Math.max(2200, 7000 - level * 300)
  return { cells, ghostCount, tickMs, frightMs }
}

function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5) }

function generateMaze(cellsX: number, cellsY: number): number[][] {
  const W = 2 * cellsX + 1, H = 2 * cellsY + 1
  const grid: number[][] = Array.from({ length: H }, () => Array(W).fill(1))
  const visited: boolean[][] = Array.from({ length: cellsY }, () => Array(cellsX).fill(false))
  const stack: [number, number][] = [[0, 0]]
  visited[0][0] = true
  grid[1][1] = 0
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]
    const dirs = shuffle([[0, -1], [0, 1], [-1, 0], [1, 0]])
    let moved = false
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy
      if (nx >= 0 && ny >= 0 && nx < cellsX && ny < cellsY && !visited[ny][nx]) {
        grid[2 * cy + 1 + dy][2 * cx + 1 + dx] = 0
        grid[2 * ny + 1][2 * nx + 1] = 0
        visited[ny][nx] = true
        stack.push([nx, ny])
        moved = true
        break
      }
    }
    if (!moved) stack.pop()
  }
  return grid
}

function isOpen(grid: number[][], x: number, y: number) { return grid[y]?.[x] === 0 }

let _ac: AudioContext | null = null
function snd(type: 'pellet' | 'power' | 'eatGhost' | 'hurt' | 'levelup' | 'over') {
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
    if (type === 'pellet')   n(820, t, 0.04, 0.03, 'square')
    if (type === 'power')    [500, 700, 900].forEach((f, i) => n(f, t + i * 0.05, 0.1, 0.06))
    if (type === 'eatGhost') [700, 1000, 1300].forEach((f, i) => n(f, t + i * 0.04, 0.08, 0.07))
    if (type === 'hurt')     n(180, t, 0.22, 0.15, 'sawtooth')
    if (type === 'levelup')  [600, 800, 1050, 1350].forEach((f, i) => n(f, t + i * 0.06, 0.11, 0.07))
    if (type === 'over')     { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

export default function PacMazeGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(3)
  const [levelMsg, setLevelMsg] = useState<string | null>(null)

  const grid = useRef<number[][]>([])
  const pellets = useRef<Set<string>>(new Set())
  const powerPellets = useRef<Set<string>>(new Set())
  const player = useRef({ x: 1, y: 1, dir: NONE as Dir, desired: NONE as Dir })
  const ghosts = useRef<Ghost[]>([])
  const parts = useRef<Particle[]>([])
  const frightTimer = useRef(0), ghostChain = useRef(0)
  const alive = useRef(false), raf = useRef(0)
  const scoreRef = useRef(0), levelRef = useRef(1), livesRef = useRef(3)
  const lastTick = useRef(0)
  const cellPx = useRef(16)

  const burst = useCallback((x: number, y: number, color: string) => {
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 / 10) * i
      parts.current.push({ x, y, vx: Math.cos(a) * (1 + Math.random() * 2), vy: Math.sin(a) * (1 + Math.random() * 2), life: 22, maxLife: 22, color })
    }
  }, [])

  const setupLevel = useCallback((lvl: number) => {
    const { cells, ghostCount } = mazeParams(lvl)
    const g = generateMaze(cells, cells)
    grid.current = g
    cellPx.current = CW / g[0].length
    pellets.current = new Set()
    powerPellets.current = new Set()
    const openCells: [number, number][] = []
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (g[y][x] === 0) openCells.push([x, y])
    openCells.forEach(([x, y]) => { if (!(x === 1 && y === 1)) pellets.current.add(`${x},${y}`) })
    const corners = shuffle(openCells.filter(([x, y]) => (x > g[0].length - 6 || y > g.length - 6))).slice(0, 4)
    corners.forEach(([x, y]) => { pellets.current.delete(`${x},${y}`); powerPellets.current.add(`${x},${y}`) })
    player.current = { x: 1, y: 1, dir: NONE, desired: NONE }
    const gx = Math.floor(g[0].length / 2) | 1, gy = Math.floor(g.length / 2) | 1
    ghosts.current = Array.from({ length: ghostCount }, (_, i) => ({
      x: gx, y: gy, dir: NONE, color: GHOST_COLORS[i % GHOST_COLORS.length], frightened: false, eaten: false, homeX: gx, homeY: gy,
    }))
    frightTimer.current = 0; ghostChain.current = 0
  }, [])

  const doEnd = useCallback(() => {
    alive.current = false
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.3))
    setHighScore('pac-maze', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const loseLife = useCallback(() => {
    livesRef.current--; setLives(livesRef.current)
    snd('hurt'); vibrate(35)
    if (livesRef.current <= 0) { doEnd(); return }
    player.current = { x: 1, y: 1, dir: NONE, desired: NONE }
    const { cells } = mazeParams(levelRef.current)
    const gx = Math.floor((2 * cells + 1) / 2) | 1, gy = Math.floor((2 * cells + 1) / 2) | 1
    ghosts.current.forEach((gh, i) => { gh.x = gx; gh.y = gy; gh.frightened = false; gh.eaten = false; gh.dir = NONE; void i })
  }, [doEnd])

  const step = useCallback(() => {
    const g = grid.current, p = player.current
    // player movement: try desired dir, else keep current
    if (p.desired !== NONE && isOpen(g, p.x + p.desired[0], p.y + p.desired[1])) p.dir = p.desired
    if (p.dir !== NONE && isOpen(g, p.x + p.dir[0], p.y + p.dir[1])) { p.x += p.dir[0]; p.y += p.dir[1] }
    else p.dir = NONE

    const key = `${p.x},${p.y}`
    if (pellets.current.has(key)) {
      pellets.current.delete(key)
      scoreRef.current += 10; setScore(scoreRef.current)
      snd('pellet'); vibrate(4)
    }
    if (powerPellets.current.has(key)) {
      powerPellets.current.delete(key)
      scoreRef.current += 50; setScore(scoreRef.current)
      snd('power'); vibrate([10, 15, 10])
      frightTimer.current = mazeParams(levelRef.current).frightMs
      ghostChain.current = 0
      ghosts.current.forEach(gh => { if (!gh.eaten) gh.frightened = true })
    }

    // ghosts
    ghosts.current.forEach(gh => {
      if (gh.eaten) {
        if (gh.x === gh.homeX && gh.y === gh.homeY) { gh.eaten = false; gh.frightened = false }
      }
      const opts: Dir[] = [UP, DOWN, LEFT, RIGHT].filter(d => isOpen(g, gh.x + d[0], gh.y + d[1]) && !(d[0] === -gh.dir[0] && d[1] === -gh.dir[1]))
      const candidates = opts.length > 0 ? opts : [UP, DOWN, LEFT, RIGHT].filter(d => isOpen(g, gh.x + d[0], gh.y + d[1]))
      if (candidates.length === 0) return
      let best = candidates[Math.floor(Math.random() * candidates.length)]
      if (Math.random() < 0.72) {
        const targetX = gh.eaten ? gh.homeX : gh.frightened ? gh.x + (gh.x - p.x) : p.x
        const targetY = gh.eaten ? gh.homeY : gh.frightened ? gh.y + (gh.y - p.y) : p.y
        let bestDist = Infinity
        for (const d of candidates) {
          const nx = gh.x + d[0], ny = gh.y + d[1]
          const dist = (nx - targetX) ** 2 + (ny - targetY) ** 2
          if (dist < bestDist) { bestDist = dist; best = d }
        }
      }
      gh.dir = best; gh.x += best[0]; gh.y += best[1]
    })

    // collisions
    for (const gh of ghosts.current) {
      if (gh.x === p.x && gh.y === p.y) {
        if (gh.eaten) continue
        if (gh.frightened) {
          gh.eaten = true; gh.frightened = false
          ghostChain.current++
          const pts = 200 * ghostChain.current
          scoreRef.current += pts; setScore(scoreRef.current)
          snd('eatGhost'); vibrate([10, 20, 10])
          burst(p.x * cellPx.current, p.y * cellPx.current, '#93DCFF')
        } else {
          loseLife(); return
        }
      }
    }

    if (frightTimer.current > 0) {
      frightTimer.current -= mazeParams(levelRef.current).tickMs
      if (frightTimer.current <= 0) ghosts.current.forEach(gh => { gh.frightened = false })
    }

    if (pellets.current.size === 0 && powerPellets.current.size === 0) {
      const bonus = 300 + levelRef.current * 50
      scoreRef.current += bonus; setScore(scoreRef.current)
      levelRef.current++; setLevel(levelRef.current)
      snd('levelup'); vibrate([15, 30, 15])
      setLevelMsg(`LEVEL ${levelRef.current} · +${bonus}`)
      setTimeout(() => setLevelMsg(null), 1400)
      setupLevel(levelRef.current)
    }
  }, [burst, loseLife, setupLevel])

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const g = grid.current, cs = cellPx.current
    const H = g.length * cs
    ctx.fillStyle = '#0B0A14'; ctx.fillRect(0, 0, CW, H)
    ctx.fillStyle = '#1D1B33'
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (g[y][x] === 1) ctx.fillRect(x * cs, y * cs, cs + 0.5, cs + 0.5)

    ctx.fillStyle = '#F5B942'
    pellets.current.forEach(k => { const [x, y] = k.split(',').map(Number); ctx.beginPath(); ctx.arc(x * cs + cs / 2, y * cs + cs / 2, Math.max(1.5, cs * 0.09), 0, Math.PI * 2); ctx.fill() })
    powerPellets.current.forEach(k => {
      const [x, y] = k.split(',').map(Number)
      ctx.shadowColor = '#F5B942'; ctx.shadowBlur = 6
      ctx.beginPath(); ctx.arc(x * cs + cs / 2, y * cs + cs / 2, Math.max(3, cs * 0.24), 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
    })

    parts.current.forEach(p => { ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x + cs / 2, p.y + cs / 2, 2, 0, Math.PI * 2); ctx.fill() })
    ctx.globalAlpha = 1

    ghosts.current.forEach(gh => {
      const gx = gh.x * cs + cs / 2, gy = gh.y * cs + cs / 2
      const col = gh.eaten ? 'rgba(255,255,255,0.25)' : gh.frightened ? (frightTimer.current < 1200 && Math.floor(Date.now() / 150) % 2 === 0 ? '#4CC9F0' : 'white') : gh.color
      ctx.fillStyle = col
      ctx.beginPath(); ctx.arc(gx, gy - cs * 0.05, cs * 0.42, Math.PI, 0)
      ctx.lineTo(gx + cs * 0.42, gy + cs * 0.35)
      ctx.lineTo(gx, gy + cs * 0.2)
      ctx.lineTo(gx - cs * 0.42, gy + cs * 0.35)
      ctx.closePath(); ctx.fill()
      if (!gh.eaten) {
        ctx.fillStyle = 'white'
        ctx.beginPath(); ctx.arc(gx - cs * 0.15, gy - cs * 0.08, cs * 0.1, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(gx + cs * 0.15, gy - cs * 0.08, cs * 0.1, 0, Math.PI * 2); ctx.fill()
      }
    })

    const p = player.current
    const px = p.x * cs + cs / 2, py = p.y * cs + cs / 2
    const ang = p.dir === LEFT ? Math.PI : p.dir === UP ? -Math.PI / 2 : p.dir === DOWN ? Math.PI / 2 : 0
    const mouth = 0.22 + Math.abs(Math.sin(Date.now() / 90)) * 0.22
    ctx.fillStyle = '#FDE68A'
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang)
    ctx.beginPath(); ctx.arc(0, 0, cs * 0.44, mouth * Math.PI, (2 - mouth) * Math.PI); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill()
    ctx.restore()
  }, [])

  useEffect(() => {
    if (phase !== 'play') { cancelAnimationFrame(raf.current); return }
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    const g = grid.current
    canvas.width = CW * dpr; canvas.height = g.length * cellPx.current * dpr
    alive.current = true; lastTick.current = 0

    function loop(ts: number) {
      if (!alive.current) return
      const { tickMs } = mazeParams(levelRef.current)
      if (ts - lastTick.current >= tickMs) { lastTick.current = ts; step() }
      parts.current = parts.current.map(pt => ({ ...pt, x: pt.x + pt.vx, y: pt.y + pt.vy, life: pt.life - 1 })).filter(pt => pt.life > 0)
      draw()
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => { alive.current = false; cancelAnimationFrame(raf.current) }
  }, [phase, step, draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || phase !== 'play') return
    let sx = 0, sy = 0
    const onStart = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY }
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return
      player.current.desired = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP)
    }
    canvas.addEventListener('touchstart', onStart, { passive: true })
    canvas.addEventListener('touchend', onEnd, { passive: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') player.current.desired = UP
      if (e.key === 'ArrowDown') player.current.desired = DOWN
      if (e.key === 'ArrowLeft') player.current.desired = LEFT
      if (e.key === 'ArrowRight') player.current.desired = RIGHT
    }
    window.addEventListener('keydown', onKey)
    return () => { canvas.removeEventListener('touchstart', onStart); canvas.removeEventListener('touchend', onEnd); window.removeEventListener('keydown', onKey) }
  }, [phase])

  const startGame = useCallback(() => {
    scoreRef.current = 0; levelRef.current = 1; livesRef.current = 3
    setScore(0); setLevel(1); setLives(3); setLevelMsg(null)
    setupLevel(1)
    setPhase('play')
  }, [setupLevel])

  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current) }, [])

  const setDir = (d: Dir) => { player.current.desired = d }
  const best = highScores['pac-maze'] ?? 0

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={50} fill="#0B0A14" />
        <path d="M60,60 L100,42 A42,42 0 1,0 100,78 Z" fill="#FDE68A" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>PAC MAZE</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>SWIPE TO MOVE · CLEAR THE DOTS</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={startGame}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>GAME OVER</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>LEVEL</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{levelRef.current}</p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{Math.floor(scoreRef.current * 0.3)}</p>
      {scoreRef.current > 0 && scoreRef.current >= best && <p style={{ fontSize: 11, color: '#E9B213', fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <motion.button whileTap={{ scale: 0.96 }} onClick={startGame}
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

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0B0A14', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 6px', flexShrink: 0 }}>
        <button onClick={() => { alive.current = false; onExit() }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>LEVEL</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#F5B942', margin: 0, lineHeight: 1.1 }}>{level}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < lives ? '#FDE68A' : 'rgba(255,255,255,0.1)' }} />)}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', touchAction: 'none' }} />
        <AnimatePresence>
          {levelMsg && (
            <motion.div key={levelMsg} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.3, opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#F5B942', letterSpacing: '0.1em', filter: 'drop-shadow(0 2px 14px rgba(245,185,66,0.7))', margin: 0, textAlign: 'center' }}>{levelMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,52px)', gridTemplateRows: 'repeat(3,52px)', gap: 4, justifyContent: 'center', padding: '8px 0 16px', flexShrink: 0 }}>
        <div />
        <button onClick={() => setDir(UP)} style={dpadStyle}><ChevronUp size={22} /></button>
        <div />
        <button onClick={() => setDir(LEFT)} style={dpadStyle}><ChevronLeft size={22} /></button>
        <div />
        <button onClick={() => setDir(RIGHT)} style={dpadStyle}><ChevronRight size={22} /></button>
        <div />
        <button onClick={() => setDir(DOWN)} style={dpadStyle}><ChevronDown size={22} /></button>
        <div />
      </div>
    </div>
  )
}

const dpadStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
