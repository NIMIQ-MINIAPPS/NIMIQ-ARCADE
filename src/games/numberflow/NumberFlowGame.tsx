import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('number-flow')
const OPS = ['+', '-', '×'] as const

function genProblem(prev: number | null) {
  const a = prev ?? (10 + Math.floor(Math.random() * 40))
  const op = OPS[Math.floor(Math.random() * 3)]
  let b: number, ans: number
  if (op === '+') { b = 2 + Math.floor(Math.random() * 20); ans = a + b }
  else if (op === '-') { b = 2 + Math.floor(Math.random() * Math.min(a - 1, 20)); ans = a - b }
  else { b = 2 + Math.floor(Math.random() * 8); ans = a * b }
  const opts = new Set<number>([ans])
  while (opts.size < 4) { const f = ans + Math.floor(Math.random() * 10) - 5; if (f > 0 && f !== ans) opts.add(f) }
  return { display: `${a} ${op} ${b}`, answer: ans, options: [...opts].sort(() => Math.random() - 0.5) }
}

export default function NumberFlowGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [problem, setProblem] = useState(() => genProblem(null))
  const [score, setScore] = useState(0)
  const [chain, setChain] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [barPct, setBarPct] = useState(100)

  const scoreRef = useRef(0), chainRef = useRef(0), lastAns = useRef<number | null>(null)
  const gameTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const barTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const isRunning = useRef(false)

  const startBar = useCallback(() => {
    setBarPct(100); clearInterval(barTimer.current)
    const s = Date.now()
    barTimer.current = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - s) / 3000) * 100)
      setBarPct(pct)
      if (pct <= 0) {
        clearInterval(barTimer.current)
        if (isRunning.current) {
          chainRef.current = 0; setChain(0); setFeedback('wrong')
          setTimeout(() => { setFeedback(null); lastAns.current = null; setProblem(genProblem(null)); startBar() }, 400)
        }
      }
    }, 30)
  }, [])

  const start = useCallback(() => {
    scoreRef.current = 0; chainRef.current = 0; lastAns.current = null
    setScore(0); setChain(0); setTimeLeft(60); setGameOver(false); setStarted(true); setFeedback(null)
    isRunning.current = true; setProblem(genProblem(null)); startBar()
    gameTimer.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          isRunning.current = false; clearInterval(gameTimer.current); clearInterval(barTimer.current)
          addXp(Math.floor(scoreRef.current * 0.3)); setHighScore('number-flow', scoreRef.current)
          setGameOver(true); return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [startBar, addXp, setHighScore])

  const handleAnswer = useCallback((ans: number) => {
    if (!isRunning.current || feedback) return
    clearInterval(barTimer.current)
    if (ans === problem.answer) {
      chainRef.current++; setChain(chainRef.current)
      scoreRef.current += 10 * chainRef.current; setScore(scoreRef.current)
      setFeedback('correct'); lastAns.current = ans
      setTimeout(() => { setFeedback(null); setProblem(genProblem(lastAns.current)); startBar() }, 250)
    } else {
      chainRef.current = 0; setChain(0); setFeedback('wrong'); lastAns.current = null
      setTimeout(() => { setFeedback(null); setProblem(genProblem(null)); startBar() }, 400)
    }
  }, [problem, feedback, startBar])

  useEffect(() => () => { isRunning.current = false; clearInterval(gameTimer.current); clearInterval(barTimer.current) }, [])

  const best = highScores['number-flow'] ?? 0
  const xp = Math.floor(score * 0.3)

  return (
    <GameShell theme={T} onExit={onExit} hud={[
      { label: 'TIME', value: `${timeLeft}s`, color: timeLeft <= 10 ? T.danger : T.hudText },
      ...(chain > 1 ? [{ label: 'CHAIN', value: `×${chain}`, color: T.accent }] : []),
      { label: 'SCORE', value: score },
    ]}>
      {!started ? <StartOverlay theme={T} onStart={start} /> : (
        <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
          <p className="text-[40px] font-black tracking-wide" style={{ color: T.hudText }}>
            {problem.display.split(' ').map((p, i) => (
              <span key={i} style={{ color: ['+', '-', '×'].includes(p) ? T.accent : T.hudText }}>{p} </span>
            ))}
            <span style={{ color: T.hudMuted }}>= ?</span>
          </p>

          <div className="w-[280px] h-1 rounded-full overflow-hidden" style={{ background: T.surface }}>
            <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: barPct > 30 ? T.accent : T.danger, transition: 'none' }} />
          </div>

          <div className="grid grid-cols-2 gap-3 w-[300px]">
            {problem.options.map(opt => (
              <motion.button
                key={`${problem.display}-${opt}`}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAnswer(opt)}
                className="py-4 rounded-2xl font-black text-2xl"
                style={{
                  background: feedback === 'correct' && opt === problem.answer ? T.success
                    : feedback === 'wrong' && opt === problem.answer ? T.success
                    : T.surface,
                  color: T.hudText,
                  border: `1px solid ${T.gridLine}`,
                }}
              >{opt}</motion.button>
            ))}
          </div>
        </div>
      )}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          title="TIME'S UP"
        />
      )}
    </GameShell>
  )
}
