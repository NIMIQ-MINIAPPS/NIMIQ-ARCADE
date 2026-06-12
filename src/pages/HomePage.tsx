import { motion } from 'framer-motion'
import { useGameStore } from '../store/useGameStore'
import { formatAddress, formatNim } from '../lib/nimiq'
import { xpToNim } from '../lib/xp'
import XpBar from '../components/ui/XpBar'
import { NimLogo, HexGrid } from '../components/ui/Hex'
import GameIllustration from '../components/games/GameIllustration'
import { GAMES } from '../lib/games'
import { ChevronRight, Zap, Gift } from 'lucide-react'

const FEATURED = ['nimtris', 'hexfall', 'runner', 'quicktap', 'memory']

export default function HomePage() {
  const { user, nimBalance, nimiqAddress, setActiveTab, highScores } = useGameStore()
  if (!user) return null

  const convertibleNim = xpToNim(user.xp)
  const featuredGames = FEATURED.map(id => GAMES.find(g => g.id === id)!).filter(Boolean)

  return (
    <div className="flex flex-col gap-5 pb-2">
      {/* Header */}
      <div className="relative overflow-hidden px-4 pt-5 pb-6"
        style={{ background: 'linear-gradient(180deg, var(--surface-2) 0%, var(--bg) 100%)' }}>
        <HexGrid opacity={0.06} />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <NimLogo size={22} />
              <h1 className="text-xl font-black tracking-tighter leading-none"
                style={{ color: 'var(--cream)' }}>
                NIM<span style={{ color: 'var(--gold)' }}>ARCADE</span>
              </h1>
            </div>
            <p className="text-[10px] tracking-widest font-medium"
              style={{ color: 'var(--cream-muted)' }}>
              WEB3 ARCADE PLATFORM
            </p>
          </div>
          {/* avatar hex */}
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm"
            style={{ background: 'var(--gold-deep)', border: '1px solid var(--gold)', color: 'var(--gold-bright)' }}>
            {user.level}
          </div>
        </div>
      </div>

      {/* Wallet + XP card */}
      <div className="px-4 -mt-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}
        >
          {/* balance row */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <p className="text-[10px] tracking-widest mb-0.5" style={{ color: 'var(--cream-muted)' }}>WALLET</p>
              <p className="text-[11px] font-mono" style={{ color: 'var(--cream-dim)' }}>
                {nimiqAddress ? formatAddress(nimiqAddress) : 'NQ07 0000…0000'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black leading-none" style={{ color: 'var(--gold-bright)' }}>
                {nimBalance.toFixed(3)}
              </p>
              <p className="text-[10px] tracking-widest" style={{ color: 'var(--gold-dim)' }}>NIM</p>
            </div>
          </div>

          {/* XP + convert */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap size={12} style={{ color: 'var(--gold)' }} />
                <span className="text-[10px] tracking-widest font-bold" style={{ color: 'var(--cream-muted)' }}>
                  EXPERIENCE
                </span>
              </div>
              <span className="text-[11px]" style={{ color: 'var(--cream-dim)' }}>
                {user.xp.toLocaleString()} XP
              </span>
            </div>
            <XpBar xp={user.xp} />
            <div className="flex items-center justify-between mt-3">
              <p className="text-[11px]" style={{ color: 'var(--cream-dim)' }}>
                {user.xp.toLocaleString()} XP
                <span style={{ color: 'var(--cream-muted)' }}> → </span>
                <span style={{ color: 'var(--gold)' }}>{formatNim(convertibleNim)}</span>
              </p>
              <button
                className="text-[11px] font-black px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--gold)', color: 'var(--bg)' }}
              >
                CONVERT
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Stats strip */}
      <div className="px-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'PLAYED',  value: user.gamesPlayed, color: 'var(--cream-dim)' },
            { label: 'WINS',    value: user.wins,        color: 'var(--green)' },
            { label: 'XP',      value: user.xp.toLocaleString(), color: 'var(--gold)' },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-3 py-2.5 text-center"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-lg font-black leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9px] mt-0.5 tracking-widest" style={{ color: 'var(--cream-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily reward */}
      <div className="px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{ background: 'var(--gold-deep)', border: '1px solid var(--gold)', boxShadow: '0 0 20px rgba(212,168,67,.15)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(212,168,67,.2)' }}>
              <Gift size={16} style={{ color: 'var(--gold-bright)' }} />
            </div>
            <div>
              <p className="text-sm font-black" style={{ color: 'var(--gold-pale)' }}>Daily Reward</p>
              <p className="text-[11px]" style={{ color: 'var(--gold-dim)' }}>Earn bonus XP every day</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('games')}
            className="flex items-center gap-0.5 text-xs font-black"
            style={{ color: 'var(--gold-bright)' }}
          >
            PLAY <ChevronRight size={13} />
          </button>
        </motion.div>
      </div>

      {/* Quick play */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold tracking-widest" style={{ color: 'var(--cream-muted)' }}>
            QUICK PLAY
          </p>
          <button
            onClick={() => setActiveTab('games')}
            className="text-[11px] flex items-center gap-0.5"
            style={{ color: 'var(--gold)' }}
          >
            See all <ChevronRight size={11} />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {featuredGames.map((game) => (
            <motion.button
              key={game.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab('games')}
              className="shrink-0 rounded-xl overflow-hidden flex flex-col"
              style={{
                width: 110,
                background: 'var(--surface)',
                border: '1px solid var(--border-2)',
              }}
            >
              <div style={{ width: 110, height: 74 }}>
                <GameIllustration id={game.id} className="w-full h-full" />
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[11px] font-black text-left truncate" style={{ color: 'var(--cream)' }}>
                  {game.name}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--cream-muted)' }}>
                  {(highScores[game.id] ?? 0).toLocaleString() || '–'}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
