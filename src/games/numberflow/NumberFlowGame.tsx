import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'

const BG = '#FFF9E8'
const OPS = ['+', '-', '×'] as const
type Op = typeof OPS[number]

interface Problem { a: number; b: number; op: Op; display: string; answer: number; options: number[] }

function rand(min: number, max: number) { return min + Math.floor(Math.random() * (max - min + 1)) }
function stageOf(correct: number) { return Math.min(1 + Math.floor(correct / 4), 10) }
function barDuration(stage: number) { return Math.max(1100, 3000 - stage * 190) }
function spread(stage: number) { return Math.max(3, 12 - stage) }

function genProblem(prev: number | null, stage: number): Problem {
  const a = prev ?? (8 + rand(0, 16 + stage * 4))
  let opsAllowed: Op[] = ['+', '-']
  if (stage >= 2) opsAllowed = [...opsAllowed, '×']
  if (a > 160) opsAllowed = ['-']

  const op = opsAllowed[rand(0, opsAllowed.length - 1)]
  let b: number, ans: number
  if (op === '+') { b = 2 + rand(0, 6 + stage * 3); ans = a + b }
  else if (op === '-') { const maxB = Math.max(1, Math.min(a - 1, 6 + stage * 3)); b = 2 + rand(0, Math.max(1, maxB - 2)); ans = a - b }
  else { b = 2 + rand(0, Math.min(3 + Math.floor(stage / 2), 8)); ans = a * b }

  const s = spread(stage)
  const opts = new Set<number>([ans])
  let guard = 0
  while (opts.size < 4 && guard++ < 40) {
    const f = ans + rand(-s, s)
    if (f > 0 && f !== ans) opts.add(f)
  }
  return { a, b, op, display: `${a} ${op} ${b}`, answer: ans, options: [...opts].sort(() => Math.random() - 0.5) }
}

let _ac: AudioContext | null = null
function snd(type: 'correct' | 'wrong' | 'tick' | 'over' | 'milestone') {
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
    if (type === 'correct')   [700, 950].forEach((f, i) => n(f, t + i * 0.045, 0.1, 0.07))
    if (type === 'wrong')     n(180, t, 0.22, 0.14, 'sawtooth')
    if (type === 'tick')      n(500, t, 0.04, 0.03, 'square')
    if (type === 'milestone') [600, 800, 1050, 1350].forEach((f, i) => n(f, t + i * 0.06, 0.11, 0.07))
    if (type === 'over')      { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

export default function NumberFlowGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()

  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [problem, setProblem] = useState<Problem>(() => genProblem(null, 1))
  const [score, setScore] = useState(0)
  const [chain, setChain] = useState(0)
  const [bestChain, setBestChain] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [barPct, setBarPct] = useState(100)
  const [pickedIdx, setPickedIdx] = useState<number | null>(null)
  const [milestone, setMilestone] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const scoreRef = useRef(0), chainRef = useRef(0), bestChainRef = useRef(0), lastAns = useRef<number | null>(null)
  const gameTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const barTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const isRunning = useRef(false)

  const startBar = useCallback((stage: number) => {
    setBarPct(100); clearInterval(barTimer.current)
    const dur = barDuration(stage)
    const s = Date.now()
    barTimer.current = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - s) / dur) * 100)
      setBarPct(pct)
      if (pct <= 0) {
        clearInterval(barTimer.current)
        if (isRunning.current) {
          chainRef.current = 0; setChain(0); setFeedback('wrong'); setPickedIdx(null)
          snd('wrong'); vibrate(35); setShake(s => s + 1)
          setTimeout(() => {
            setFeedback(null); lastAns.current = null
            const st = stageOf(chainRef.current)
            setProblem(genProblem(null, st)); startBar(st)
          }, 380)
        }
      }
    }, 30)
  }, [])

  const start = useCallback(() => {
    scoreRef.current = 0; chainRef.current = 0; bestChainRef.current = 0; lastAns.current = null
    setScore(0); setChain(0); setBestChain(0); setTimeLeft(60); setFeedback(null); setPickedIdx(null); setMilestone(null)
    isRunning.current = true
    const p = genProblem(null, 1)
    setProblem(p); startBar(1)
    setPhase('play')
    gameTimer.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          isRunning.current = false; clearInterval(gameTimer.current); clearInterval(barTimer.current)
          snd('over')
          addXp(Math.floor(scoreRef.current * 0.35)); setHighScore('number-flow', scoreRef.current)
          setPhase('over')
          return 0
        }
        if (prev <= 6) snd('tick')
        return prev - 1
      })
    }, 1000)
  }, [startBar, addXp, setHighScore])

  const handleAnswer = useCallback((ans: number, idx: number) => {
    if (!isRunning.current || feedback) return
    clearInterval(barTimer.current)
    setPickedIdx(idx)
    if (ans === problem.answer) {
      chainRef.current++
      const c = chainRef.current
      setChain(c)
      if (c > bestChainRef.current) { bestChainRef.current = c; setBestChain(c) }
      const pts = 10 * c
      scoreRef.current += pts; setScore(scoreRef.current)
      setFeedback('correct'); lastAns.current = ans
      snd('correct'); vibrate(12)
      if (c > 0 && c % 5 === 0) {
        const bonus = 50 * (c / 5)
        scoreRef.current += bonus; setScore(scoreRef.current)
        snd('milestone'); vibrate([15, 30, 15])
        setMilestone(`CHAIN ×${c} BONUS +${bonus}`)
        setTimeout(() => setMilestone(null), 900)
      }
      const st = stageOf(chainRef.current)
      const delay = Math.max(120, 260 - st * 15)
      setTimeout(() => { setFeedback(null); setPickedIdx(null); setProblem(genProblem(lastAns.current, st)); startBar(st) }, delay)
    } else {
      chainRef.current = 0; setChain(0); setFeedback('wrong'); lastAns.current = null
      snd('wrong'); vibrate(35); setShake(s => s + 1)
      const delay = Math.max(250, 450 - stageOf(0) * 15)
      setTimeout(() => { setFeedback(null); setPickedIdx(null); setProblem(genProblem(null, stageOf(chainRef.current))); startBar(stageOf(chainRef.current)) }, delay)
    }
  }, [problem, feedback, startBar])

  useEffect(() => () => { isRunning.current = false; clearInterval(gameTimer.current); clearInterval(barTimer.current) }, [])

  const best = highScores['number-flow'] ?? 0

  // ── Start screen ──────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <p style={{ fontSize: 36, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>47 <span style={{ color: '#93DCFF' }}>+</span> 38</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[85, 75, 95, 83].map((v, i) => (
            <div key={i} style={{ width: 48, height: 32, borderRadius: 8, background: i === 0 ? '#86EFAC' : 'white', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: i === 0 ? '#14532D' : '#999' }}>{v}</div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>NUMBER FLOW</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>CHAIN THE ANSWERS · 60s</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={start}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  // ── Game over screen ─────────────────────────────────────────────────
  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>TIME'S UP</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>BEST CHAIN</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>×{bestChainRef.current}</p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{Math.floor(scoreRef.current * 0.35)}</p>
      {scoreRef.current > 0 && scoreRef.current >= best && <p style={{ fontSize: 11, color: '#E9B213', fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <motion.button whileTap={{ scale: 0.96 }} onClick={start}
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

  // ── Play screen ──────────────────────────────────────────────────────
  const opColor = (s: string) => (['+', '-', '×'].includes(s) ? '#93DCFF' : '#1A1A2E')
  return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 4px', flexShrink: 0 }}>
        <button onClick={() => { isRunning.current = false; onExit() }} style={{ background: 'none', border: 'none', color: '#CCC', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>TIME</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: timeLeft <= 10 ? '#FF6B6B' : '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{timeLeft}s</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>SCORE</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
        </div>
      </div>

      <div style={{ textAlign: 'center', height: 20, flexShrink: 0 }}>
        <AnimatePresence>
          {chain > 1 && (
            <motion.p key={Math.floor(chain / 1)} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.1em', color: '#C4B5FD', margin: 0 }}>
              CHAIN ×{chain}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        key={shake}
        animate={feedback === 'wrong' ? { x: [0, -8, 8, -6, 6, 0] } : {}}
        transition={{ duration: 0.35 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '0 24px', position: 'relative' }}>

        <AnimatePresence>
          {milestone && (
            <motion.p key={milestone} initial={{ y: 10, opacity: 0, scale: 0.8 }} animate={{ y: -50, opacity: 1, scale: 1.1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '30%', fontSize: 13, fontWeight: 900, color: '#E9B213', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              {milestone}
            </motion.p>
          )}
        </AnimatePresence>

        <p style={{ fontSize: 40, fontWeight: 900, letterSpacing: '0.01em', margin: 0, color: '#1A1A2E' }}>
          {problem.display.split(' ').map((p, i) => <span key={i} style={{ color: opColor(p) }}>{p} </span>)}
          <span style={{ color: '#CCC' }}>= ?</span>
        </p>

        <div style={{ width: 280, height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(0,0,0,0.08)' }}>
          <div style={{ height: '100%', borderRadius: 3, width: `${barPct}%`, background: barPct > 30 ? '#86EFAC' : '#FF6B6B', transition: 'none' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: 300 }}>
          {problem.options.map((opt, idx) => {
            const isPicked = pickedIdx === idx
            const isAnswer = opt === problem.answer
            const showCorrect = feedback && isAnswer
            const showWrong = feedback === 'wrong' && isPicked && !isAnswer
            return (
              <motion.button
                key={`${problem.display}-${opt}`}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAnswer(opt, idx)}
                animate={showCorrect ? { scale: [1, 1.08, 1] } : {}}
                className="py-4 rounded-2xl font-black text-2xl"
                style={{
                  background: showCorrect ? '#86EFAC' : showWrong ? '#FCA5A5' : 'white',
                  color: '#1A1A2E',
                  border: `1.5px solid ${showCorrect ? '#4ADE80' : showWrong ? '#FF6B6B' : 'rgba(0,0,0,0.08)'}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >{opt}</motion.button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
