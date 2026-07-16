import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import LivesHearts from '../../components/games/LivesHearts'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import { hasSeenTutorial, markTutorialSeen, TUTORIALS } from '../../lib/tutorials'

const BG = '#FFF9E8'
const COLORS = [
  { name: 'RED', hex: '#FF6B6B' },
  { name: 'BLUE', hex: '#4CC9F0' },
  { name: 'GREEN', hex: '#34D399' },
  { name: 'GOLD', hex: '#F5B942' },
  { name: 'PURPLE', hex: '#A78BFA' },
]

interface Round { wordIdx: number; inkIdx: number; options: number[]; born: number }

function stageOf(correct: number) { return Math.min(1 + Math.floor(correct / 5), 8) }
function numOptions(stage: number) { return Math.min(3 + Math.floor(stage / 2), COLORS.length) }
function roundDuration(stage: number) { return Math.max(950, 2200 - stage * 150) }

function genRound(stage: number): Round {
  const wordIdx = Math.floor(Math.random() * COLORS.length)
  let inkIdx = Math.floor(Math.random() * COLORS.length)
  while (inkIdx === wordIdx) inkIdx = Math.floor(Math.random() * COLORS.length)

  const n = numOptions(stage)
  const opts = new Set<number>([inkIdx])
  const pool = COLORS.map((_, i) => i).filter(i => i !== inkIdx).sort(() => Math.random() - 0.5)
  for (const i of pool) { if (opts.size >= n) break; opts.add(i) }
  return { wordIdx, inkIdx, options: [...opts].sort(() => Math.random() - 0.5), born: Date.now() }
}

function scoreLabel(ms: number): [string, number, string] {
  if (ms < 300) return ['PERFECT', 150, '#34D399']
  if (ms < 600) return ['FAST', 100, '#4CC9F0']
  if (ms < 1000) return ['GOOD', 60, '#A78BFA']
  return ['SLOW', 30, '#F5B942']
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

export default function ColorStroopGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [round, setRound] = useState<Round>(() => genRound(1))
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [lives, setLives] = useState(3)
  const [barPct, setBarPct] = useState(100)
  const [feedback, setFeedback] = useState<{ idx: number; ok: boolean } | null>(null)
  const [milestone, setMilestone] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const scoreRef = useRef(0), streakRef = useRef(0), bestStreakRef = useRef(0), livesRef = useRef(3)
  const isRunning = useRef(false)
  const barTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)

  const doEnd = useCallback(() => {
    isRunning.current = false; clearInterval(barTimer.current)
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.35))
    setHighScore('color-stroop', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const nextRound = useCallback(() => {
    const st = stageOf(streakRef.current)
    const r = genRound(st)
    setRound(r)
    setBarPct(100); clearInterval(barTimer.current)
    const dur = roundDuration(st)
    const s = Date.now()
    barTimer.current = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - s) / dur) * 100)
      setBarPct(pct)
      if (pct <= 0) {
        clearInterval(barTimer.current)
        if (!isRunning.current) return
        streakRef.current = 0; setStreak(0)
        livesRef.current--; setLives(livesRef.current)
        snd('wrong'); vibrate(35); setShake(x => x + 1)
        if (livesRef.current <= 0) { doEnd(); return }
        setTimeout(nextRound, 300)
      }
    }, 30)
  }, [doEnd])

  const start = useCallback(() => {
    scoreRef.current = 0; streakRef.current = 0; bestStreakRef.current = 0; livesRef.current = 3
    setScore(0); setStreak(0); setLives(3); setFeedback(null); setMilestone(null)
    isRunning.current = true
    setPhase('play')
    nextRound()
  }, [nextRound])

  const answer = useCallback((colorIdx: number, optIdx: number) => {
    if (!isRunning.current || feedback) return
    clearInterval(barTimer.current)
    const reaction = Date.now() - round.born
    if (colorIdx === round.inkIdx) {
      const [, pts] = scoreLabel(reaction)
      streakRef.current++
      const s = streakRef.current
      setStreak(s)
      if (s > bestStreakRef.current) bestStreakRef.current = s
      scoreRef.current += pts; setScore(scoreRef.current)
      setFeedback({ idx: optIdx, ok: true })
      snd('correct'); vibrate(10)
      if (s > 0 && s % 5 === 0) {
        const bonus = 50 * (s / 5)
        scoreRef.current += bonus; setScore(scoreRef.current)
        snd('milestone'); vibrate([15, 30, 15])
        setMilestone(`STREAK ×${s} BONUS +${bonus}`)
        setTimeout(() => setMilestone(null), 900)
      }
      setTimeout(() => { setFeedback(null); nextRound() }, 220)
    } else {
      streakRef.current = 0; setStreak(0)
      livesRef.current--; setLives(livesRef.current)
      setFeedback({ idx: optIdx, ok: false })
      snd('wrong'); vibrate(35); setShake(x => x + 1)
      if (livesRef.current <= 0) { setTimeout(doEnd, 350); return }
      setTimeout(() => { setFeedback(null); nextRound() }, 380)
    }
  }, [round, feedback, nextRound, doEnd])

  useEffect(() => () => { isRunning.current = false; clearInterval(barTimer.current) }, [])

  const best = highScores['color-stroop'] ?? 0
  const xp = Math.floor(score * 0.35)

  // ── How to play ──────────────────────────────────────────────────────
  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <HowToPlayOverlay
        bg={BG}
        accent="#1A1A2E"
        bullets={TUTORIALS['color-stroop']}
        onStart={() => { markTutorialSeen('color-stroop'); start() }}
      />
    </div>
  )

  // ── Start screen ──────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <p style={{ fontSize: 30, fontWeight: 900, margin: 0, color: '#4CC9F0' }}>RED</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {COLORS.slice(0, 4).map(c => (
            <div key={c.name} style={{ width: 28, height: 28, borderRadius: 8, background: c.hex, boxShadow: `0 4px 10px ${c.hex}55` }} />
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>COLOR STROOP</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>TAP THE INK COLOR · NOT THE WORD</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('color-stroop')) start(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  // ── Game over screen ─────────────────────────────────────────────────
  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>GAME OVER</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>BEST STREAK</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>×{bestStreakRef.current}</p>
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

  // ── Play screen ──────────────────────────────────────────────────────
  const cols = round.options.length <= 3 ? 3 : round.options.length === 4 ? 2 : 3
  return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 4px', flexShrink: 0 }}>
        <button onClick={() => {
          if (isRunning.current) {
            isRunning.current = false
            clearInterval(barTimer.current)
            if (scoreRef.current > 0) {
              addXp(Math.floor(scoreRef.current * 0.35))
              setHighScore('color-stroop', scoreRef.current)
            }
          }
          onExit()
        }} style={{ background: 'none', border: 'none', color: '#CCC', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>SCORE</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
        </div>
        <LivesHearts lives={lives} maxLives={3} color="#FF6B6B" />
      </div>

      <div style={{ textAlign: 'center', height: 20, flexShrink: 0 }}>
        <AnimatePresence>
          {streak > 1 && (
            <motion.p key={streak} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.1em', color: '#A78BFA', margin: 0 }}>
              STREAK ×{streak}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <motion.div key={shake} animate={feedback?.ok === false ? { x: [0, -8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.35 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: '0 24px', position: 'relative' }}>

        <AnimatePresence>
          {milestone && (
            <motion.p key={milestone} initial={{ y: 10, opacity: 0, scale: 0.8 }} animate={{ y: -50, opacity: 1, scale: 1.1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '26%', fontSize: 13, fontWeight: 900, color: '#E9B213', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              {milestone}
            </motion.p>
          )}
        </AnimatePresence>

        <p key={round.born} style={{ fontSize: 42, fontWeight: 900, letterSpacing: '0.02em', margin: 0, color: COLORS[round.inkIdx].hex, filter: `drop-shadow(0 3px 10px ${COLORS[round.inkIdx].hex}55)` }}>
          {COLORS[round.wordIdx].name}
        </p>

        <div style={{ width: 260, height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(0,0,0,0.08)' }}>
          <div style={{ height: '100%', borderRadius: 3, width: `${barPct}%`, background: barPct > 30 ? '#86EFAC' : '#FF6B6B', transition: 'none' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, width: cols === 2 ? 220 : 280 }}>
          {round.options.map((idx, optIdx) => {
            const isPicked = feedback?.idx === optIdx
            const showCorrect = feedback && idx === round.inkIdx
            const showWrong = feedback?.ok === false && isPicked && idx !== round.inkIdx
            return (
              <motion.button
                key={`${round.born}-${idx}`}
                whileTap={{ scale: 0.92 }}
                onClick={() => answer(idx, optIdx)}
                animate={showCorrect ? { scale: [1, 1.1, 1] } : {}}
                style={{
                  width: 64, height: 64, borderRadius: 16, border: 'none', cursor: 'pointer',
                  background: COLORS[idx].hex,
                  boxShadow: showCorrect ? `0 0 0 3px white, 0 0 0 6px #34D399` : showWrong ? `0 0 0 3px white, 0 0 0 6px #FF6B6B` : `0 4px 12px ${COLORS[idx].hex}55`,
                }}
              />
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
