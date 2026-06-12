import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Clock, Users, Coins } from 'lucide-react'
import type { Tournament } from '../types'
import NimBadge from '../components/ui/NimBadge'

const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: 't1',
    name: 'NIMTRIS CUP',
    game: 'Nimtris',
    entryFee: 0.01,
    maxPlayers: 32,
    currentPlayers: 24,
    rewardPool: 0.32,
    startTime: new Date(Date.now() + 3600000).toISOString(),
    status: 'upcoming',
    type: 'daily',
  },
  {
    id: 't2',
    name: 'HEX MASTERS',
    game: 'Hex Fall',
    entryFee: 0.05,
    maxPlayers: 16,
    currentPlayers: 16,
    rewardPool: 0.8,
    startTime: new Date(Date.now() - 1800000).toISOString(),
    status: 'active',
    type: 'weekly',
  },
  {
    id: 't3',
    name: 'SPEED DEMONS',
    game: 'Quick Tap',
    entryFee: 0.02,
    maxPlayers: 64,
    currentPlayers: 41,
    rewardPool: 1.28,
    startTime: new Date(Date.now() + 86400000).toISOString(),
    status: 'upcoming',
    type: 'monthly',
  },
]

const TYPE_COLOR: Record<string, string> = {
  daily: '#4FC3F7',
  weekly: '#CE93D8',
  monthly: '#FFB74D',
}

const STATUS_COLOR: Record<string, string> = {
  upcoming: '#FFC107',
  active: '#4CAF50',
  ended: '#555',
}

function formatTimeLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'LIVE'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h ${m}m`
}

export default function TournamentsPage() {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'active'>('all')

  const filtered = MOCK_TOURNAMENTS.filter(t =>
    filter === 'all' ? true : t.status === filter
  )

  return (
    <div className="flex flex-col gap-4 p-4 pb-2">
      <div className="flex items-center gap-2 pt-2">
        <Trophy size={18} className="text-[#FFC107]" />
        <h2 className="text-xl font-black tracking-tight text-white">TOURNAMENTS</h2>
      </div>

      {/* Filter */}
      <div className="flex bg-[#111] rounded-xl p-1 gap-1">
        {(['all', 'upcoming', 'active'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              filter === f ? 'bg-[#FFC107] text-[#080808]' : 'text-[#555]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Reward distribution info */}
      <div className="arcade-card rounded-xl p-3 flex gap-4 text-center">
        {[['70%', '1st', '#FFD700'], ['20%', '2nd', '#C0C0C0'], ['10%', '3rd', '#CD7F32']].map(([pct, place, color]) => (
          <div key={place} className="flex-1">
            <p className="font-black text-lg" style={{ color }}>{pct}</p>
            <p className="text-[10px] text-[#555]">{place} PLACE</p>
          </div>
        ))}
      </div>

      {/* Tournament list */}
      <div className="space-y-3">
        {filtered.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="arcade-card rounded-2xl p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase"
                    style={{ color: TYPE_COLOR[t.type], background: TYPE_COLOR[t.type] + '20' }}
                  >
                    {t.type}
                  </span>
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase"
                    style={{ color: STATUS_COLOR[t.status], background: STATUS_COLOR[t.status] + '20' }}
                  >
                    {t.status}
                  </span>
                </div>
                <h3 className="font-black text-white tracking-wider">{t.name}</h3>
                <p className="text-[11px] text-[#555]">{t.game}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#555]">Prize Pool</p>
                <NimBadge amount={t.rewardPool} size="sm" />
              </div>
            </div>

            <div className="flex gap-3 mb-3">
              <span className="flex items-center gap-1 text-[11px] text-[#666]">
                <Users size={10} /> {t.currentPlayers}/{t.maxPlayers}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-[#666]">
                <Coins size={10} /> {t.entryFee} NIM entry
              </span>
              <span className="flex items-center gap-1 text-[11px] text-[#FFC107]">
                <Clock size={10} /> {formatTimeLeft(t.startTime)}
              </span>
            </div>

            {/* Player bar */}
            <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-[#FFC107] rounded-full"
                style={{ width: `${(t.currentPlayers / t.maxPlayers) * 100}%` }}
              />
            </div>

            <button
              disabled={t.status === 'ended'}
              className="w-full py-2.5 bg-[#FFC107] text-[#080808] font-black rounded-xl text-sm disabled:opacity-30"
            >
              {t.status === 'active' ? 'JOIN NOW' : t.status === 'upcoming' ? `REGISTER · ${t.entryFee} NIM` : 'ENDED'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
