import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('pattern-sync')
const COLORS = ['#C0675C', '#5B8DB8', '#5BAA7E', '#C4A24D', '#8B6BAD']
const SHAPES = ['circle', 'square'] as const
type Shape = typeof SHAPES[number]
type Item = { color: string; shape: Shape }

function randomItem(): Item {
  return { color: COLORS[Math.floor(Math.random() * COLORS.length)], shape: SHAPES[Math.floor(Math.random() * 2)] }
}
function genSeq(len: number): Item[] { return Array.from({ length: len }, () => randomItem()) }
function genOpts(correct: Item): Item[] {
  const s = new Set<string>([JSON.stringify(correct)])
  while (s.size < 4) s.add(JSON.stringify(randomItem()))
  return [...s].sort(() => Math.random() - 0.5).map(x => JSON.parse(x))
}

function ShapeIcon({ item, size = 44 }: { item: Item; size?: number }) {
  const s: React.CSSProperties = { width: size, height: size, border: `2px solid ${item.color}50` }
  return item.shape === 'circle'
    ? <div style={{ ...s, borderRadius: '50%', background: item.color }} />
    : <div style={{ ...s, borderRadius: 6, background: item.color }} />
}

export default function PatternSyncGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [phase, setPhase] = useState<'show' | 'recall'>('show')
  const [sequence, setSequence] = useState<Item[]>([])
  const [missingIdx, setMissingIdx] = useState(0)
  const [options, setOptions] = useState<Item[]>([])
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [seqLen, setSeqLen] = useState(3)
  const [feedback, setFeedback] = useState<number | null>(null)

  const scoreRef = useRef(0), livesRef = useRef(3), seqLenRef = useRef(3)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)

  const setupRound = useCallback((len: number) => {
    const seq = genSeq(len)
    const idx = Math.floor(Math.random() * len)
    setSequence(seq); setMissingIdx(idx); setOptions(genOpts(seq[idx]))
    setPhase('show'); setFeedback(null)
    timerRef.current = setTimeout(() => setPhase('recall'), 2000)
  }, [])

  const start = useCallback(() => {
    scoreRef.current = 0; livesRef.current = 3; seqLenRef.current = 3
    setScore(0); setLives(3); setSeqLen(3); setStarted(true); setGameOver(false)
    setupRound(3)
  }, [setupRound])

  const handlePick = useCallback((opt: Item, oi: number) => {
    if (phase !== 'recall' || feedback !== null) return
    const correct = sequence[missingIdx]
    const ok = opt.color === correct.color && opt.shape === correct.shape
    setFeedback(oi)
    if (ok) {
      scoreRef.current += seqLenRef.current * 25; setScore(scoreRef.current)
      seqLenRef.current = Math.min(7, seqLenRef.current + 1); setSeqLen(seqLenRef.current)
      setTimeout(() => setupRound(seqLenRef.current), 500)
    } else {
      livesRef.current--; setLives(livesRef.current)
      if (livesRef.current <= 0) {
        setTimeout(() => { addXp(Math.floor(scoreRef.current * 0.4)); setHighScore('pattern-sync', scoreRef.current); setGameOver(true) }, 500)
      } else setTimeout(() => setupRound(seqLenRef.current), 500)
    }
  }, [phase, feedback, sequence, missingIdx, setupRound, addXp, setHighScore])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const best = highScores['pattern-sync'] ?? 0
  const xp = Math.floor(score * 0.4)

  return (
    <GameShell theme={T} onExit={onExit} hud={[
      { label: 'LIVES', value: lives, color: lives <= 1 ? T.danger : T.hudText },
      { label: 'SCORE', value: score },
    ]}>
      {!started ? <StartOverlay theme={T} onStart={start} /> : (
        <div className="flex flex-col items-center justify-center h-full gap-8">
          <p className="text-[11px] font-bold tracking-[0.2em]" style={{ color: phase === 'show' ? T.accent : T.hudMuted }}>
            {phase === 'show' ? 'MEMORIZE' : 'FIND THE MISSING'}
          </p>

          {phase === 'show' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex gap-3 items-center px-5 py-4 rounded-2xl"
              style={{ border: `2px solid ${T.accent}40`, boxShadow: `0 0 20px ${T.accent}15` }}
            >
              {sequence.map((item, i) => (
                <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.08 }}>
                  <ShapeIcon item={item} size={44} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="flex gap-3 items-center">
              {sequence.map((item, i) => (
                <div key={i}>
                  {i === missingIdx ? (
                    <div className="flex items-center justify-center" style={{
                      width: 44, height: 44, border: `2px dashed ${T.hudMuted}60`, borderRadius: 8,
                    }}>
                      <span style={{ color: T.hudMuted, fontSize: 22, fontWeight: 900 }}>?</span>
                    </div>
                  ) : <ShapeIcon item={item} size={44} />}
                </div>
              ))}
            </div>
          )}

          {phase === 'recall' && (
            <div className="flex gap-4">
              {options.map((opt, i) => {
                const correct = sequence[missingIdx]
                const isCorrect = opt.color === correct.color && opt.shape === correct.shape
                const showResult = feedback !== null
                return (
                  <motion.button key={i} whileTap={{ scale: 0.9 }} onClick={() => handlePick(opt, i)}
                    className="p-3 rounded-xl" style={{
                      border: showResult && feedback === i ? `2px solid ${isCorrect ? T.success : T.danger}` : `1px solid ${T.gridLine}`,
                      background: T.surface,
                    }}
                  >
                    <ShapeIcon item={opt} size={48} />
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      )}
      {gameOver && (
        <GameOverOverlay
          theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'SEQ LENGTH', value: seqLen }]}
        />
      )}
    </GameShell>
  )
}
