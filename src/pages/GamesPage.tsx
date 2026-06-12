import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/useGameStore'
import { GAMES, CATEGORIES, DIFFICULTY_COLOR, type GameCategory } from '../lib/games'
import GameIllustration from '../components/games/GameIllustration'
import NimtrisGame from '../games/nimtris/NimtrisGame'
import HexfallGame from '../games/hexfall/HexfallGame'
import MemoryGame from '../games/memory/MemoryGame'
import QuickTapGame from '../games/quicktap/QuickTapGame'
import RunnerGame from '../games/runner/RunnerGame'
import { Lock, Star, Zap, ChevronRight } from 'lucide-react'

const CATEGORY_LABELS: Record<Exclude<GameCategory, 'all'>, string> = {
  brain:   'Brain Training',
  classic: 'Classic Arcade',
  action:  'Action',
  puzzle:  'Puzzle',
}

function GameCard({ game, onPlay }: { game: typeof GAMES[0]; onPlay: () => void }) {
  const { highScores } = useGameStore()
  const hs = highScores[game.id] ?? 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="card rounded-2xl overflow-hidden flex flex-col"
      style={{ border: game.available ? '1px solid var(--border-2)' : '1px solid var(--border)' }}
    >
      {/* illustration */}
      <div className="relative w-full" style={{ aspectRatio: '160/108' }}>
        <GameIllustration
          id={game.id}
          className="w-full h-full"
        />
        {!game.available && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1">
            <Lock size={16} style={{ color: 'var(--cream-muted)' }} />
            <span className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--cream-muted)' }}>
              COMING SOON
            </span>
          </div>
        )}
        {game.available && (
          <div
            className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
            style={{ background: 'rgba(12,10,6,.85)', color: DIFFICULTY_COLOR[game.difficulty], border: `1px solid ${DIFFICULTY_COLOR[game.difficulty]}40` }}
          >
            {game.difficulty.toUpperCase()}
          </div>
        )}
      </div>

      {/* info */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        <div className="flex items-start justify-between gap-1">
          <span className="font-black text-sm leading-tight" style={{ color: 'var(--cream)' }}>
            {game.name}
          </span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
            style={{ background: 'var(--cream-faint)', color: 'var(--cream-dim)' }}
          >
            {CATEGORY_LABELS[game.category]}
          </span>
        </div>

        <p className="text-[11px] leading-snug" style={{ color: 'var(--cream-muted)' }}>
          {game.description}
        </p>

        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-2">
            {hs > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--gold-dim)' }}>
                <Star size={9} />
                {hs.toLocaleString()}
              </span>
            )}
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--cream-muted)' }}>
              <Zap size={9} />
              ×{game.xpMultiplier}
            </span>
          </div>

          {game.available ? (
            <button
              onClick={onPlay}
              className="flex items-center gap-1 text-[11px] font-black px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--gold)', color: 'var(--bg)' }}
            >
              PLAY <ChevronRight size={12} />
            </button>
          ) : (
            <span className="text-[10px] font-bold" style={{ color: 'var(--cream-muted)' }}>
              SOON
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function GamesPage() {
  const [activeGame, setActiveGame] = useState<string | null>(null)
  const [category, setCategory] = useState<GameCategory>('all')

  const filtered = GAMES.filter(g => category === 'all' || g.category === category)
  const available = filtered.filter(g => g.available)
  const upcoming  = filtered.filter(g => !g.available)

  const renderGame = () => {
    switch (activeGame) {
      case 'nimtris':       return <NimtrisGame  onExit={() => setActiveGame(null)} />
      case 'hexfall':       return <HexfallGame  onExit={() => setActiveGame(null)} />
      case 'memory-matrix': return <MemoryGame   onExit={() => setActiveGame(null)} />
      case 'memory':        return <MemoryGame   onExit={() => setActiveGame(null)} />
      case 'quicktap':      return <QuickTapGame onExit={() => setActiveGame(null)} />
      case 'runner':        return <RunnerGame   onExit={() => setActiveGame(null)} />
      default: return null
    }
  }

  return (
    <div className="flex flex-col gap-0 pb-2">
      <AnimatePresence>
        {activeGame && (
          <motion.div
            key="game-overlay"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-40"
            style={{ maxWidth: 430, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg)' }}
          >
            {renderGame()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-end justify-between mb-1">
          <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--cream)' }}>
            ARCADE <span style={{ color: 'var(--gold)' }}>GAMES</span>
          </h2>
          <span className="text-[11px]" style={{ color: 'var(--cream-muted)' }}>
            {GAMES.length} games
          </span>
        </div>
        <p className="text-[12px]" style={{ color: 'var(--cream-muted)' }}>
          Brain training, classics and more
        </p>
      </div>

      {/* Category filter */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
              style={
                category === cat.id
                  ? { background: 'var(--gold)', color: 'var(--bg)' }
                  : { background: 'var(--surface-2)', color: 'var(--cream-muted)', border: '1px solid var(--border)' }
              }
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Available games */}
      {available.length > 0 && (
        <div className="px-4">
          <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: 'var(--cream-muted)' }}>
            PLAY NOW — {available.length} GAMES
          </p>
          <motion.div layout className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {available.map(game => (
                <GameCard key={game.id} game={game} onPlay={() => setActiveGame(game.id)} />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* Upcoming games */}
      {upcoming.length > 0 && (
        <div className="px-4 mt-6">
          <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: 'var(--cream-muted)' }}>
            COMING SOON — {upcoming.length} GAMES
          </p>
          <motion.div layout className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {upcoming.map(game => (
                <GameCard key={game.id} game={game} onPlay={() => {}} />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}
