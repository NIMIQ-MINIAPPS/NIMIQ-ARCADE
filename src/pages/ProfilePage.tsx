import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../store/useGameStore'
import { formatAddress } from '../lib/nimiq'
import { xpToNim, getXpProgress } from '../lib/xp'
import {
  backendAvailable, getCurrentPlayerId, fetchLeaderboard, fetchMyPayouts,
  requestXpConversion, type LeaderboardEntry, type PayoutRow,
} from '../lib/backend'
import XpBar from '../components/ui/XpBar'
import NimBadge from '../components/ui/NimBadge'
import { NimLogo, DecorHex } from '../components/ui/Hex'
import { Gamepad2, Layers, Zap, Loader2 } from 'lucide-react'

const MEDAL = ['#C49210', 'var(--nim-mid)', '#8A7040']

export default function ProfilePage() {
  const { user, nimiqAddress } = useGameStore()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const refresh = async () => {
    const [lb, po, id] = await Promise.all([fetchLeaderboard(50), fetchMyPayouts(), getCurrentPlayerId()])
    setLeaderboard(lb)
    setPayouts(po)
    setMyId(id)
    setLoaded(true)
  }

  useEffect(() => {
    if (!backendAvailable) { setLoaded(true); return }
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Payouts are processed by a backend cron (process-payouts), not
  // instantly — poll while anything is still in-flight so "pending" flips
  // to "sent" on screen without the player having to leave and come back.
  useEffect(() => {
    if (!backendAvailable) return
    const hasInFlight = payouts.some(p => p.status === 'pending' || p.status === 'processing')
    if (!hasInFlight) return
    const id = setInterval(refresh, 4000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payouts])

  if (!user) return null
  const totalXp = user.totalXp ?? user.xp
  const { level } = getXpProgress(totalXp)
  const gamesTried = Object.keys(useGameStore.getState().highScores).length

  const hasConverted = payouts.some(p => p.reason === 'xp_conversion')
  const achievements = [
    { id: 'first_game', name: 'First Game', desc: 'Play your first game', unlocked: user.gamesPlayed > 0 },
    { id: 'marathon', name: 'Marathon', desc: 'Play 25 games', unlocked: user.gamesPlayed >= 25 },
    { id: 'xp_1000', name: 'XP Grinder', desc: 'Earn 1,000 XP', unlocked: totalXp >= 1000 },
    { id: 'nim_earn', name: 'Earner', desc: 'Convert XP to NIM', unlocked: hasConverted },
  ]

  // Global leaderboard, with the local user's own row merged in by id (or appended if not synced yet).
  // Ranking always uses totalXp (lifetime) — converting XP to NIM never costs a player their rank.
  const lbRows = myId && leaderboard.some(e => e.id === myId)
    ? leaderboard.map(e => e.id === myId ? { ...e, displayName: user.displayName, avatar: user.avatar, totalXp, gamesPlayed: user.gamesPlayed } : e)
    : [...leaderboard, { id: myId ?? 'local', displayName: user.displayName, avatar: user.avatar, totalXp, level, gamesPlayed: user.gamesPlayed }]
  lbRows.sort((a, b) => b.totalXp - a.totalXp)

  const convertibleXp = Math.min(user.xp, 5000) // don't offer converting the whole balance in one tap — keep it sane for an MVP button
  const handleConvert = async () => {
    if (converting || convertibleXp <= 0 || !backendAvailable) return
    setConverting(true)
    const payout = await requestXpConversion(convertibleXp)
    if (payout) {
      useGameStore.setState(s => s.user ? { user: { ...s.user, xp: s.user.xp - convertibleXp } } : {})
      await refresh()
    }
    setConverting(false)
  }

  return (
    <div className="flex flex-col gap-0 pb-2">
      {/* Header */}
      <div className="relative overflow-hidden px-4 pt-5 pb-5 hex-pattern"
        style={{background:'linear-gradient(160deg,var(--y2) 0%,var(--y5) 70%)'}}>
        <DecorHex size={90} x={330} y={-20} opacity={0.13} stroke="var(--gold)" strokeWidth={1.3}/>
        <div className="relative flex items-center gap-3">
          <div className="hex-clip w-14 h-14 flex items-center justify-center font-black text-xl"
            style={{background:'var(--gold)',color:'var(--nim-dark)'}}>{level}</div>
          <div>
            <p className="font-black text-lg leading-tight" style={{color:'var(--nim-dark)'}}>{user.displayName}</p>
            <p className="text-[11px] font-mono" style={{color:'var(--nim-muted)'}}>
              {nimiqAddress ? formatAddress(nimiqAddress) : 'Not connected'}
            </p>
          </div>
        </div>
        <div className="relative mt-3"><XpBar xp={totalXp} /></div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            {icon:<Gamepad2 size={13}/>,label:'Played',  value:user.gamesPlayed,          color:'var(--blue)'},
            {icon:<Layers size={13}/>,label:'Games Tried',value:gamesTried,               color:'var(--green)'},
            {icon:<Zap      size={13}/>,label:'Total XP',value:totalXp.toLocaleString(), color:'var(--nim-dark)'},
          ].map(s=>(
            <motion.div key={s.label} initial={{opacity:0}} animate={{opacity:1}}
              className="rounded-xl p-3"
              style={{background:'var(--y4)',border:'1px solid var(--y2)'}}>
              <div className="flex items-center gap-1 mb-1" style={{color:s.color}}>
                {s.icon}
                <span className="text-[10px] uppercase tracking-wider" style={{color:'var(--nim-muted)'}}>{s.label}</span>
              </div>
              <p className="text-xl font-black" style={{color:s.color}}>{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* NIM convertible */}
        <button
          onClick={handleConvert}
          disabled={converting || convertibleXp <= 0 || !backendAvailable}
          className="w-full rounded-xl px-4 py-3 flex items-center justify-between disabled:opacity-60"
          style={{background:'var(--gold-bg)',border:'1.5px solid var(--gold)'}}
        >
          <div className="text-left">
            <p className="text-[10px] tracking-widest font-semibold mb-0.5" style={{color:'var(--nim-muted)'}}>
              {backendAvailable ? 'TAP TO CONVERT' : 'CONVERTIBLE (backend offline)'}
            </p>
            <p className="font-bold" style={{color:'var(--nim-dark)'}}>{convertibleXp.toLocaleString()} XP</p>
          </div>
          {converting ? <Loader2 size={18} className="animate-spin" style={{color:'var(--nim-dark)'}} /> : <NimBadge amount={xpToNim(convertibleXp)}/>}
        </button>

        {/* Pending / recent payouts */}
        {payouts.length > 0 && (
          <div className="rounded-xl p-3 space-y-1.5" style={{background:'var(--y4)',border:'1px solid var(--y2)'}}>
            <p className="text-[10px] tracking-widest font-bold mb-1" style={{color:'var(--nim-muted)'}}>PAYOUTS</p>
            {payouts.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between text-[11px]">
                <span style={{color:'var(--nim-mid)'}}>{p.reason.replace('_',' ')}</span>
                <span className="font-bold" style={{color:'var(--nim-dark)'}}>{p.amount_nim.toFixed(3)} NIM</span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: p.status === 'sent' ? 'var(--green-bg,rgba(39,174,96,.15))' : 'var(--y3)',
                    color: p.status === 'sent' ? 'var(--green)' : 'var(--nim-muted)',
                  }}
                >
                  {p.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Achievements */}
        <div>
          <p className="text-[10px] tracking-widest font-bold mb-2" style={{color:'var(--nim-muted)'}}>ACHIEVEMENTS</p>
          <div className="grid grid-cols-2 gap-2">
            {achievements.map(a=>(
              <div key={a.id} className="rounded-xl p-3 flex items-center gap-2.5"
                style={{
                  background:'var(--y4)', opacity:a.unlocked?1:.45,
                  border:`1px solid ${a.unlocked?'var(--y1)':'var(--y2)'}`,
                }}>
                <div className="hex-clip w-8 h-8 flex items-center justify-center shrink-0"
                  style={{background:a.unlocked?'var(--gold)':'var(--y2)'}}>
                  <NimLogo size={16}/>
                </div>
                <div>
                  <p className="text-xs font-black leading-tight" style={{color:'var(--nim-dark)'}}>{a.name}</p>
                  <p className="text-[10px]" style={{color:'var(--nim-muted)'}}>{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <p className="text-[10px] tracking-widest font-bold mb-2" style={{color:'var(--nim-muted)'}}>
            LEADERBOARD {!backendAvailable && '(offline)'}
          </p>
          <div className="rounded-2xl overflow-hidden"
            style={{background:'var(--y4)',border:'1.5px solid var(--y2)'}}>
            {!loaded ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={18} className="animate-spin" style={{color:'var(--nim-muted)'}} />
              </div>
            ) : lbRows.length === 0 ? (
              <p className="text-center text-xs py-6" style={{color:'var(--nim-muted)'}}>No scores yet — be the first!</p>
            ) : lbRows.map((e,i)=>{
              const isUser = e.id === myId || (!myId && e.id === 'local')
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom:i<lbRows.length-1?'1px solid var(--y2)':'none',
                    background:isUser?'var(--gold-bg)':'transparent',
                  }}>
                  <span className="text-sm font-black w-5 text-center"
                    style={{color:i<3?MEDAL[i]:'var(--nim-muted)'}}>{i+1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{color:isUser?'var(--gold-dark)':'var(--nim-dark)'}}>
                      {e.displayName}
                      {isUser&&<span className="text-[10px] ml-1" style={{color:'var(--nim-muted)'}}>(you)</span>}
                    </p>
                    <p className="text-[10px]" style={{color:'var(--nim-muted)'}}>Level {e.level} · {e.gamesPlayed} games</p>
                  </div>
                  <span className="text-[11px] font-bold" style={{color:'var(--nim-mid)'}}>
                    {e.totalXp.toLocaleString()} XP
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
