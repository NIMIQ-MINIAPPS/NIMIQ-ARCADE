import { motion } from 'framer-motion'
import { useGameStore } from '../store/useGameStore'
import { formatAddress } from '../lib/nimiq'
import { xpToNim, getXpProgress } from '../lib/xp'
import XpBar from '../components/ui/XpBar'
import NimBadge from '../components/ui/NimBadge'
import { Trophy, Gamepad2, TrendingUp, Zap } from 'lucide-react'

const LEADERBOARD = [
  { rank: 1, name: 'CryptoAce', xp: 48200, wins: 234 },
  { rank: 2, name: 'NimMaster', xp: 41500, wins: 189 },
  { rank: 3, name: 'HexKing', xp: 38900, wins: 176 },
  { rank: 4, name: 'You', xp: 0, wins: 0, isUser: true },
]

const ACHIEVEMENTS = [
  { id: 'first_game', name: 'First Blood', desc: 'Play your first game', icon: '🎮', unlocked: true },
  { id: 'win_10', name: 'On Fire', desc: 'Win 10 matches', icon: '🔥', unlocked: false },
  { id: 'xp_1000', name: 'XP Grinder', desc: 'Earn 1,000 XP', icon: '⚡', unlocked: false },
  { id: 'nim_earn', name: 'Earner', desc: 'Convert XP to NIM', icon: '⬡', unlocked: false },
]

export default function ProfilePage() {
  const { user, nimiqAddress } = useGameStore()
  if (!user) return null

  const winRate = user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0
  const { level } = getXpProgress(user.xp)

  const lb = LEADERBOARD.map(e => e.isUser ? { ...e, xp: user.xp, wins: user.wins } : e)

  return (
    <div className="flex flex-col gap-4 p-4 pb-2">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="arcade-card rounded-2xl p-4 flex items-center gap-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#FFC107]/10 border border-[#FFC107]/30 flex items-center justify-center text-3xl">
          {user.avatar}
        </div>
        <div className="flex-1">
          <p className="font-black text-white text-lg">{user.displayName}</p>
          <p className="text-[11px] text-[#555] font-mono">
            {nimiqAddress ? formatAddress(nimiqAddress) : 'Not connected'}
          </p>
          <div className="mt-2">
            <XpBar xp={user.xp} compact />
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-[#FFC107]">{level}</p>
          <p className="text-[10px] text-[#555]">LEVEL</p>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: <Gamepad2 size={14} />, label: 'Games Played', value: user.gamesPlayed, color: '#4FC3F7' },
          { icon: <Trophy size={14} />, label: 'Wins', value: user.wins, color: '#4CAF50' },
          { icon: <TrendingUp size={14} />, label: 'Win Rate', value: `${winRate}%`, color: '#FFB74D' },
          { icon: <Zap size={14} />, label: 'Total XP', value: user.xp.toLocaleString(), color: '#FFC107' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="arcade-card rounded-xl p-3"
          >
            <div className="flex items-center gap-1 mb-1" style={{ color: stat.color }}>
              {stat.icon}
              <span className="text-[10px] uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-xl font-black text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* NIM earned */}
      <div className="arcade-card rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-[#555] uppercase tracking-widest mb-1">Convertible XP</p>
          <p className="font-bold text-white">{user.xp.toLocaleString()} XP</p>
        </div>
        <div className="text-right">
          <NimBadge amount={xpToNim(user.xp)} />
        </div>
      </div>

      {/* Achievements */}
      <div>
        <p className="text-[11px] text-[#555] uppercase tracking-widest mb-2">Achievements</p>
        <div className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map((a) => (
            <div
              key={a.id}
              className={`arcade-card rounded-xl p-3 flex items-center gap-2 ${!a.unlocked ? 'opacity-40' : ''}`}
            >
              <span className="text-2xl">{a.icon}</span>
              <div>
                <p className="text-xs font-bold text-white">{a.name}</p>
                <p className="text-[10px] text-[#555]">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <p className="text-[11px] text-[#555] uppercase tracking-widest mb-2">Global Leaderboard</p>
        <div className="arcade-card rounded-2xl overflow-hidden">
          {lb.map((entry, i) => (
            <div
              key={entry.rank}
              className={`flex items-center gap-3 px-4 py-3 ${i < lb.length - 1 ? 'border-b border-[#1a1a1a]' : ''} ${entry.isUser ? 'bg-[#FFC107]/5' : ''}`}
            >
              <span className={`text-sm font-black w-6 text-center ${entry.rank === 1 ? 'text-[#FFD700]' : entry.rank === 2 ? 'text-[#C0C0C0]' : entry.rank === 3 ? 'text-[#CD7F32]' : 'text-[#555]'}`}>
                {entry.rank}
              </span>
              <div className="flex-1">
                <p className={`text-sm font-bold ${entry.isUser ? 'text-[#FFC107]' : 'text-white'}`}>
                  {entry.isUser ? user.displayName : entry.name}
                  {entry.isUser && <span className="text-[10px] ml-1 opacity-60">(you)</span>}
                </p>
                <p className="text-[10px] text-[#555]">{entry.wins} wins</p>
              </div>
              <span className="text-[11px] font-bold text-[#888]">{entry.xp.toLocaleString()} XP</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
