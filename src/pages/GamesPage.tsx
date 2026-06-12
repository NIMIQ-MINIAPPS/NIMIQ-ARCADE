import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/useGameStore'
import NimtrisGame from '../games/nimtris/NimtrisGame'
import HexfallGame from '../games/hexfall/HexfallGame'
import MemoryGame from '../games/memory/MemoryGame'
import QuickTapGame from '../games/quicktap/QuickTapGame'
import RunnerGame from '../games/runner/RunnerGame'
import type { GameMeta } from '../types'
import { Star } from 'lucide-react'

const GAMES: GameMeta[] = [
  {
    id: 'nimtris',
    name: 'Nimtris',
    description: 'Classic Tetris — clear lines, combo big',
    icon: '🟦',
    difficulty: 'Medium',
    color: '#4FC3F7',
    highScore: 0,
    xpMultiplier: 1.2,
  },
  {
    id: 'hexfall',
    name: 'Hex Fall',
    description: 'Block Blast — chain combos for max XP',
    icon: '🔶',
    difficulty: 'Easy',
    color: '#FFB74D',
    highScore: 0,
    xpMultiplier: 1.0,
  },
  {
    id: 'memory',
    name: 'Memory Rush',
    description: 'Peak Brain Training — match pairs fast',
    icon: '🧠',
    difficulty: 'Easy',
    color: '#CE93D8',
    highScore: 0,
    xpMultiplier: 0.8,
  },
  {
    id: 'quicktap',
    name: 'Quick Tap',
    description: 'Tap fast — test your reflexes',
    icon: '⚡',
    difficulty: 'Easy',
    color: '#FFF176',
    highScore: 0,
    xpMultiplier: 0.9,
  },
  {
    id: 'runner',
    name: 'Hex Runner',
    description: 'Endless runner — how far can you go?',
    icon: '🏃',
    difficulty: 'Hard',
    color: '#81C784',
    highScore: 0,
    xpMultiplier: 1.5,
  },
]

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: '#81C784',
  Medium: '#FFB74D',
  Hard: '#F44336',
}

export default function GamesPage() {
  const [activeGame, setActiveGame] = useState<string | null>(null)
  const { highScores } = useGameStore()

  const renderGame = () => {
    switch (activeGame) {
      case 'nimtris': return <NimtrisGame onExit={() => setActiveGame(null)} />
      case 'hexfall': return <HexfallGame onExit={() => setActiveGame(null)} />
      case 'memory': return <MemoryGame onExit={() => setActiveGame(null)} />
      case 'quicktap': return <QuickTapGame onExit={() => setActiveGame(null)} />
      case 'runner': return <RunnerGame onExit={() => setActiveGame(null)} />
      default: return null
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-2">
      <AnimatePresence>
        {activeGame && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-[#080808] z-40 max-w-[430px] left-1/2 -translate-x-1/2"
          >
            {renderGame()}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between pt-2">
        <h2 className="text-xl font-black tracking-tight text-white">
          GAMES <span className="text-[#FFC107]">ARCADE</span>
        </h2>
        <span className="text-[10px] text-[#555] uppercase tracking-widest">{GAMES.length} games</span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {GAMES.map((game, i) => {
          const hs = highScores[game.id] ?? 0
          return (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="arcade-card rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer"
              onClick={() => setActiveGame(game.id)}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: game.color + '20', border: `1px solid ${game.color}40` }}
              >
                {game.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-black text-white">{game.name}</p>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                    style={{ color: DIFFICULTY_COLOR[game.difficulty], background: DIFFICULTY_COLOR[game.difficulty] + '20' }}
                  >
                    {game.difficulty.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-[#555] truncate">{game.description}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1">
                    <Star size={10} className="text-[#FFC107]" />
                    <span className="text-[10px] text-[#888]">{hs.toLocaleString()}</span>
                  </div>
                  <span className="text-[10px] text-[#555]">×{game.xpMultiplier} XP</span>
                </div>
              </div>
              <button
                className="text-xs font-black text-[#080808] bg-[#FFC107] px-3 py-2 rounded-xl flex-shrink-0 glow-yellow-sm"
                onClick={(e) => { e.stopPropagation(); setActiveGame(game.id) }}
              >
                PLAY
              </button>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
