import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Clock, Users, Coins } from 'lucide-react'
import type { Tournament } from '../types'
import NimBadge from '../components/ui/NimBadge'

const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: 't1', name: 'NIMTRIS CUP', game: 'Nimtris',
    entryFee: 0.01, maxPlayers: 32, currentPlayers: 24,
    rewardPool: 0.32, startTime: new Date(Date.now()+3600000).toISOString(),
    status: 'upcoming', type: 'daily',
  },
  {
    id: 't2', name: 'HEX MASTERS', game: 'Hex Fall',
    entryFee: 0.05, maxPlayers: 16, currentPlayers: 16,
    rewardPool: 0.8, startTime: new Date(Date.now()-1800000).toISOString(),
    status: 'active', type: 'weekly',
  },
  {
    id: 't3', name: 'SPEED DEMONS', game: 'Quick Tap',
    entryFee: 0.02, maxPlayers: 64, currentPlayers: 41,
    rewardPool: 1.28, startTime: new Date(Date.now()+86400000).toISOString(),
    status: 'upcoming', type: 'monthly',
  },
]

const TYPE_COL: Record<string,string>  = { daily:'var(--blue)', weekly:'var(--purple)', monthly:'var(--gold)' }
const STAT_COL: Record<string,string>  = { upcoming:'var(--gold)', active:'var(--green)', ended:'var(--cream-muted)' }

function timeLeft(iso: string) {
  const d = new Date(iso).getTime() - Date.now()
  if (d <= 0) return 'LIVE'
  const h = Math.floor(d/3600000), m = Math.floor((d%3600000)/60000)
  return `${h}h ${m}m`
}

export default function TournamentsPage() {
  const [filter, setFilter] = useState<'all'|'upcoming'|'active'>('all')
  const filtered = MOCK_TOURNAMENTS.filter(t => filter==='all' || t.status===filter)

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-2">
      <div className="flex items-center gap-2">
        <Trophy size={16} style={{ color: 'var(--gold)' }} />
        <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--cream)' }}>TOURNAMENTS</h2>
      </div>

      {/* filter */}
      <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--surface)' }}>
        {(['all','upcoming','active'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
            style={filter===f ? { background:'var(--gold)', color:'var(--bg)' } : { color:'var(--cream-muted)' }}>
            {f}
          </button>
        ))}
      </div>

      {/* prize distribution */}
      <div className="rounded-xl px-4 py-3 flex gap-4 text-center"
        style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
        {[['70%','1st','#C9A227'],['20%','2nd','var(--cream-dim)'],['10%','3rd','#8A6840']].map(([pct,place,col])=>(
          <div key={place} className="flex-1">
            <p className="font-black text-lg leading-none" style={{ color: col }}>{pct}</p>
            <p className="text-[10px] mt-0.5 tracking-widest" style={{ color:'var(--cream-muted)' }}>{place}</p>
          </div>
        ))}
      </div>

      {/* list */}
      <div className="space-y-3">
        {filtered.map((t, i) => (
          <motion.div key={t.id}
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            transition={{ delay: i*0.07 }}
            className="rounded-2xl p-4"
            style={{ background:'var(--surface)', border:'1px solid var(--border-2)' }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                    style={{ color: TYPE_COL[t.type], background: TYPE_COL[t.type]+'20' }}>
                    {t.type.toUpperCase()}
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                    style={{ color: STAT_COL[t.status], background: STAT_COL[t.status]+'20' }}>
                    {t.status.toUpperCase()}
                  </span>
                </div>
                <h3 className="font-black tracking-wider" style={{ color:'var(--cream)' }}>{t.name}</h3>
                <p className="text-[11px]" style={{ color:'var(--cream-muted)' }}>{t.game}</p>
              </div>
              <NimBadge amount={t.rewardPool} size="sm" />
            </div>

            <div className="flex gap-3 mb-3">
              <span className="flex items-center gap-1 text-[11px]" style={{ color:'var(--cream-muted)' }}>
                <Users size={10}/> {t.currentPlayers}/{t.maxPlayers}
              </span>
              <span className="flex items-center gap-1 text-[11px]" style={{ color:'var(--cream-muted)' }}>
                <Coins size={10}/> {t.entryFee} NIM
              </span>
              <span className="flex items-center gap-1 text-[11px]" style={{ color:'var(--gold)' }}>
                <Clock size={10}/> {timeLeft(t.startTime)}
              </span>
            </div>

            <div className="h-1 rounded-full overflow-hidden mb-3" style={{ background:'var(--cream-faint)' }}>
              <div className="h-full rounded-full" style={{
                width: `${(t.currentPlayers/t.maxPlayers)*100}%`,
                background: 'var(--gold)',
              }} />
            </div>

            <button
              disabled={t.status==='ended'}
              className="w-full py-2.5 font-black rounded-xl text-sm disabled:opacity-30"
              style={{ background:'var(--gold)', color:'var(--bg)' }}>
              {t.status==='active' ? 'JOIN NOW' : t.status==='upcoming' ? `REGISTER · ${t.entryFee} NIM` : 'ENDED'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
