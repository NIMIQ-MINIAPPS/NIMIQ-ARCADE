import { motion } from 'framer-motion'
import { useGameStore } from '../store/useGameStore'
import { formatAddress } from '../lib/nimiq'
import { xpToNim, getXpProgress } from '../lib/xp'
import XpBar from '../components/ui/XpBar'
import NimBadge from '../components/ui/NimBadge'
import { NimLogo, DecorHex } from '../components/ui/Hex'
import { Trophy, Gamepad2, TrendingUp, Zap } from 'lucide-react'

const LB = [
  {rank:1,name:'CryptoAce',xp:48200,wins:234},
  {rank:2,name:'NimMaster', xp:41500,wins:189},
  {rank:3,name:'HexKing',   xp:38900,wins:176},
  {rank:4,name:'You',       xp:0,    wins:0,  isUser:true},
]
const ACH = [
  {id:'first_game',name:'First Game',  desc:'Play your first game',  unlocked:true },
  {id:'win_10',    name:'On Fire',     desc:'Win 10 matches',        unlocked:false},
  {id:'xp_1000',   name:'XP Grinder', desc:'Earn 1,000 XP',         unlocked:false},
  {id:'nim_earn',  name:'Earner',      desc:'Convert XP to NIM',     unlocked:false},
]
const MEDAL=['#C49210','var(--nim-mid)','#8A7040']

export default function ProfilePage() {
  const { user, nimiqAddress } = useGameStore()
  if (!user) return null
  const wr = user.gamesPlayed>0 ? Math.round((user.wins/user.gamesPlayed)*100) : 0
  const {level} = getXpProgress(user.xp)
  const lb = LB.map(e=>e.isUser ? {...e,xp:user.xp,wins:user.wins} : e)

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
        <div className="relative mt-3"><XpBar xp={user.xp} /></div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            {icon:<Gamepad2 size={13}/>,label:'Played',  value:user.gamesPlayed,          color:'var(--blue)'},
            {icon:<Trophy   size={13}/>,label:'Wins',    value:user.wins,                  color:'var(--green)'},
            {icon:<TrendingUp size={13}/>,label:'Win Rate',value:`${wr}%`,                color:'var(--gold-dark)'},
            {icon:<Zap      size={13}/>,label:'Total XP',value:user.xp.toLocaleString(), color:'var(--nim-dark)'},
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
        <div className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{background:'var(--gold-bg)',border:'1.5px solid var(--gold)'}}>
          <div>
            <p className="text-[10px] tracking-widest font-semibold mb-0.5" style={{color:'var(--nim-muted)'}}>CONVERTIBLE</p>
            <p className="font-bold" style={{color:'var(--nim-dark)'}}>{user.xp.toLocaleString()} XP</p>
          </div>
          <NimBadge amount={xpToNim(user.xp)}/>
        </div>

        {/* Achievements */}
        <div>
          <p className="text-[10px] tracking-widest font-bold mb-2" style={{color:'var(--nim-muted)'}}>ACHIEVEMENTS</p>
          <div className="grid grid-cols-2 gap-2">
            {ACH.map(a=>(
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
          <p className="text-[10px] tracking-widest font-bold mb-2" style={{color:'var(--nim-muted)'}}>LEADERBOARD</p>
          <div className="rounded-2xl overflow-hidden"
            style={{background:'var(--y4)',border:'1.5px solid var(--y2)'}}>
            {lb.map((e,i)=>(
              <div key={e.rank} className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderBottom:i<lb.length-1?'1px solid var(--y2)':'none',
                  background:e.isUser?'var(--gold-bg)':'transparent',
                }}>
                <span className="text-sm font-black w-5 text-center"
                  style={{color:i<3?MEDAL[i]:'var(--nim-muted)'}}>{e.rank}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{color:e.isUser?'var(--gold-dark)':'var(--nim-dark)'}}>
                    {e.isUser?user.displayName:e.name}
                    {e.isUser&&<span className="text-[10px] ml-1" style={{color:'var(--nim-muted)'}}>(you)</span>}
                  </p>
                  <p className="text-[10px]" style={{color:'var(--nim-muted)'}}>{e.wins} wins</p>
                </div>
                <span className="text-[11px] font-bold" style={{color:'var(--nim-mid)'}}>
                  {e.xp.toLocaleString()} XP
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
