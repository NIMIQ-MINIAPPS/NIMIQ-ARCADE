import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { soundMuted } from '../../lib/gameAudio'
import { vibrate } from '../../lib/haptics'
import HowToPlayOverlay from '../../components/games/HowToPlayOverlay'
import { TUTORIALS, hasSeenTutorial, markTutorialSeen } from '../../lib/tutorials'

const BG = '#FFF9E8'
const PASTELS = ['#93DCFF', '#C4B5FD', '#86EFAC', '#FDBA74', '#FCA5A5', '#FCD34D']

type Lang = 'en' | 'es'

const WORDS_EN: Record<number, string[]> = {
  3: ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'HAD', 'HOT', 'OIL', 'SIT', 'NOW', 'OLD', 'TOP', 'RED', 'SUN', 'RUN', 'FUN', 'TEN', 'BIG', 'CUT', 'PUT', 'SET', 'HIT', 'LET', 'MAP', 'DIG', 'PIN', 'WIN'],
  4: ['GAME', 'PLAY', 'WORD', 'FALL', 'RAIN', 'GOLD', 'JUMP', 'FISH', 'SHIP', 'WIND', 'STAR', 'FIRE', 'MOON', 'SAND', 'TREE', 'BIRD', 'WOLF', 'BEAR', 'HILL', 'LAKE', 'MINE', 'COIN', 'FLIP', 'PUSH', 'PULL', 'LIFT', 'TURN', 'SPIN', 'GLOW', 'DARK'],
  5: ['WORLD', 'FRESH', 'BRAIN', 'QUEST', 'FLAME', 'STORM', 'LIGHT', 'MAGIC', 'TOWER', 'STONE', 'PEARL', 'RIVER', 'DREAM', 'POWER', 'STEEL', 'SHARP', 'CORAL', 'BLOOM', 'FROST', 'OCEAN'],
  6: ['SPRING', 'ORANGE', 'PURPLE', 'SILVER', 'PLANET', 'DRAGON', 'ISLAND', 'WONDER', 'SPIRIT', 'FROZEN', 'GARDEN', 'MASTER'],
}

const WORDS_ES: Record<number, string[]> = {
  3: ['SOL', 'MAR', 'PAN', 'RIO', 'OSO', 'ALA', 'OJO', 'PIE', 'DIA', 'LUZ', 'VOZ', 'RED', 'TEA', 'RON', 'GAS', 'GEL', 'BAR', 'COL', 'MIL', 'MES', 'REY', 'LEY', 'CAL', 'SAL', 'TOS', 'PEZ', 'VID', 'FIN', 'ROL', 'ARO', 'UVA', 'AVE', 'OLA', 'RES', 'VEN', 'DAN', 'VAN', 'SON', 'HAY', 'MUY', 'SUR'],
  4: ['CASA', 'MESA', 'PATO', 'GATO', 'PERO', 'TREN', 'LUNA', 'AGUA', 'VIDA', 'AMOR', 'HOJA', 'ROPA', 'PUMA', 'LOBO', 'RANA', 'MONO', 'LAGO', 'NUBE', 'FLOR', 'PASO', 'CAFE', 'VELA', 'CIMA', 'ROCA', 'ISLA', 'DUNA', 'RAMA', 'FRIO', 'HORA', 'DADO', 'HILO', 'BOCA', 'MANO', 'PATA', 'CODO', 'DEDO', 'CUNA', 'LAZO', 'RUTA', 'SOPA', 'TAZA', 'COLA', 'CERO', 'TELA', 'PISO', 'FILA'],
  5: ['FRESA', 'NIEVE', 'VERDE', 'PLAYA', 'NOCHE', 'TARDE', 'MUNDO', 'PODER', 'MADRE', 'PADRE', 'CIELO', 'LIBRO', 'CALLE', 'TORRE', 'FUEGO', 'AGUJA', 'ABEJA', 'ARBOL', 'NUEVE', 'VIAJE', 'JOVEN', 'LLAVE', 'LUGAR', 'VOLAR', 'COMER', 'BEBER', 'DULCE', 'LIMON', 'RATON', 'CAMPO', 'PLATO'],
  6: ['VERANO', 'PUERTA', 'GRANDE', 'MOTIVO', 'CAMINO', 'ANIMAL', 'NUMERO', 'MOLINO', 'VECINO', 'PLANTA', 'MANANA', 'DINERO', 'HOMBRE', 'PARQUE', 'BOSQUE', 'SABADO', 'NOVELA', 'ESCALA', 'MEDICO', 'CAMISA', 'ZAPATO', 'CONEJO', 'PALOMA', 'HIGADO', 'ESPEJO', 'JARDIN'],
}

const WORD_SETS: Record<Lang, Record<number, string[]>> = { en: WORDS_EN, es: WORDS_ES }
const LANG_KEY = 'nim-arcade-wordfresh-lang'

function flatWords(lang: Lang): string[] {
  return Object.values(WORD_SETS[lang]).flat()
}

function buildLetterFreq(words: string[]): Record<string, number> {
  const freq: Record<string, number> = {}
  for (const w of words) for (const ch of w) freq[ch] = (freq[ch] ?? 0) + 1
  return freq
}

function weightedLetter(freq: Record<string, number>): string {
  const entries = Object.entries(freq)
  if (entries.length === 0) return ALPHABET[Math.floor(Math.random() * 26)]
  const total = entries.reduce((s, [, c]) => s + c, 0)
  let r = Math.random() * total
  for (const [letter, c] of entries) {
    r -= c
    if (r <= 0) return letter
  }
  return entries[entries.length - 1][0]
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const OVERFLOW_CAP = 24
const COMBO_WINDOW = 4500

interface FallingLetter { id: number; letter: string; x: number; y: number; speed: number; color: string }
interface Confetto { id: number; dx: number; dy: number; color: string }

let nextId = 0

function stageOf(wordsCompleted: number) { return Math.min(1 + Math.floor(wordsCompleted / 3), 10) }
function fallSpeed(stage: number) { return 0.38 + stage * 0.1 + Math.random() * 0.22 }
function spawnRate(stage: number) { return Math.max(340, 900 - stage * 55) }
function maxLetters(stage: number) { return Math.min(7 + Math.floor(stage / 2), 14) }
function usefulChance(stage: number) { return Math.max(0.42, 0.62 - stage * 0.018) }

let _ac: AudioContext | null = null
function snd(type: 'pick' | 'submit' | 'invalid' | 'land' | 'over' | 'combo') {
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
    if (type === 'pick')    n(700, t, 0.045, 0.04, 'triangle')
    if (type === 'submit')  [600, 800, 1000, 1250].forEach((f, i) => n(f, t + i * 0.05, 0.11, 0.06))
    if (type === 'combo')   [750, 950, 1200, 1500].forEach((f, i) => n(f, t + i * 0.045, 0.1, 0.06))
    if (type === 'invalid') n(200, t, 0.16, 0.1, 'sawtooth')
    if (type === 'land')    n(140, t, 0.05, 0.03, 'triangle')
    if (type === 'over')    { n(200, t, 0.4, 0.14, 'sawtooth'); n(140, t + 0.28, 0.35, 0.1, 'square') }
  } catch {/**/}
}

export default function WordFreshGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [phase, setPhase] = useState<'start' | 'howto' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [letters, setLetters] = useState<FallingLetter[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null)
  const [landed, setLanded] = useState(0)
  const [combo, setCombo] = useState(0)
  const [confetti, setConfetti] = useState<Confetto[]>([])
  const [shake, setShake] = useState(0)
  const [language, setLanguage] = useState<Lang>(() => {
    try { return (localStorage.getItem(LANG_KEY) as Lang) || 'en' } catch { return 'en' }
  })

  const scoreRef = useRef(0), wordsRef = useRef(0), landedRef = useRef(0), comboRef = useRef(0), lastSubmit = useRef(0)
  const animRef = useRef(0), spawnRef = useRef<ReturnType<typeof setInterval>>(0 as unknown as ReturnType<typeof setInterval>)
  const isRunning = useRef(false)
  const endedRef = useRef(false)
  const allWordsRef = useRef<string[]>(flatWords(language))
  const freqRef = useRef<Record<string, number>>(buildLetterFreq(allWordsRef.current))
  const containerH = 460

  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, language) } catch { /* ignore */ }
    const flat = flatWords(language)
    allWordsRef.current = flat
    freqRef.current = buildLetterFreq(flat)
  }, [language])

  const word = selected.map(id => letters.find(l => l.id === id)?.letter ?? '').join('')

  const spawnLetter = useCallback(() => {
    const st = stageOf(wordsRef.current)
    const useful = Math.random() < usefulChance(st)
    const letter = useful ? weightedLetter(freqRef.current) : ALPHABET[Math.floor(Math.random() * 26)]
    setLetters(prev => {
      if (prev.length >= maxLetters(st)) return prev
      return [...prev, { id: nextId++, letter, x: 16 + Math.random() * 284, y: -30, speed: fallSpeed(st), color: PASTELS[Math.floor(Math.random() * PASTELS.length)] }]
    })
  }, [])

  const doEnd = useCallback(() => {
    if (endedRef.current) return
    endedRef.current = true
    isRunning.current = false
    snd('over'); vibrate([30, 40, 60])
    addXp(Math.floor(scoreRef.current * 0.3))
    setHighScore('word-fresh', scoreRef.current)
    setPhase('over')
  }, [addXp, setHighScore])

  const exitMidGame = useCallback(() => {
    isRunning.current = false
    if (!endedRef.current) {
      endedRef.current = true
      addXp(Math.floor(scoreRef.current * 0.3))
      setHighScore('word-fresh', scoreRef.current)
    }
    onExit()
  }, [addXp, setHighScore, onExit])

  const gameLoop = useCallback(() => {
    if (!isRunning.current) return
    setLetters(prev => {
      const updated = prev.map(l => ({ ...l, y: l.y + l.speed }))
      const alive = updated.filter(l => l.y < containerH)
      const dead = updated.length - alive.length
      if (dead > 0) {
        snd('land'); vibrate(6)
        landedRef.current += dead
        setLanded(landedRef.current)
        if (landedRef.current >= OVERFLOW_CAP) { doEnd() }
      }
      return alive
    })
    animRef.current = requestAnimationFrame(gameLoop)
  }, [doEnd])

  const start = useCallback(() => {
    scoreRef.current = 0; wordsRef.current = 0; landedRef.current = 0; comboRef.current = 0; lastSubmit.current = 0
    nextId = 0
    endedRef.current = false
    setScore(0); setLevel(1); setLetters([]); setSelected([]); setLanded(0); setCombo(0)
    setFlash(null); setConfetti([]); setPhase('play')
    isRunning.current = true
    gameLoop()
  }, [gameLoop])

  useEffect(() => {
    if (phase !== 'play') return
    const st = stageOf(wordsRef.current)
    spawnRef.current = window.setInterval(spawnLetter, spawnRate(st))
    return () => clearInterval(spawnRef.current)
  }, [phase, level, spawnLetter])

  useEffect(() => () => { isRunning.current = false; cancelAnimationFrame(animRef.current); clearInterval(spawnRef.current) }, [])

  const toggleLetter = useCallback((id: number) => {
    if (!isRunning.current) return
    snd('pick'); vibrate(6)
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }, [])

  const burstConfetti = useCallback(() => {
    const items: Confetto[] = Array.from({ length: 14 }, (_, i) => ({
      id: nextId++, dx: (Math.random() - 0.5) * 160, dy: -40 - Math.random() * 90,
      color: PASTELS[i % PASTELS.length],
    }))
    setConfetti(items)
    setTimeout(() => setConfetti([]), 650)
  }, [])

  const submitWord = useCallback(() => {
    if (word.length < 3) return
    const upper = word.toUpperCase()
    if (allWordsRef.current.includes(upper)) {
      const now = Date.now()
      if (now - lastSubmit.current < COMBO_WINDOW) { comboRef.current++; } else { comboRef.current = 0 }
      lastSubmit.current = now
      setCombo(comboRef.current)
      const mult = 1 + comboRef.current * 0.25
      let base = word.length * 20
      if (word.length >= 5) base += 50
      if (word.length >= 6) base += 100
      const pts = Math.round(base * mult)
      scoreRef.current += pts; setScore(scoreRef.current)
      wordsRef.current++
      const newLevel = stageOf(wordsRef.current); setLevel(newLevel)
      setFlash({ text: comboRef.current > 0 ? `+${pts} · COMBO ×${comboRef.current + 1}` : `+${pts}`, ok: true })
      snd(comboRef.current > 0 ? 'combo' : 'submit'); vibrate(comboRef.current > 0 ? [10, 20, 10] : 14)
      burstConfetti()
      setTimeout(() => setFlash(null), 750)
      setLetters(prev => prev.filter(l => !selected.includes(l.id)))
    } else {
      setFlash({ text: 'NOT A WORD', ok: false })
      snd('invalid'); vibrate(30); setShake(s => s + 1)
      setTimeout(() => setFlash(null), 650)
    }
    setSelected([])
  }, [word, selected, burstConfetti])

  const best = highScores['word-fresh'] ?? 0
  const xp = Math.floor(score * 0.3)
  const dangerPct = Math.min(100, (landed / OVERFLOW_CAP) * 100)

  // ── Start screen ──────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
      <button onClick={onExit} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#BBB', fontSize: 22, cursor: 'pointer' }}>←</button>
      <div style={{ display: 'flex', gap: 8 }}>
        {['F', 'R', 'E', 'S', 'H'].map((l, i) => (
          <div key={i} style={{ width: 40, height: 40, borderRadius: 10, background: PASTELS[i % PASTELS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#1A1A2E', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', transform: `rotate(${(i - 2) * 5}deg)` }}>{l}</div>
        ))}
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: '0 0 8px', letterSpacing: '0.05em' }}>WORD FRESH</h1>
        <p style={{ color: '#BBB', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>CATCH LETTERS · BUILD WORDS</p>
      </div>
      <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 12, padding: 4 }}>
        {(['en', 'es'] as Lang[]).map(l => (
          <button key={l} onClick={() => setLanguage(l)}
            style={{
              padding: '7px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 900, letterSpacing: '0.08em',
              background: language === l ? '#1A1A2E' : 'transparent',
              color: language === l ? BG : '#999',
            }}>
            {l === 'en' ? 'EN' : 'ES'}
          </button>
        ))}
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (hasSeenTutorial('word-fresh')) start(); else setPhase('howto') }}
        style={{ background: '#1A1A2E', color: BG, border: 'none', borderRadius: 16, padding: '16px 64px', fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.12em' }}>
        PLAY
      </motion.button>
      {best > 0 && <p style={{ color: '#BBB', fontSize: 13, margin: 0 }}>BEST: {best.toLocaleString()}</p>}
    </div>
  )

  // ── How to play ───────────────────────────────────────────────────────
  if (phase === 'howto') return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: BG, fontFamily: 'system-ui,sans-serif' }}>
      <HowToPlayOverlay
        bg={BG}
        accent="#1A1A2E"
        textColor="#1A1A2E"
        mutedColor="#BBB"
        bullets={TUTORIALS['word-fresh']}
        onStart={() => { markTutorialSeen('word-fresh'); start() }}
      />
    </div>
  )

  // ── Game over screen ─────────────────────────────────────────────────
  if (phase === 'over') return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'system-ui,sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#FF6B6B', letterSpacing: '0.22em', margin: 0 }}>LETTERS OVERFLOWED</p>
      <p style={{ fontSize: 52, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1 }}>{scoreRef.current.toLocaleString()}</p>
      <div style={{ display: 'flex', gap: 36 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>LEVEL</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{level}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>WORDS</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{wordsRef.current}</p>
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
  return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 4px', flexShrink: 0 }}>
        <button onClick={exitMidGame} style={{ background: 'none', border: 'none', color: '#CCC', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>LV</p>
            <p style={{ fontSize: 18, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{level}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>SCORE</p>
            <p style={{ fontSize: 18, fontWeight: 900, color: '#1A1A2E', margin: 0, lineHeight: 1.1 }}>{score.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right', width: 66 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#BBB', margin: 0 }}>OVERFLOW</p>
          <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.08)', overflow: 'hidden', marginTop: 3 }}>
            <div style={{ height: '100%', width: `${dangerPct}%`, background: dangerPct > 65 ? '#FF6B6B' : '#86EFAC', transition: 'width 0.2s' }} />
          </div>
        </div>
      </div>

      {combo > 0 && (
        <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', color: '#C4B5FD', margin: '2px 0 0' }}>
          COMBO ×{combo + 1}
        </p>
      )}

      <motion.div key={shake} animate={flash && !flash.ok ? { x: [0, -6, 6, -4, 4, 0] } : {}} transition={{ duration: 0.3 }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', flexShrink: 0 }}>
        <div style={{ flex: 1, minHeight: 40, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', background: 'white', border: '1px solid rgba(0,0,0,0.08)', flexWrap: 'wrap' }}>
          {selected.length === 0 && <span style={{ color: '#CCC', fontWeight: 700, fontSize: 13 }}>TAP LETTERS...</span>}
          {selected.map(id => {
            const l = letters.find(x => x.id === id)
            if (!l) return null
            return <span key={id} style={{ fontWeight: 900, fontSize: 15, color: '#1A1A2E', padding: '3px 7px', borderRadius: 6, background: l.color }}>{l.letter}</span>
          })}
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={submitWord}
          style={{ padding: '10px 18px', borderRadius: 12, fontWeight: 900, fontSize: 13, border: 'none', cursor: 'pointer', background: word.length >= 3 ? '#86EFAC' : '#EEE', color: word.length >= 3 ? '#14532D' : '#AAA' }}>
          GO
        </motion.button>
      </motion.div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', margin: '0 12px 12px', borderRadius: 16, background: 'rgba(0,0,0,0.02)' }}>
        <AnimatePresence>
          {flash && (
            <motion.div key={flash.text} initial={{ y: 0, opacity: 1, scale: 0.9 }} animate={{ y: -34, opacity: 0, scale: 1.05 }} transition={{ duration: 0.7 }}
              style={{ position: 'absolute', top: 12, left: '50%', translate: '-50% 0', zIndex: 20, fontWeight: 900, fontSize: 14, color: flash.ok ? '#27AE60' : '#FF6B6B', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              {flash.text}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confetti.map(c => (
            <motion.span key={c.id}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: c.dx, y: c.dy, opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ position: 'absolute', top: 20, left: '50%', width: 8, height: 8, borderRadius: 3, background: c.color, pointerEvents: 'none', zIndex: 15 }}
            />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {letters.map(l => (
            <motion.button key={l.id}
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} whileTap={{ scale: 0.85 }}
              onClick={() => toggleLetter(l.id)}
              className="absolute w-11 h-11 rounded-xl font-black text-lg flex items-center justify-center"
              style={{
                left: l.x, top: l.y,
                background: selected.includes(l.id) ? '#1A1A2E' : l.color,
                color: selected.includes(l.id) ? BG : '#1A1A2E',
                boxShadow: selected.includes(l.id) ? '0 4px 14px rgba(0,0,0,0.25)' : '0 2px 6px rgba(0,0,0,0.08)',
              }}
            >{l.letter}</motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
