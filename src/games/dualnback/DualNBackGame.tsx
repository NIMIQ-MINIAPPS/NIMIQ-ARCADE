import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'

const BG = '#FFF9E8'
const LETTERS = ['B', 'D', 'F', 'G', 'K', 'P', 'Q', 'T']
const NOTE: Record<string, number> = { B: 392, D: 440, F: 494, G: 523, K: 587, P: 659, Q: 698, T: 784 }

interface Stim { pos: number; letter: string }

function stageOf(hits: number) { return Math.min(1 + Math.floor(hits / 6), 4) }
function turnDuration(stage: number) { return Math.max(1500, 3000 - stage * 220) }

function genStim(seq: Stim[], n: number): Stim {
  const back = seq.length >= n ? seq[seq.length - n] : null
  const pos = back && Math.random() < 0.35 ? back.pos : Math.floor(Math.random() * 9)
  const letter = back && Math.random() < 0.35 ? back.letter : LETTERS[Math.floor(Math.random() * LETTERS.length)]
  return { pos, letter }
}

let _ac: AudioContext | null = null
function snd(type: 'stim' | 'hit' | 'miss' | 'levelup' | 'over') {
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
    if (type === 'stim')    {/* handled via playLetter for pitch variety */}
    if (type === 'hit')     [700, 1000].forEach((f, i) => n(f, t + i * 0.05, 0.09, 0.06))
    if (type === 'miss')    n(190, t, 0.18, 0.12, 'sawtooth')
    if (type === 'levelup') [600, 800, 1050, 1350].forEach((f, i) => n(f, t + i * 0.06, 0.11, 0.07))
    if (type === 'over')    { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}
function playLetter(letter: string) {
  if (soundMuted) return
  try {
    if (!_ac) _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
    const c = _ac, t = c.currentTime
    const osc = c.createOscillator(), g = c.createGain()
    osc.type = 'triangle'; osc.frequency.setValueAtTime(NOTE[letter] ?? 500, t)
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    osc.connect(g); g.connect(c.destination); osc.start(t); osc.stop(t + 0.18)
  } catch {/**/}
}

export default function DualNBackGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [activePos, setActivePos] = useState<number | null>(null)
  const [activeLetter, setActiveLetter] = useState<string | null>(null)
  const [n, setN] = useState(1)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [lives, setLives] = useState(3)
  const [posState, setPosState] = useState<'idle' | 'pressed' | 'correct' | 'wrong'>('idle')
  const [letState, setLetState] = useState<'idle' | 'pressed' | 'correct' | 'wrong'>('idle')
  const [flash, setFlash] = useState<string | null>(null)

  const seqRef = useRef<Stim[]>([]), turnRef = useRef(-1)
  const nRef = useRef(1), scoreRef = useRef(0), streakRef = useRef(0), livesRef = useRef(3), hitsRef = useRef(0)
  const pressedPos = useRef(false), pressedLet = useRef(false)
  const tickTimer = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const isRunning = useRef(false)

  const doEnd = useCallback(() => {
    isRunning.current = false; clearInterval(tickTimer.current)
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.4))
    setHighScore('dual-n-back', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const award = useCallback((channel: 'pos' | 'let', ok: boolean, isTruePositive: boolean) => {
    const setState = channel === 'pos' ? setPosState : setLetState
    if (ok) {
      const pts = isTruePositive ? 25 + streakRef.current * 2 : 3
      scoreRef.current += pts; setScore(scoreRef.current)
      if (isTruePositive) { streakRef.current++; setStreak(streakRef.current); hitsRef.current++ }
      setState('correct')
    } else {
      streakRef.current = 0; setStreak(0)
      livesRef.current--; setLives(livesRef.current)
      snd('miss'); vibrate(30)
      setState('wrong')
    }
  }, [])

  const tick = useCallback(() => {
    const seq = seqRef.current
    const t = turnRef.current
    if (t >= nRef.current) {
      const back = seq[t - nRef.current], cur = seq[t]
      const truthPos = back.pos === cur.pos, truthLet = back.letter === cur.letter
      award('pos', pressedPos.current === truthPos, truthPos)
      award('let', pressedLet.current === truthLet, truthLet)
      if (livesRef.current <= 0) { doEnd(); return }
      const newStage = stageOf(hitsRef.current)
      if (newStage > nRef.current) {
        nRef.current = newStage; setN(newStage)
        snd('levelup'); vibrate([15, 30, 15])
        setFlash(`N-BACK ${newStage}`); setTimeout(() => setFlash(null), 900)
      }
    }
    turnRef.current++
    const stim = genStim(seq, nRef.current)
    seq.push(stim)
    setActivePos(stim.pos); setActiveLetter(stim.letter)
    playLetter(stim.letter)
    pressedPos.current = false; pressedLet.current = false
    setPosState('idle'); setLetState('idle')
    setTimeout(() => { if (isRunning.current) setActivePos(-1) }, Math.min(900, turnDuration(nRef.current) * 0.55))
  }, [award, doEnd])

  const start = useCallback(() => {
    seqRef.current = []; turnRef.current = -1
    nRef.current = 1; scoreRef.current = 0; streakRef.current = 0; livesRef.current = 3; hitsRef.current = 0
    setN(1); setScore(0); setStreak(0); setLives(3); setActivePos(null); setActiveLetter(null); setFlash(null)
    setPosState('idle'); setLetState('idle')
    isRunning.current = true
    setPhase('play')
    tick()
  }, [tick])

  // Re-arm interval whenever the stage's turn duration changes
  useEffect(() => {
    if (phase !== 'play') return
    clearInterval(tickTimer.current)
    tickTimer.current = setInterval(tick, turnDuration(n))
    return () => clearInterval(tickTimer.current)
  }, [phase, n, tick])

  useEffect(() => () => { isRunning.current = false; clearInterval(tickTimer.current) }, [])

  const pressPosition = useCallback(() => {
    if (!isRunning.current || pressedPos.current) return
    pressedPos.current = true; setPosState('pressed'); snd('hit'); vibrate(8)
  }, [])
  const pressLetter = useCallback(() => {
    if (!isRunning.current || pressedLet.current) return
    pressedLet.current = true; setLetState('pressed'); snd('hit'); vibrate(8)
  }, [])

  const best = highScores['dual-n-back'] ?? 0
  const xp = Math.floor(score * 0.4)

  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,26px)', gap: 4 }}>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{ width: 26, height: 26, borderRadius: 6, background: i === 4 ? '#C4B5FD' : 'white', boxShadow: i === 4 ? '0 0 10px #C4B5FD' : '0 1px 3px rgba(0,0,0,0.08)' }} />
        ))}
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>DUAL N-BACK</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>MATCH POSITION & LETTER FROM N BACK</p>
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={start}
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
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>N-BACK</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{n}</p>
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

  const btnStyle = (state: string) => ({
    flex: 1, padding: '16px 0', borderRadius: 16, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 14, letterSpacing: '0.08em',
    background: state === 'correct' ? '#86EFAC' : state === 'wrong' ? '#FCA5A5' : state === 'pressed' ? '#1A1A2E' : 'white',
    color: state === 'pressed' ? 'white' : '#1A1A2E',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  })

  return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 4px', flexShrink: 0 }}>
        <button onClick={() => { isRunning.current = false; onExit() }} style={{ background: 'none', border: 'none', color: '#CCC', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>N</p>
            <p style={{ fontSize: 17, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{n}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 17, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i < lives ? '#FF6B6B' : 'rgba(0,0,0,0.1)' }} />)}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, position: 'relative' }}>
        <AnimatePresence>
          {flash && (
            <motion.p key={flash} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '14%', fontSize: 16, fontWeight: 900, color: '#C4B5FD', letterSpacing: '0.1em', margin: 0 }}>
              {flash}
            </motion.p>
          )}
        </AnimatePresence>
        {streak > 1 && <p style={{ fontSize: 11, fontWeight: 900, color: '#A78BFA', letterSpacing: '0.1em', margin: 0, position: 'absolute', top: '20%' }}>STREAK ×{streak}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,60px)', gridTemplateRows: 'repeat(3,60px)', gap: 6 }}>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} style={{
              borderRadius: 12, background: activePos === i ? '#C4B5FD' : 'white',
              boxShadow: activePos === i ? '0 0 18px #C4B5FD' : '0 1px 4px rgba(0,0,0,0.06)',
              transition: 'background 0.15s, box-shadow 0.15s',
            }} />
          ))}
        </div>

        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#1A1A2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: BG }}>{activeLetter ?? ''}</span>
        </div>

        <div style={{ display: 'flex', gap: 12, width: 280 }}>
          <button onClick={pressPosition} style={btnStyle(posState)}>POSITION</button>
          <button onClick={pressLetter} style={btnStyle(letState)}>LETTER</button>
        </div>
      </div>
    </div>
  )
}
