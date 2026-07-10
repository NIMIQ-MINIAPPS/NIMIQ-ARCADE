import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Clock, Users, Loader2, ArrowLeft } from 'lucide-react'
import { DecorHex } from '../components/ui/Hex'
import { useGameStore } from '../store/useGameStore'
import { GAMES } from '../lib/games'
import { getCurrentPlayerId } from '../lib/backend'
import {
  tournamentsAvailable, fetchTournaments, fetchMyEntry, enterTournament, fetchRanking,
  type TournamentRow, type TournamentEntryRow, type RankedEntry,
} from '../lib/tournaments'

const TYPE_COL: Record<string, string> = { daily: 'var(--blue)', weekly: 'var(--purple)', monthly: 'var(--gold-dark)' }
const STAT_COL: Record<string, string> = { upcoming: 'var(--gold-dark)', active: 'var(--green)', ended: 'var(--nim-muted)' }
const MEDAL = ['#C49210', 'var(--nim-mid)', '#8A7040']

function gameName(gameId: string) {
  return GAMES.find(g => g.id === gameId)?.name ?? gameId
}

function timeLeft(iso: string) {
  const d = new Date(iso).getTime() - Date.now()
  if (d <= 0) return 'ENDED'
  const days = Math.floor(d / 86400000)
  if (days > 0) return `${days}d ${Math.floor((d % 86400000) / 3600000)}h`
  return `${Math.floor(d / 3600000)}h ${Math.floor((d % 3600000) / 60000)}m`
}

// ── Detail view: entry status + live ranking for one tournament ────────────
function TournamentDetail({ t, myId, onBack }: { t: TournamentRow; myId: string; onBack: () => void }) {
  const [entry, setEntry] = useState<TournamentEntryRow | null>(null)
  const [ranking, setRanking] = useState<RankedEntry[]>([])
  const [entering, setEntering] = useState(false)
  const { setActiveTournament, setActiveTab } = useGameStore()

  const refresh = useCallback(async () => {
    const [e, r] = await Promise.all([fetchMyEntry(t.id, myId), fetchRanking(t.id)])
    setEntry(e)
    setRanking(r)
  }, [t.id, myId])

  useEffect(() => {
    refresh()
    const poll = setInterval(refresh, 4000)
    return () => clearInterval(poll)
  }, [refresh])

  const handleEnter = async () => {
    setEntering(true)
    const e = await enterTournament(t.id, myId)
    setEntering(false)
    if (e) setEntry(e)
  }

  const goPlay = () => {
    setActiveTournament({ tournamentId: t.id, gameId: t.game_id })
    setActiveTab('games')
  }

  const isEnded = t.status === 'ended' || new Date(t.ends_at).getTime() < Date.now()
  const myRank = ranking.findIndex(r => r.player_id === myId)

  return (
    <div className="px-4 pt-5 pb-2 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--nim-muted)' }}>
        <ArrowLeft size={14} /> BACK
      </button>

      <div className="rounded-2xl p-4" style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)' }}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
            style={{ color: TYPE_COL[t.type], background: TYPE_COL[t.type] + '18', border: `1px solid ${TYPE_COL[t.type]}40` }}>
            {t.type.toUpperCase()}
          </span>
        </div>
        <h3 className="font-black text-lg" style={{ color: 'var(--nim-dark)' }}>{t.name}</h3>
        <p className="text-[12px]" style={{ color: 'var(--nim-muted)' }}>{gameName(t.game_id)}</p>
        <div className="flex items-center gap-1 mt-2 text-[11px] font-bold" style={{ color: isEnded ? 'var(--nim-muted)' : 'var(--gold-dark)' }}>
          <Clock size={11} /> {isEnded ? 'ENDED' : timeLeft(t.ends_at)}
        </div>
      </div>

      {!entry ? (
        <button onClick={handleEnter} disabled={entering || isEnded}
          className="w-full py-3 font-black rounded-xl disabled:opacity-40" style={{ background: 'var(--nim-dark)', color: 'var(--gold)' }}>
          {entering ? <Loader2 size={16} className="animate-spin mx-auto" /> : isEnded ? 'ENDED' : `ENTER · ${t.entry_fee_nim} NIM`}
        </button>
      ) : (
        <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold)' }}>
          <div>
            <p className="text-[10px] tracking-widest font-semibold" style={{ color: 'var(--nim-muted)' }}>YOUR BEST</p>
            <p className="font-black" style={{ color: 'var(--nim-dark)' }}>{entry.best_score.toLocaleString()}</p>
          </div>
          {myRank >= 0 && <p className="text-sm font-black" style={{ color: 'var(--gold-dark)' }}>#{myRank + 1}</p>}
          {!isEnded && (
            <button onClick={goPlay} className="text-xs font-black px-4 py-2 rounded-lg" style={{ background: 'var(--gold)', color: 'var(--nim-dark)' }}>
              {entry.best_score > 0 ? 'TRY AGAIN' : 'GO PLAY'}
            </button>
          )}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)' }}>
        <p className="text-[10px] tracking-widest font-bold px-4 pt-3 pb-2" style={{ color: 'var(--nim-muted)' }}>RANKING</p>
        {ranking.length === 0 ? (
          <p className="text-center text-xs py-6" style={{ color: 'var(--nim-muted)' }}>No entries yet — be the first!</p>
        ) : ranking.map((r, i) => (
          <div key={r.player_id} className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderTop: '1px solid var(--y2)', background: r.player_id === myId ? 'var(--gold-bg)' : 'transparent' }}>
            <span className="text-sm font-black w-5 text-center" style={{ color: i < 3 ? MEDAL[i] : 'var(--nim-muted)' }}>{i + 1}</span>
            <span className="text-lg">{r.avatar}</span>
            <p className="flex-1 text-sm font-bold" style={{ color: 'var(--nim-dark)' }}>
              {r.displayName}{r.player_id === myId && <span className="text-[10px] ml-1" style={{ color: 'var(--nim-muted)' }}>(you)</span>}
            </p>
            <span className="text-[11px] font-bold" style={{ color: 'var(--nim-mid)' }}>{r.best_score.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TournamentsPage() {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'active'>('all')
  const [tournaments, setTournaments] = useState<TournamentRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<TournamentRow | null>(null)

  useEffect(() => {
    getCurrentPlayerId().then(setMyId)
    fetchTournaments().then(t => { setTournaments(t); setLoaded(true) })
  }, [])

  if (!tournamentsAvailable) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 px-6 text-center">
        <Trophy size={28} style={{ color: 'var(--nim-muted)' }} />
        <p className="font-bold" style={{ color: 'var(--nim-dark)' }}>Tournaments are offline</p>
        <p className="text-[12px]" style={{ color: 'var(--nim-muted)' }}>Backend isn't configured for this build.</p>
      </div>
    )
  }

  if (selected && myId) {
    return <TournamentDetail t={selected} myId={myId} onBack={() => setSelected(null)} />
  }

  const list = tournaments.filter(t => filter === 'all' || t.status === filter)

  return (
    <div className="flex flex-col gap-0 pb-2">
      <div className="relative overflow-hidden px-4 pt-5 pb-5 hex-pattern"
        style={{ background: 'linear-gradient(160deg,var(--y2) 0%,var(--y5) 70%)' }}>
        <DecorHex size={70} x={350} y={-15} opacity={0.15} stroke="var(--gold)" strokeWidth={1.2} />
        <div className="relative flex items-center gap-2">
          <Trophy size={16} style={{ color: 'var(--gold-dark)' }} />
          <h2 className="text-xl font-black" style={{ color: 'var(--nim-dark)' }}>TOURNAMENTS</h2>
        </div>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--nim-muted)' }}>Compete for the top of the ranking</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--y3)', border: '1px solid var(--y2)' }}>
          {(['all', 'upcoming', 'active'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
              style={filter === f ? { background: 'var(--nim-dark)', color: 'var(--gold)' } : { color: 'var(--nim-muted)' }}>
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-3 pb-2">
          <AnimatePresence>
            {!loaded ? (
              <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--nim-muted)' }} /></div>
            ) : list.length === 0 ? (
              <p className="text-center text-xs py-10" style={{ color: 'var(--nim-muted)' }}>No tournaments right now.</p>
            ) : list.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                onClick={() => setSelected(t)}
                className="rounded-2xl p-4 cursor-pointer"
                style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)', boxShadow: '0 2px 12px rgba(31,35,72,.06)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                        style={{ color: TYPE_COL[t.type], background: TYPE_COL[t.type] + '18', border: `1px solid ${TYPE_COL[t.type]}40` }}>
                        {t.type.toUpperCase()}
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                        style={{ color: STAT_COL[t.status], background: STAT_COL[t.status] + '18', border: `1px solid ${STAT_COL[t.status]}40` }}>
                        {t.status.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="font-black tracking-wider" style={{ color: 'var(--nim-dark)' }}>{t.name}</h3>
                    <p className="text-[11px]" style={{ color: 'var(--nim-muted)' }}>{gameName(t.game_id)}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  {[[<Users size={10} key="u" />, t.max_players ? `max ${t.max_players}` : 'open'], [<Clock size={10} key="c" />, timeLeft(t.ends_at)]].map(([icon, text], k) => (
                    <span key={k} className="flex items-center gap-1 text-[11px]" style={{ color: k === 1 ? 'var(--gold-dark)' : 'var(--nim-muted)' }}>
                      {icon}{text as string}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
