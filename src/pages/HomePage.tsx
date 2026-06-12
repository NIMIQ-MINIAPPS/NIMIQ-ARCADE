import { motion } from 'framer-motion'
import { useGameStore } from '../store/useGameStore'
import { formatAddress, formatNim } from '../lib/nimiq'
import { xpToNim } from '../lib/xp'
import XpBar from '../components/ui/XpBar'
import { Zap, Flame, Gift, ChevronRight } from 'lucide-react'

const GAMES_META = [
  { id: 'nimtris', name: 'Nimtris', icon: '🟦', color: '#4FC3F7' },
  { id: 'hexfall', name: 'Hex Fall', icon: '🔶', color: '#FFB74D' },
  { id: 'runner', name: 'Hex Runner', icon: '🏃', color: '#81C784' },
]

export default function HomePage() {
  const { user, nimBalance, nimiqAddress, setActiveTab, highScores } = useGameStore()
  if (!user) return null

  const convertibleNim = xpToNim(user.xp)

  return (
    <div className="flex flex-col gap-4 p-4 pb-2">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between pt-2"
      >
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-white glow-text">
            NIM<span className="text-[#FFC107]">-ARCADE</span>
          </h1>
          <p className="text-[11px] text-[#555] tracking-widest uppercase">Web3 Arcade Platform</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#FFC107]/10 border border-[#FFC107]/30 flex items-center justify-center text-xl">
          {user.avatar}
        </div>
      </motion.div>

      {/* Wallet Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="arcade-card rounded-2xl p-4 glow-yellow-sm"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-1">Nimiq Wallet</p>
            <p className="text-[12px] text-[#888] font-mono">
              {nimiqAddress ? formatAddress(nimiqAddress) : 'NQ07 0000…0000'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-1">Balance</p>
            <p className="text-xl font-black text-[#FFC107]">{nimBalance.toFixed(3)}</p>
            <p className="text-[10px] text-[#888]">NIM</p>
          </div>
        </div>
        <div className="h-px bg-[#222] mb-3" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#555] uppercase tracking-widest">Convertible</p>
            <p className="text-sm font-bold text-[#FFC107]">{user.xp.toLocaleString()} XP → {formatNim(convertibleNim)}</p>
          </div>
          <button className="text-xs font-bold text-[#080808] bg-[#FFC107] px-3 py-1.5 rounded-lg">
            CONVERT
          </button>
        </div>
      </motion.div>

      {/* XP / Level */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="arcade-card rounded-2xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-[#FFC107]" />
          <span className="text-[10px] uppercase tracking-widest text-[#666]">Experience</span>
        </div>
        <XpBar xp={user.xp} />
        <div className="flex gap-3 mt-3">
          <div className="flex-1 bg-[#111] rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-white">{user.gamesPlayed}</p>
            <p className="text-[10px] text-[#555]">PLAYED</p>
          </div>
          <div className="flex-1 bg-[#111] rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-[#4CAF50]">{user.wins}</p>
            <p className="text-[10px] text-[#555]">WINS</p>
          </div>
          <div className="flex-1 bg-[#111] rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-[#FFC107]">{user.xp.toLocaleString()}</p>
            <p className="text-[10px] text-[#555]">XP</p>
          </div>
        </div>
      </motion.div>

      {/* Daily Reward */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="arcade-card rounded-2xl p-4 border border-[#FFC107]/30"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-[#FFC107]" />
            <div>
              <p className="text-sm font-bold text-white">Daily Reward</p>
              <p className="text-[11px] text-[#555]">Play to earn bonus XP</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('games')}
            className="flex items-center gap-1 text-xs font-bold text-[#FFC107]"
          >
            PLAY <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>

      {/* Quick Play */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Flame size={14} className="text-[#FFC107]" />
          <span className="text-[11px] uppercase tracking-widest text-[#666]">Quick Play</span>
        </div>
        <div className="flex gap-3">
          {GAMES_META.map((game) => (
            <button
              key={game.id}
              onClick={() => setActiveTab('games')}
              className="flex-1 arcade-card rounded-xl p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform"
            >
              <span className="text-2xl">{game.icon}</span>
              <span className="text-[10px] font-bold text-[#888]">{game.name}</span>
              <span className="text-[10px] text-[#555]">
                {(highScores[game.id] ?? 0).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
