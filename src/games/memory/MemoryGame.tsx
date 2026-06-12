import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { ArrowLeft } from 'lucide-react'

const EMOJIS = ['🟦', '🔶', '⚡', '🏆', '🎮', '💎', '🔥', '⭐', '🌙', '🎯', '🚀', '🎲']

interface Card {
  id: number
  emoji: string
  flipped: boolean
  matched: boolean
}

function generateCards(pairs: number): Card[] {
  const pool = EMOJIS.slice(0, pairs)
  const doubled = [...pool, ...pool]
    .sort(() => Math.random() - 0.5)
    .map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }))
  return doubled
}

interface Props { onExit: () => void }

export default function MemoryGame({ onExit }: Props) {
  const { addXp, setHighScore } = useGameStore()
  const [round, setRound] = useState(1)
  const [cards, setCards] = useState<Card[]>([])
  const [flipped, setFlipped] = useState<number[]>([])
  const [score, setScore] = useState(0)
  const [started, setStarted] = useState(false)
  const [roundComplete, setRoundComplete] = useState(false)
  const [locked, setLocked] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30)
  const [gameOver, setGameOver] = useState(false)

  const startRound = useCallback((r: number) => {
    const pairs = Math.min(3 + r, 12)
    setCards(generateCards(pairs))
    setFlipped([])
    setRoundComplete(false)
    setTimeLeft(Math.max(10, 30 - r * 2))
  }, [])

  const startGame = useCallback(() => {
    setRound(1)
    setScore(0)
    setGameOver(false)
    setStarted(true)
    startRound(1)
  }, [startRound])

  useEffect(() => {
    if (!started || gameOver || roundComplete) return
    if (timeLeft <= 0) {
      setGameOver(true)
      addXp(Math.floor(score * 0.4))
      setHighScore('memory', score)
      return
    }
    const t = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(t)
  }, [started, gameOver, roundComplete, timeLeft, score, addXp, setHighScore])

  const handleFlip = (id: number) => {
    if (locked || gameOver) return
    const card = cards.find(c => c.id === id)
    if (!card || card.flipped || card.matched) return
    if (flipped.length >= 2) return

    const newFlipped = [...flipped, id]
    setCards(cs => cs.map(c => c.id === id ? { ...c, flipped: true } : c))
    setFlipped(newFlipped)

    if (newFlipped.length === 2) {
      setLocked(true)
      const [a, b] = newFlipped.map(fid => cards.find(c => c.id === fid)!)
      if (a.emoji === b.emoji) {
        const newCards = cards.map(c =>
          newFlipped.includes(c.id) ? { ...c, matched: true, flipped: true } : c
        )
        setCards(newCards)
        setScore(s => s + 20)
        setFlipped([])
        setLocked(false)
        if (newCards.every(c => c.matched)) {
          setRoundComplete(true)
          setScore(s => {
            const newS = s + 20
            setTimeout(() => {
              const nextRound = round + 1
              setRound(nextRound)
              startRound(nextRound)
            }, 1000)
            return newS
          })
        }
      } else {
        setTimeout(() => {
          setCards(cs => cs.map(c => newFlipped.includes(c.id) ? { ...c, flipped: false } : c))
          setFlipped([])
          setLocked(false)
        }, 800)
      }
    }
  }

  const cols = Math.ceil(Math.sqrt(cards.length * 2))

  return (
    <div className="flex flex-col h-full bg-[#080808]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <button onClick={onExit} className="text-[#555]"><ArrowLeft size={20} /></button>
        <h2 className="font-black text-white tracking-widest text-sm">MEMORY RUSH</h2>
        <div className="text-right">
          <p className="text-[10px] text-[#555]">SCORE</p>
          <p className="font-black text-[#FFC107]">{score}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-[11px] text-[#555]">ROUND <span className="text-white font-bold">{round}</span></span>
        <span className={`font-black text-lg ${timeLeft <= 5 ? 'text-red-400' : 'text-[#FFC107]'}`}>{timeLeft}s</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-2 relative">
        {started && !gameOver && (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, width: '100%', maxWidth: 360 }}
          >
            {cards.map(card => (
              <motion.div
                key={card.id}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleFlip(card.id)}
                className="aspect-square flex items-center justify-center rounded-xl cursor-pointer"
                style={{
                  background: card.flipped || card.matched ? '#1a1a1a' : '#111',
                  border: `1px solid ${card.matched ? '#FFC10740' : '#222'}`,
                  fontSize: 'clamp(16px, 5vw, 28px)',
                }}
                animate={{ rotateY: card.flipped || card.matched ? 0 : 0 }}
              >
                {(card.flipped || card.matched) ? card.emoji : '?'}
              </motion.div>
            ))}
          </div>
        )}

        {!started && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <p className="text-4xl">🧠</p>
            <h3 className="text-xl font-black text-white">MEMORY RUSH</h3>
            <p className="text-[12px] text-[#555]">Match pairs before time runs out</p>
            <button onClick={startGame} className="px-8 py-3 bg-[#FFC107] text-[#080808] font-black rounded-xl">
              START GAME
            </button>
          </motion.div>
        )}

        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/90"
          >
            <p className="text-3xl mb-2">🧠</p>
            <h3 className="text-xl font-black text-white mb-1">TIME UP!</h3>
            <p className="text-[#FFC107] font-black text-2xl mb-1">{score}</p>
            <p className="text-[12px] text-[#888] mb-6">Round {round} · +{Math.floor(score * 0.4)} XP</p>
            <div className="flex gap-3">
              <button onClick={startGame} className="px-6 py-3 bg-[#FFC107] text-[#080808] font-black rounded-xl">
                PLAY AGAIN
              </button>
              <button onClick={onExit} className="px-6 py-3 bg-[#222] text-white font-black rounded-xl">
                EXIT
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
