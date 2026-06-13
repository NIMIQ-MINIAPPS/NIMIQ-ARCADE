import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { getGameTheme } from '../../lib/gameThemes'
import { GameShell, StartOverlay, GameOverOverlay } from '../../components/games/GameShell'

const T = getGameTheme('word-fresh')

const WORDS_3 = ['THE','AND','FOR','ARE','BUT','NOT','YOU','ALL','CAN','HER','WAS','ONE','OUR','OUT','DAY','HAD','HOT','OIL','SIT','NOW','OLD','TOP','RED','SUN','RUN','FUN','TEN','BIG','CUT','PUT','SET','HIT','LET','MAP','DIG','PIN','WIN']
const WORDS_4 = ['GAME','PLAY','WORD','FALL','RAIN','GOLD','JUMP','FISH','SHIP','WIND','STAR','FIRE','MOON','SAND','TREE','BIRD','WOLF','BEAR','HILL','LAKE','MINE','COIN','FLIP','PUSH','PULL','LIFT','TURN','SPIN','GLOW','DARK']
const WORDS_5 = ['WORLD','FRESH','BRAIN','QUEST','FLAME','STORM','LIGHT','MAGIC','TOWER','STONE','PEARL','RIVER','DREAM','POWER','STEEL','SHARP','CORAL','BLOOM','FROST','OCEAN']
const ALL_WORDS = [...WORDS_3, ...WORDS_4, ...WORDS_5]

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

interface FallingLetter { id: number; letter: string; x: number; y: number; speed: number }

let nextLetterId = 0

export default function WordFreshGame({ onExit }: { onExit: () => void }) {
  const { addXp, setHighScore, highScores } = useGameStore()
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [letters, setLetters] = useState<FallingLetter[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [word, setWord] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [landed, setLanded] = useState(0)

  const scoreRef = useRef(0)
  const levelRef = useRef(1)
  const animRef = useRef(0)
  const spawnRef = useRef(0)
  const isRunning = useRef(false)
  const containerH = 460

  const spawnLetter = useCallback(() => {
    const needUseful = Math.random() < 0.6
    let letter: string
    if (needUseful) {
      const target = ALL_WORDS[Math.floor(Math.random() * ALL_WORDS.length)]
      letter = target[Math.floor(Math.random() * target.length)]
    } else {
      letter = ALPHABET[Math.floor(Math.random() * 26)]
    }
    const speed = 0.3 + levelRef.current * 0.08 + Math.random() * 0.2
    setLetters(prev => [...prev, {
      id: nextLetterId++, letter,
      x: 20 + Math.random() * 280,
      y: -30, speed,
    }])
  }, [])

  const gameLoop = useCallback(() => {
    if (!isRunning.current) return
    setLetters(prev => {
      const updated = prev.map(l => ({ ...l, y: l.y + l.speed }))
      const alive = updated.filter(l => l.y < containerH)
      const dead = updated.length - alive.length
      if (dead > 0) {
        setLanded(l => {
          const nl = l + dead
          if (nl >= 30) {
            isRunning.current = false
            addXp(Math.floor(scoreRef.current * 0.3))
            setHighScore('word-fresh', scoreRef.current)
            setGameOver(true)
          }
          return nl
        })
      }
      return alive
    })
    animRef.current = requestAnimationFrame(gameLoop)
  }, [addXp, setHighScore])

  const start = useCallback(() => {
    scoreRef.current = 0; levelRef.current = 1; nextLetterId = 0
    setScore(0); setLevel(1); setLetters([]); setSelected([]); setWord('')
    setLanded(0); setGameOver(false); setStarted(true); setFlash(null)
    isRunning.current = true
    gameLoop()
  }, [gameLoop])

  useEffect(() => {
    if (!started || gameOver) return
    const rate = Math.max(300, 1000 - levelRef.current * 60)
    spawnRef.current = window.setInterval(spawnLetter, rate)
    return () => clearInterval(spawnRef.current)
  }, [started, gameOver, spawnLetter])

  useEffect(() => {
    if (scoreRef.current > 0 && scoreRef.current % 100 === 0) {
      levelRef.current++; setLevel(levelRef.current)
    }
  }, [score])

  useEffect(() => () => { isRunning.current = false; cancelAnimationFrame(animRef.current); clearInterval(spawnRef.current) }, [])

  const toggleLetter = useCallback((id: number) => {
    if (!isRunning.current || gameOver) return
    setSelected(prev => {
      if (prev.includes(id)) {
        const ns = prev.filter(i => i !== id)
        setWord(ns.map(sid => letters.find(l => l.id === sid)?.letter ?? '').join(''))
        return ns
      }
      const ns = [...prev, id]
      setWord(ns.map(sid => letters.find(l => l.id === sid)?.letter ?? '').join(''))
      return ns
    })
  }, [letters, gameOver])

  const submitWord = useCallback(() => {
    if (word.length < 3) return
    const upper = word.toUpperCase()
    if (ALL_WORDS.includes(upper)) {
      const pts = word.length * 20 + (word.length >= 5 ? 50 : 0)
      scoreRef.current += pts; setScore(scoreRef.current)
      setFlash(`+${pts}`); setTimeout(() => setFlash(null), 600)
      setLetters(prev => prev.filter(l => !selected.includes(l.id)))
    } else {
      setFlash('NOT A WORD'); setTimeout(() => setFlash(null), 600)
    }
    setSelected([]); setWord('')
  }, [word, selected])

  const best = highScores['word-fresh'] ?? 0
  const xp = Math.floor(score * 0.3)

  return (
    <GameShell theme={T} onExit={onExit} hud={[
      { label: 'LV', value: level },
      { label: 'SCORE', value: score },
    ]} hudRight={
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-[9px] tracking-widest font-semibold" style={{ color: T.hudMuted }}>OVERFLOW</p>
          <p className="font-black text-[15px] leading-none" style={{ color: landed > 20 ? T.danger : T.accent }}>{landed}/30</p>
        </div>
      </div>
    }>
      {!started ? <StartOverlay theme={T} onStart={start} /> : (
        <div className="flex flex-col h-full">
          {/* Word builder */}
          <div className="flex items-center gap-2 px-4 py-2 shrink-0" style={{ borderBottom: `1px solid ${T.gridLine}` }}>
            <div className="flex-1 h-10 rounded-xl flex items-center px-3 font-black text-lg tracking-wider"
              style={{ background: T.surface, color: word ? T.hudText : T.hudMuted, minWidth: 0 }}>
              {word || 'TAP LETTERS...'}
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={submitWord}
              className="px-4 h-10 rounded-xl font-black text-sm"
              style={{ background: word.length >= 3 ? T.accent : T.surface, color: word.length >= 3 ? T.accentText : T.hudMuted }}>
              GO
            </motion.button>
          </div>

          {flash && (
            <motion.div initial={{ y: 0, opacity: 1 }} animate={{ y: -30, opacity: 0 }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-10 font-black text-sm pointer-events-none"
              style={{ color: flash.startsWith('+') ? T.accent : T.danger }}>{flash}</motion.div>
          )}

          {/* Falling area */}
          <div className="flex-1 relative overflow-hidden" style={{
            backgroundImage: `radial-gradient(circle, ${T.gridLine} 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}>
            <AnimatePresence>
              {letters.map(l => (
                <motion.button
                  key={l.id}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => toggleLetter(l.id)}
                  className="absolute w-11 h-11 rounded-xl font-black text-lg flex items-center justify-center"
                  style={{
                    left: l.x, top: l.y,
                    background: selected.includes(l.id) ? T.accent : T.surface,
                    color: selected.includes(l.id) ? T.accentText : T.hudText,
                    border: `1px solid ${selected.includes(l.id) ? T.accent : T.gridLine}`,
                  }}
                >{l.letter}</motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      {gameOver && (
        <GameOverOverlay theme={T} score={score} onRestart={start} onExit={onExit}
          xpEarned={xp} isNewBest={score > 0 && score >= best}
          stats={[{ label: 'LEVEL', value: level }]} />
      )}
    </GameShell>
  )
}
