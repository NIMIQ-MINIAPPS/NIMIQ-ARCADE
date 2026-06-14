import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/useGameStore'
import { GAMES, CATEGORIES, DIFFICULTY_COLOR, type GameCategory } from '../lib/games'
import GameIllustration from '../components/games/GameIllustration'
import { DecorHex } from '../components/ui/Hex'
import NimtrisGame from '../games/nimtris/NimtrisGame'
import HexfallGame from '../games/hexfall/HexfallGame'
import MemoryGame from '../games/memory/MemoryGame'
import QuickTapGame from '../games/quicktap/QuickTapGame'
import RunnerGame from '../games/runner/RunnerGame'
import SnakeGame from '../games/snake/SnakeGame'
import TowerStackGame from '../games/tower/TowerStackGame'
import PongGame from '../games/pong/PongGame'
import MemoryMatrixGame from '../games/matrix/MemoryMatrixGame'
import NumberFlowGame from '../games/numberflow/NumberFlowGame'
import PatternSyncGame from '../games/patternsync/PatternSyncGame'
import BreakwallGame from '../games/breakwall/BreakwallGame'
import LowdownGame from '../games/lowdown/LowdownGame'
import WordFreshGame from '../games/wordfresh/WordFreshGame'
import LowPopGame from '../games/lowpop/LowPopGame'
import PerilousPathGame from '../games/perilous/PerilousPathGame'
import GalaxyDefenderGame from '../games/galaxy/GalaxyDefenderGame'
import MiniSudokuGame from '../games/sudoku/MiniSudokuGame'
import { Lock, Star, Zap, ChevronRight } from 'lucide-react'

const CAT_LABELS: Record<Exclude<GameCategory,'all'>, string> = {
  brain: 'Brain Training', classic: 'Classic Arcade', action: 'Action', puzzle: 'Puzzle',
}

function GameCard({ game, onPlay }: { game: typeof GAMES[0]; onPlay: () => void }) {
  const { highScores } = useGameStore()
  const hs = highScores[game.id] ?? 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--y4)',
        border: game.available ? '1.5px solid var(--y1)' : '1px solid var(--y2)',
        boxShadow: game.available ? '0 3px 16px rgba(31,35,72,.08)' : 'none',
      }}
    >
      {/* illustration — dark screen inside light card */}
      <div className="relative w-full" style={{ aspectRatio: '160/108' }}>
        <GameIllustration id={game.id} className="w-full h-full" />

        {!game.available && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1"
            style={{ background: 'rgba(245,245,240,.82)' }}>
            <div className="hex-clip w-8 h-8 flex items-center justify-center"
              style={{ background: 'var(--y2)' }}>
              <Lock size={14} style={{ color: 'var(--nim-muted)' }} />
            </div>
            <span className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--nim-muted)' }}>
              COMING SOON
            </span>
          </div>
        )}

        {game.available && (
          <div
            className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
            style={{
              background: 'rgba(253,253,231,.9)',
              color: DIFFICULTY_COLOR[game.difficulty],
              border: `1px solid ${DIFFICULTY_COLOR[game.difficulty]}50`,
            }}
          >
            {game.difficulty.toUpperCase()}
          </div>
        )}
      </div>

      {/* info */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        <div className="flex items-start justify-between gap-1">
          <span className="font-black text-sm leading-tight" style={{ color: 'var(--nim-dark)' }}>
            {game.name}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
            style={{ background: 'var(--y3)', color: 'var(--nim-muted)', border: '1px solid var(--y2)' }}>
            {CAT_LABELS[game.category]}
          </span>
        </div>

        <p className="text-[11px] leading-snug" style={{ color: 'var(--nim-mid)' }}>
          {game.description}
        </p>

        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-2">
            {hs > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--gold-dark)' }}>
                <Star size={9} fill="var(--gold)" stroke="none" />{hs.toLocaleString()}
              </span>
            )}
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--nim-muted)' }}>
              <Zap size={9} />×{game.xpMultiplier}
            </span>
          </div>

          {game.available ? (
            <button
              onClick={onPlay}
              className="flex items-center gap-1 text-[11px] font-black px-3 py-1.5 rounded-xl glow-gold-sm"
              style={{ background: 'var(--gold)', color: 'var(--nim-dark)' }}
            >
              PLAY <ChevronRight size={11} />
            </button>
          ) : (
            <span className="text-[10px] font-bold" style={{ color: 'var(--nim-light)' }}>SOON</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function GamesPage() {
  const [activeGame, setActiveGame] = useState<string | null>(null)
  const [category, setCategory] = useState<GameCategory>('all')

  const filtered  = GAMES.filter(g => category === 'all' || g.category === category)
  const available = filtered.filter(g => g.available)
  const upcoming  = filtered.filter(g => !g.available)

  const renderGame = () => {
    const exit = () => setActiveGame(null)
    switch (activeGame) {
      case 'nimtris':        return <NimtrisGame onExit={exit} />
      case 'hexfall':        return <HexfallGame onExit={exit} />
      case 'memory':         return <MemoryGame onExit={exit} />
      case 'quicktap':       return <QuickTapGame onExit={exit} />
      case 'runner':         return <RunnerGame onExit={exit} />
      case 'snake-path':     return <SnakeGame onExit={exit} />
      case 'tower-stack':    return <TowerStackGame onExit={exit} />
      case 'pong-duel':      return <PongGame onExit={exit} />
      case 'memory-matrix':  return <MemoryMatrixGame onExit={exit} />
      case 'number-flow':    return <NumberFlowGame onExit={exit} />
      case 'pattern-sync':   return <PatternSyncGame onExit={exit} />
      case 'breakwall':      return <BreakwallGame onExit={exit} />
      case 'lowdown':        return <LowdownGame onExit={exit} />
      case 'word-fresh':     return <WordFreshGame onExit={exit} />
      case 'low-pop':        return <LowPopGame onExit={exit} />
      case 'perilous-path':  return <PerilousPathGame onExit={exit} />
      case 'galaxy-defender': return <GalaxyDefenderGame onExit={exit} />
      case 'mini-sudoku':    return <MiniSudokuGame onExit={exit} />
      default: return null
    }
  }

  return (
    <div className="flex flex-col gap-0 pb-2">
      <AnimatePresence>
        {activeGame && (
          <motion.div
            key="game"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-x-0 top-0 z-50 mx-auto overflow-hidden"
            style={{ maxWidth: 430, background: '#0C0A06', height: '100dvh' }}
          >
            {renderGame()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with hex decoration */}
      <div
        className="relative overflow-hidden px-4 pt-5 pb-5 hex-pattern"
        style={{ background: 'linear-gradient(160deg,var(--y2) 0%,var(--y5) 70%)' }}
      >
        <DecorHex size={80}  x={340} y={-20} opacity={0.15} stroke="var(--gold)" strokeWidth={1.2} />
        <DecorHex size={40}  x={360} y={50}  opacity={0.20} fill="var(--gold-bg)" stroke="var(--gold)" strokeWidth={1} />
        <div className="relative flex items-end justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--nim-dark)' }}>
              ARCADE <span style={{ color: 'var(--gold-dark)' }}>GAMES</span>
            </h2>
            <p className="text-[12px]" style={{ color: 'var(--nim-muted)' }}>
              Brain training, classics &amp; more — {GAMES.length} games total
            </p>
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--y2)' }}>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
              style={
                category === cat.id
                  ? { background: 'var(--nim-dark)', color: 'var(--gold)', border: '1.5px solid var(--nim-dark)' }
                  : { background: 'var(--y4)', color: 'var(--nim-muted)', border: '1px solid var(--y2)' }
              }
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Available */}
      {available.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: 'var(--nim-muted)' }}>
            PLAY NOW — {available.length} GAMES
          </p>
          <motion.div layout className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {available.map(g => <GameCard key={g.id} game={g} onPlay={() => setActiveGame(g.id)} />)}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="px-4 pt-5">
          <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: 'var(--nim-muted)' }}>
            COMING SOON — {upcoming.length} GAMES
          </p>
          <motion.div layout className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {upcoming.map(g => <GameCard key={g.id} game={g} onPlay={() => {}} />)}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
      <div className="h-4" />
    </div>
  )
}
