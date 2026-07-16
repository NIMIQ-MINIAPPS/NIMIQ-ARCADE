import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import LivesHearts from '../../components/games/LivesHearts'

const BG = '#FFF9E8'
type Rule = 'color' | 'shape' | 'size'
const RULES: Rule[] = ['color', 'shape', 'size']
const COLORS = ['#FF6B6B', '#4CC9F0']
const RULE_LABEL: Record<Rule, string> = { color: 'SORT BY COLOR', shape: 'SORT BY SHAPE', size: 'SORT BY SIZE' }

interface Obj { color: 0 | 1; shape: 0 | 1; size: 0 | 1; born: number }

function stageOf(correct: number) { return 1 + Math.floor(correct / 5) }
function objTime(stage: number) { return Math.max(550, 1900 - stage * 110) }
function switchEvery(stage: number) { return Math.max(2, 6 - Math.floor(stage / 3)) }

function genObj(): Obj {
  return { color: Math.random() < 0.5 ? 0 : 1, shape: Math.random() < 0.5 ? 0 : 1, size: Math.random() < 0.5 ? 0 : 1, born: Date.now() }
}

function binValue(rule: Rule, obj: Obj): 0 | 1 { return obj[rule] }

let _ac: AudioContext | null = null
function snd(type: 'correct' | 'wrong' | 'milestone' | 'over' | 'switch') {
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
    if (type === 'wrong')     n(190, t, 0.2, 0.13, 'sawtooth')
    if (type === 'milestone') [600, 800, 1050, 1350].forEach((f, i) => n(f, t + i * 0.06, 0.11, 0.07))
    if (type === 'switch')    n(500, t, 0.08, 0.05, 'triangle')
    if (type === 'over')      { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

function ShapeIcon({ shape, size, color }: { shape: 0 | 1; size: number; color: string }) {
  return shape === 0
    ? <div style={{ width: size, height: size, borderRadius: '50%', background: color }} />
    : <div style={{ width: size, height: size, borderRadius: 8, background: color }} />
}

export default function SpeedSortGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [rule, setRule] = useState<Rule>('color')
  const [obj, setObj] = useState<Obj>(() => genObj())
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [lives, setLives] = useState(3)
  const [barPct, setBarPct] = useState(100)
  const [feedback, setFeedback] = useState<{ side: 'left' | 'right'; ok: boolean } | null>(null)
  const [milestone, setMilestone] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const scoreRef = useRef(0), streakRef = useRef(0), livesRef = useRef(3), correctRef = useRef(0), roundRef = useRef(0)
  const ruleRef = useRef<Rule>('color')
  const isRunning = useRef(false)
  const barTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const objBorn = useRef(0)

  const doEnd = useCallback(() => {
    isRunning.current = false; clearInterval(barTimer.current)
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.3))
    setHighScore('speed-sort', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const nextObj = useCallback(() => {
    const st = stageOf(correctRef.current)
    roundRef.current++
    if (roundRef.current % switchEvery(st) === 0) {
      let r: Rule = ruleRef.current
      while (r === ruleRef.current) r = RULES[Math.floor(Math.random() * RULES.length)]
      ruleRef.current = r; setRule(r); snd('switch')
    }
    const o = genObj()
    setObj(o); setFeedback(null)
    objBorn.current = Date.now()
    setBarPct(100); clearInterval(barTimer.current)
    const dur = objTime(st)
    barTimer.current = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - objBorn.current) / dur) * 100)
      setBarPct(pct)
      if (pct <= 0) {
        clearInterval(barTimer.current)
        if (!isRunning.current) return
        streakRef.current = 0; setStreak(0)
        livesRef.current--; setLives(livesRef.current)
        snd('wrong'); vibrate(30); setShake(x => x + 1)
        if (livesRef.current <= 0) { doEnd(); return }
        nextObj()
      }
    }, 30)
  }, [doEnd])

  const start = useCallback(() => {
    scoreRef.current = 0; streakRef.current = 0; livesRef.current = 3; correctRef.current = 0; roundRef.current = 0
    ruleRef.current = 'color'; setRule('color')
    setScore(0); setStreak(0); setLives(3); setMilestone(null)
    isRunning.current = true
    setPhase('play')
    nextObj()
  }, [nextObj])

  useEffect(() => () => { isRunning.current = false; clearInterval(barTimer.current) }, [])

  const exitPlay = useCallback(() => {
    if (isRunning.current) {
      isRunning.current = false
      clearInterval(barTimer.current)
      if (scoreRef.current > 0) {
        addXp(Math.floor(scoreRef.current * 0.3))
        setHighScore('speed-sort', scoreRef.current)
      }
    }
    onExit()
  }, [addXp, setHighScore, onExit])

  const choose = useCallback((side: 0 | 1) => {
    if (!isRunning.current || feedback) return
    clearInterval(barTimer.current)
    const truth = binValue(ruleRef.current, obj)
    const ok = truth === side
    setFeedback({ side: side === 0 ? 'left' : 'right', ok })
    if (ok) {
      streakRef.current++; correctRef.current++
      setStreak(streakRef.current)
      const pts = 20 + streakRef.current * 2
      scoreRef.current += pts; setScore(scoreRef.current)
      snd('correct'); vibrate(8)
      if (streakRef.current > 0 && streakRef.current % 5 === 0) {
        const bonus = 50 * (streakRef.current / 5)
        scoreRef.current += bonus; setScore(scoreRef.current)
        snd('milestone'); vibrate([15, 30, 15])
        setMilestone(`STREAK ×${streakRef.current} BONUS +${bonus}`)
        setTimeout(() => setMilestone(null), 900)
      }
      setTimeout(nextObj, 160)
    } else {
      streakRef.current = 0; setStreak(0)
      livesRef.current--; setLives(livesRef.current)
      snd('wrong'); vibrate(30); setShake(x => x + 1)
      if (livesRef.current <= 0) { setTimeout(doEnd, 350); return }
      setTimeout(nextObj, 350)
    }
  }, [obj, feedback, nextObj, doEnd])

  const best = highScores['speed-sort'] ?? 0
  const xp = Math.floor(score * 0.3)

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#FF6B6B' }} />
        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#4CC9F0' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>SPEED SORT</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>CLASSIFY WITH A SINGLE TAP</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('speed-sort')) start(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', background: BG, position: 'relative', fontFamily: 'system-ui,sans-serif' }}>
      <HowToPlayOverlay bg={BG} accent="#1A1A2E" textColor="#1A1A2E" mutedColor="#999" bullets={TUTORIALS['speed-sort']} onStart={() => { markTutorialSeen('speed-sort'); start() }} />
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>GAME OVER</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>SORTED</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{correctRef.current}</p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>XP +{xp}</p>
      {score > 0 && score >= best && <p style={{ fontSize: 11, color: '#E9B213', fontWeight: 800, margin: 0, letterSpacing: '0.15em' }}>NEW BEST</p>}
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

  const objSize = obj.size === 0 ? 44 : 26
  const objColor = COLORS[obj.color]
  const binLabel = (side: 0 | 1) => {
    if (rule === 'color') return <div style={{ width: 26, height: 26, borderRadius: '50%', background: COLORS[side] }} />
    if (rule === 'shape') return <ShapeIcon shape={side} size={26} color="#1A1A2E" />
    return <span style={{ fontWeight: 900, fontSize: 12 }}>{side === 0 ? 'BIG' : 'SMALL'}</span>
  }

  return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 4px', flexShrink: 0 }}>
        <button onClick={exitPlay} style={{ background: 'none', border: 'none', color: '#CCC', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>SCORE</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
        </div>
        <LivesHearts lives={lives} maxLives={3} color="#FF6B6B" />
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: '#A78BFA', margin: '2px 0 0' }}>{RULE_LABEL[rule]}</p>
      {streak > 1 && <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#BBB', margin: 0 }}>STREAK ×{streak}</p>}

      <motion.div key={shake} animate={feedback?.ok === false ? { x: [0, -8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.3 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, position: 'relative' }}>

        <AnimatePresence>
          {milestone && (
            <motion.p key={milestone} initial={{ y: 10, opacity: 0, scale: 0.8 }} animate={{ y: -50, opacity: 1, scale: 1.1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '8%', fontSize: 13, fontWeight: 900, color: '#E9B213', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              {milestone}
            </motion.p>
          )}
        </AnimatePresence>

        <div style={{ width: 220, height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(0,0,0,0.08)' }}>
          <div style={{ height: '100%', borderRadius: 3, width: `${barPct}%`, background: barPct > 30 ? '#86EFAC' : '#FF6B6B', transition: 'none' }} />
        </div>

        <motion.div key={obj.born} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          style={{ width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShapeIcon shape={obj.shape} size={objSize} color={objColor} />
        </motion.div>

        <div style={{ display: 'flex', gap: 16 }}>
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => choose(0)}
            style={{ width: 110, height: 64, borderRadius: 16, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: feedback?.side === 'left' ? (feedback.ok ? '#86EFAC' : '#FCA5A5') : 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            {binLabel(0)}
          </motion.button>
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => choose(1)}
            style={{ width: 110, height: 64, borderRadius: 16, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: feedback?.side === 'right' ? (feedback.ok ? '#86EFAC' : '#FCA5A5') : 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            {binLabel(1)}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
