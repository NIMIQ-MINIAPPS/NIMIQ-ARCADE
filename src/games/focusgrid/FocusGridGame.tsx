import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import LivesHearts from '../../components/games/LivesHearts'

const BG = '#FFF9E8'

interface RoundData { size: number; hue: number; odd: number; diff: number }

function stageOf(correct: number) { return 1 + Math.floor(correct / 3) }
function gridSize(stage: number) { return Math.min(3 + Math.floor(stage / 2), 9) }
function diffAmount(stage: number) { return Math.max(4, 22 - stage * 1.6) }
function roundTime(stage: number) { return Math.max(1600, 5000 - stage * 260) }

function genRound(stage: number): RoundData {
  const size = gridSize(stage)
  const hue = Math.floor(Math.random() * 360)
  const odd = Math.floor(Math.random() * size * size)
  return { size, hue, odd, diff: diffAmount(stage) }
}

let _ac: AudioContext | null = null
function snd(type: 'correct' | 'wrong' | 'milestone' | 'over') {
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
    if (type === 'over')      { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

export default function FocusGridGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [round, setRound] = useState<RoundData>(() => genRound(1))
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [lives, setLives] = useState(3)
  const [barPct, setBarPct] = useState(100)
  const [revealOdd, setRevealOdd] = useState(false)
  const [wrongIdx, setWrongIdx] = useState<number | null>(null)
  const [milestone, setMilestone] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const scoreRef = useRef(0), streakRef = useRef(0), livesRef = useRef(3), correctRef = useRef(0)
  const isRunning = useRef(false)
  const barTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const roundBorn = useRef(0)

  const doEnd = useCallback(() => {
    isRunning.current = false; clearInterval(barTimer.current)
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.35))
    setHighScore('focus-grid', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const nextRound = useCallback(() => {
    const st = stageOf(correctRef.current)
    const r = genRound(st)
    setRound(r); setRevealOdd(false); setWrongIdx(null)
    roundBorn.current = Date.now()
    setBarPct(100); clearInterval(barTimer.current)
    const dur = roundTime(st)
    barTimer.current = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - roundBorn.current) / dur) * 100)
      setBarPct(pct)
      if (pct <= 0) {
        clearInterval(barTimer.current)
        if (!isRunning.current) return
        streakRef.current = 0; setStreak(0)
        livesRef.current--; setLives(livesRef.current)
        snd('wrong'); vibrate(35); setShake(x => x + 1); setRevealOdd(true)
        if (livesRef.current <= 0) { setTimeout(doEnd, 500); return }
        setTimeout(nextRound, 650)
      }
    }, 30)
  }, [doEnd])

  const start = useCallback(() => {
    scoreRef.current = 0; streakRef.current = 0; livesRef.current = 3; correctRef.current = 0
    setScore(0); setStreak(0); setLives(3); setMilestone(null)
    isRunning.current = true
    setPhase('play')
    nextRound()
  }, [nextRound])

  useEffect(() => () => { isRunning.current = false; clearInterval(barTimer.current) }, [])

  const exitPlay = useCallback(() => {
    if (isRunning.current) {
      isRunning.current = false
      clearInterval(barTimer.current)
      if (scoreRef.current > 0) {
        addXp(Math.floor(scoreRef.current * 0.35))
        setHighScore('focus-grid', scoreRef.current)
      }
    }
    onExit()
  }, [addXp, setHighScore, onExit])

  const tapTile = useCallback((idx: number) => {
    if (!isRunning.current || revealOdd) return
    clearInterval(barTimer.current)
    if (idx === round.odd) {
      const reaction = Date.now() - roundBorn.current
      const dur = roundTime(stageOf(correctRef.current))
      const speedBonus = Math.max(0, Math.floor(((dur - reaction) / dur) * 40))
      const pts = 40 + speedBonus + streakRef.current * 3
      streakRef.current++; setStreak(streakRef.current)
      correctRef.current++
      scoreRef.current += pts; setScore(scoreRef.current)
      setRevealOdd(true)
      snd('correct'); vibrate(10)
      if (streakRef.current > 0 && streakRef.current % 5 === 0) {
        const bonus = 60 * (streakRef.current / 5)
        scoreRef.current += bonus; setScore(scoreRef.current)
        snd('milestone'); vibrate([15, 30, 15])
        setMilestone(`STREAK ×${streakRef.current} BONUS +${bonus}`)
        setTimeout(() => setMilestone(null), 900)
      }
      setTimeout(nextRound, 350)
    } else {
      streakRef.current = 0; setStreak(0)
      livesRef.current--; setLives(livesRef.current)
      setWrongIdx(idx); setRevealOdd(true)
      snd('wrong'); vibrate(35); setShake(x => x + 1)
      if (livesRef.current <= 0) { setTimeout(doEnd, 500); return }
      setTimeout(nextRound, 650)
    }
  }, [round, revealOdd, nextRound, doEnd])

  const best = highScores['focus-grid'] ?? 0
  const xp = Math.floor(score * 0.35)

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,26px)', gap: 4 }}>
        {Array.from({ length: 25 }, (_, i) => (
          <div key={i} style={{ width: 26, height: 26, borderRadius: 6, background: i === 12 ? 'hsl(210,65%,50%)' : 'hsl(210,65%,60%)' }} />
        ))}
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>FOCUS GRID</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>FIND THE ODD ONE OUT</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('focus-grid')) start(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', background: BG, position: 'relative', fontFamily: 'system-ui,sans-serif' }}>
      <HowToPlayOverlay bg={BG} accent="#1A1A2E" textColor="#1A1A2E" mutedColor="#999" bullets={TUTORIALS['focus-grid']} onStart={() => { markTutorialSeen('focus-grid'); start() }} />
    </div>
  )

  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>GAME OVER</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>FOUND</p>
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

  const cell = Math.min(52, Math.floor(300 / round.size) - 6)
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

      <div style={{ textAlign: 'center', height: 20, flexShrink: 0 }}>
        {streak > 1 && (
          <p style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.1em', color: '#A78BFA', margin: 0 }}>STREAK ×{streak}</p>
        )}
      </div>

      <motion.div key={shake} animate={wrongIdx !== null ? { x: [0, -8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.35 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, position: 'relative' }}>

        <AnimatePresence>
          {milestone && (
            <motion.p key={milestone} initial={{ y: 10, opacity: 0, scale: 0.8 }} animate={{ y: -50, opacity: 1, scale: 1.1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '10%', fontSize: 13, fontWeight: 900, color: '#E9B213', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              {milestone}
            </motion.p>
          )}
        </AnimatePresence>

        <div style={{ width: 260, height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(0,0,0,0.08)' }}>
          <div style={{ height: '100%', borderRadius: 3, width: `${barPct}%`, background: barPct > 30 ? '#86EFAC' : '#FF6B6B', transition: 'none' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${round.size}, ${cell}px)`, gap: 5 }}>
          {Array.from({ length: round.size * round.size }, (_, i) => {
            const isOdd = i === round.odd
            const light = isOdd ? 60 - round.diff : 60
            return (
              <motion.button
                key={`${round.hue}-${round.size}-${i}`}
                whileTap={{ scale: 0.9 }}
                onClick={() => tapTile(i)}
                style={{
                  width: cell, height: cell, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: `hsl(${round.hue}, 65%, ${light}%)`,
                  boxShadow: revealOdd && isOdd ? '0 0 0 3px white, 0 0 0 6px #34D399' : wrongIdx === i ? '0 0 0 3px white, 0 0 0 6px #FF6B6B' : 'none',
                }}
              />
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
