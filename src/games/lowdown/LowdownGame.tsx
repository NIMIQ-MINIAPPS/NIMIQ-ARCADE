import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('lowdown')

type Op = '+' | '-' | '×'

function genQuestion(level: number) {
  const ops: Op[] = level < 5 ? ['+'] : level < 10 ? ['+', '-'] : ['+', '-', '×']
  const op = ops[Math.floor(Math.random() * ops.length)]
  const max = Math.min(20 + level * 5, 99)
  let a: number, b: number, result: number

  if (op === '×') {
    a = 2 + Math.floor(Math.random() * Math.min(10, 3 + level))
    b = 2 + Math.floor(Math.random() * Math.min(10, 3 + level))
    result = a * b
  } else if (op === '-') {
    a = 10 + Math.floor(Math.random() * max)
    b = 2 + Math.floor(Math.random() * Math.min(a - 1, max))
    result = a - b
  } else {
    a = 5 + Math.floor(Math.random() * max)
    b = 5 + Math.floor(Math.random() * max)
    result = a + b
  }

  const offset = Math.floor(Math.random() * 15) - 7
  const ref = result + offset + (offset === 0 ? (Math.random() > 0.5 ? 3 : -3) : 0)
  const answer: 'higher' | 'lower' = result > ref ? 'higher' : 'lower'

  return { display: `${a} ${op} ${b}`, ref, answer, result }
}

export default function LowdownGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [question, setQuestion] = useState(() => genQuestion(1))
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [level, setLevel] = useState(1)
  const [timeLeft, setTimeLeft] = useState(45)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [answerTime, setAnswerTime] = useState(5000)
  const [barPct, setBarPct] = useState(100)

  const scoreRef = useRef(0)
  const levelRef = useRef(1)
  const streakRef = useRef(0)
  const gameTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const barTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const isRunning = useRef(false)

  const startBar = useCallback((time: number) => {
    setBarPct(100)
    clearInterval(barTimer.current)
    const s = Date.now()
    barTimer.current = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - s) / time) * 100)
      setBarPct(pct)
      if (pct <= 0) {
        clearInterval(barTimer.current)
        if (isRunning.current) {
          streakRef.current = 0
          setStreak(0)
          setFeedback('wrong')
          setTimeout(() => {
            setFeedback(null)
            const q = genQuestion(levelRef.current)
            setQuestion(q)
            startBar(Math.max(2000, 5000 - levelRef.current * 200))
          }, 400)
        }
      }
    }, 30)
  }, [])

  const start = useCallback(() => {
    scoreRef.current = 0; streakRef.current = 0; levelRef.current = 1
    setScore(0); setStreak(0); setLevel(1); setTimeLeft(45)
    setGameOver(false); setStarted(true); setFeedback(null)
    isRunning.current = true
    const q = genQuestion(1)
    setQuestion(q)
    const aTime = 5000
    setAnswerTime(aTime)
    startBar(aTime)
    gameTimer.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          isRunning.current = false
          clearInterval(gameTimer.current)
          clearInterval(barTimer.current)
          addXp(Math.floor(scoreRef.current * 0.4))
          setHighScore('lowdown', scoreRef.current)
          setGameOver(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [startBar, addXp, setHighScore])

  const handleAnswer = useCallback((choice: 'higher' | 'lower') => {
    if (!isRunning.current || feedback) return
    clearInterval(barTimer.current)
    if (choice === question.answer) {
      streakRef.current++
      setStreak(streakRef.current)
      const pts = 10 + Math.min(streakRef.current, 10) * 5
      scoreRef.current += pts
      setScore(scoreRef.current)
      if (streakRef.current % 5 === 0) {
        levelRef.current++
        setLevel(levelRef.current)
      }
      setFeedback('correct')
      setTimeout(() => {
        setFeedback(null)
        const q = genQuestion(levelRef.current)
        setQuestion(q)
        const aTime = Math.max(2000, 5000 - levelRef.current * 200)
        setAnswerTime(aTime)
        startBar(aTime)
      }, 250)
    } else {
      streakRef.current = 0
      setStreak(0)
      setFeedback('wrong')
      setTimeout(() => {
        setFeedback(null)
        const q = genQuestion(levelRef.current)
        setQuestion(q)
        startBar(answerTime)
      }, 400)
    }
  }, [question, feedback, startBar, answerTime])

  useEffect(() => () => {
    isRunning.current = false
    clearInterval(gameTimer.current)
    clearInterval(barTimer.current)
  }, [])

  const best = highScores['lowdown'] ?? 0
  const xp = Math.floor(score * 0.4)

  return (
    <GameShell theme={T} onExit={onExit} hud={[
      { label: 'TIME', value: `${timeLeft}s`, color: timeLeft <= 10 ? T.danger : T.hudText },
      ...(streak > 2 ? [{ label: 'STREAK', value: `×${streak}`, color: T.accent }] : []),
      { label: 'SCORE', value: score },
    ]}>
      {!started ? <StartOverlay theme={T} onStart={start} /> : (
        <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
          <div className="text-center">
            <p className="text-[42px] font-black tracking-wide" style={{ color: T.hudText }}>
              {question.display}
            </p>
            <p className="text-lg mt-2" style={{ color: T.hudMuted }}>
              Higher or lower than <span className="font-black" style={{ color: T.accent }}>{question.ref}</span>?
            </p>
          </div>

          <div className="w-[280px] h-1 rounded-full overflow-hidden" style={{ background: T.surface }}>
            <div className="h-full rounded-full" style={{
              width: `${barPct}%`,
              background: barPct > 30 ? T.accent : T.danger,
              transition: 'none',
            }} />
          </div>

          <div className="flex gap-4 w-[300px]">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAnswer('higher')}
              className="flex-1 py-5 rounded-2xl font-black text-xl"
              style={{
                background: feedback === 'correct' && question.answer === 'higher' ? T.success
                  : feedback === 'wrong' && question.answer === 'higher' ? T.success
                  : T.surface,
                color: T.hudText,
                border: `1px solid ${T.gridLine}`,
              }}
            >
              HIGHER
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAnswer('lower')}
              className="flex-1 py-5 rounded-2xl font-black text-xl"
              style={{
                background: feedback === 'correct' && question.answer === 'lower' ? T.success
                  : feedback === 'wrong' && question.answer === 'lower' ? T.success
                  : T.surface,
                color: T.hudText,
                border: `1px solid ${T.gridLine}`,
              }}
            >
              LOWER
            </motion.button>
          </div>

          {feedback && (
            <motion.p
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="text-sm font-black tracking-widest"
              style={{ color: feedback === 'correct' ? T.success : T.danger }}
            >
              {feedback === 'correct' ? 'CORRECT' : `WRONG — ${question.result}`}
            </motion.p>
          )}
        </div>
      )}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          title="TIME'S UP" stats={[{ label: 'LEVEL', value: level }]}
        />
      )}
    </GameShell>
  )
}
