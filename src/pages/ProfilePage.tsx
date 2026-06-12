import { motion } from 'framer-motion'
import { useGameStore } from '../store/useGameStore'
import { formatAddress } from '../lib/nimiq'
import { xpToNim, getXpProgress } from '../lib/xp'
import XpBar from '../components/ui/XpBar'
import NimBadge from '../components/ui/NimBadge'
import { NimLogo } from '../components/ui/Hex'
import { Trophy, Gamepad2, TrendingUp, Zap } from 'lucide-react'

const LEADERBOARD = [
  { rank:1, name:'CryptoAce', xp:48200, wins:234 },
  { rank:2, name:'NimMaster', xp:41500, wins:189 },
  { rank:3, name:'HexKing',   xp:38900, wins:176 },
  { rank:4, name:'You',       xp:0,     wins:0,   isUser:true },
]

const ACHIEVEMENTS = [
  { id:'first_game', name:'First Blood',  desc:'Play your first game',    unlocked:true  },
  { id:'win_10',     name:'On Fire',      desc:'Win 10 matches',          unlocked:false },
  { id:'xp_1000',    name:'XP Grinder',   desc:'Earn 1,000 XP',          unlocked:false },
  { id:'nim_earn',   name:'First Earner', desc:'Convert XP to NIM',       unlocked:false },
]

const MEDAL = ['#C9A227','var(--cream-dim)','#8A6840']

export default function ProfilePage() {
  const { user, nimiqAddress } = useGameStore()
  if (!user) return null

  const winRate = user.gamesPlayed > 0 ? Math.round((user.wins/user.gamesPlayed)*100) : 0
  const { level } = getXpProgress(user.xp)
  const lb = LEADERBOARD.map(e => e.isUser ? { ...e, xp:user.xp, wins:user.wins } : e)

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-2">

      {/* Profile card */}
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
        className="rounded-2xl p-4 flex items-center gap-4"
        style={{ background:'var(--surface)', border:'1px solid var(--border-2)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl"
          style={{ background:'var(--gold-deep)', border:'1px solid var(--gold)', color:'var(--gold-bright)' }}>
          {level}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-lg leading-tight" style={{ color:'var(--cream)' }}>
            {user.displayName}
          </p>
          <p className="text-[11px] font-mono mb-2" style={{ color:'var(--cream-muted)' }}>
            {nimiqAddress ? formatAddress(nimiqAddress) : 'Not connected'}
          </p>
          <XpBar xp={user.xp} compact />
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon:<Gamepad2 size={13}/>, label:'Games Played', value:user.gamesPlayed, color:'var(--blue)'   },
          { icon:<Trophy   size={13}/>, label:'Wins',         value:user.wins,        color:'var(--green)'  },
          { icon:<TrendingUp size={13}/>,label:'Win Rate',    value:`${winRate}%`,    color:'var(--gold)'   },
          { icon:<Zap      size={13}/>, label:'Total XP',     value:user.xp.toLocaleString(), color:'var(--gold-bright)' },
        ].map(s => (
          <motion.div key={s.label}
            initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="rounded-xl p-3"
            style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
            <div className="flex items-center gap-1 mb-1" style={{ color:s.color }}>
              {s.icon}
              <span className="text-[10px] uppercase tracking-wider" style={{ color:'var(--cream-muted)' }}>
                {s.label}
              </span>
            </div>
            <p className="text-xl font-black" style={{ color:s.color }}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* NIM convertible */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between"
        style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
        <div>
          <p className="text-[10px] tracking-widest mb-0.5" style={{ color:'var(--cream-muted)' }}>
            CONVERTIBLE XP
          </p>
          <p className="font-bold" style={{ color:'var(--cream)' }}>
            {user.xp.toLocaleString()} XP
          </p>
        </div>
        <NimBadge amount={xpToNim(user.xp)} />
      </div>

      {/* Achievements */}
      <div>
        <p className="text-[10px] tracking-widest font-bold mb-2" style={{ color:'var(--cream-muted)' }}>
          ACHIEVEMENTS
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map(a => (
            <div key={a.id}
              className="rounded-xl p-3 flex items-center gap-2.5"
              style={{
                background:'var(--surface)',
                border:`1px solid ${a.unlocked ? 'var(--border-2)' : 'var(--border)'}`,
                opacity: a.unlocked ? 1 : 0.4,
              }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background:a.unlocked?'var(--gold-deep)':'var(--surface-2)', border:`1px solid ${a.unlocked?'var(--gold)':'var(--border)'}` }}>
                <NimLogo size={16} />
              </div>
              <div>
                <p className="text-xs font-black leading-tight" style={{ color:'var(--cream)' }}>{a.name}</p>
                <p className="text-[10px]" style={{ color:'var(--cream-muted)' }}>{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <p className="text-[10px] tracking-widest font-bold mb-2" style={{ color:'var(--cream-muted)' }}>
          GLOBAL LEADERBOARD
        </p>
        <div className="rounded-2xl overflow-hidden"
          style={{ background:'var(--surface)', border:'1px solid var(--border-2)' }}>
          {lb.map((e, i) => (
            <div key={e.rank}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderBottom: i < lb.length-1 ? '1px solid var(--border)' : 'none',
                background: e.isUser ? 'rgba(212,168,67,.06)' : 'transparent',
              }}>
              <span className="text-sm font-black w-5 text-center"
                style={{ color: i < 3 ? MEDAL[i] : 'var(--cream-muted)' }}>
                {e.rank}
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: e.isUser?'var(--gold)':'var(--cream)' }}>
                  {e.isUser ? user.displayName : e.name}
                  {e.isUser && <span className="text-[10px] ml-1" style={{ color:'var(--cream-muted)' }}>(you)</span>}
                </p>
                <p className="text-[10px]" style={{ color:'var(--cream-muted)' }}>{e.wins} wins</p>
              </div>
              <span className="text-[11px] font-bold" style={{ color:'var(--cream-dim)' }}>
                {e.xp.toLocaleString()} XP
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
