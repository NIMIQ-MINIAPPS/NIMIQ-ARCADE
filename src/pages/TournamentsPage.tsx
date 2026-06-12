import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Clock, Users, Coins } from 'lucide-react'
import type { Tournament } from '../types'
import NimBadge from '../components/ui/NimBadge'
import { DecorHex } from '../components/ui/Hex'

const TOURNAMENTS: Tournament[] = [
  { id:'t1',name:'NIMTRIS CUP',  game:'Nimtris',  entryFee:0.01,maxPlayers:32,currentPlayers:24,rewardPool:0.32,
    startTime:new Date(Date.now()+3600000).toISOString(),status:'upcoming',type:'daily' },
  { id:'t2',name:'HEX MASTERS',  game:'Hex Fall', entryFee:0.05,maxPlayers:16,currentPlayers:16,rewardPool:0.8,
    startTime:new Date(Date.now()-1800000).toISOString(),status:'active',type:'weekly' },
  { id:'t3',name:'SPEED DEMONS', game:'Quick Tap',entryFee:0.02,maxPlayers:64,currentPlayers:41,rewardPool:1.28,
    startTime:new Date(Date.now()+86400000).toISOString(),status:'upcoming',type:'monthly' },
]

const TYPE_COL: Record<string,string> = { daily:'var(--blue)', weekly:'var(--purple)', monthly:'var(--gold-dark)' }
const STAT_COL: Record<string,string> = { upcoming:'var(--gold-dark)', active:'var(--green)', ended:'var(--nim-muted)' }

const tl = (iso:string) => {
  const d = new Date(iso).getTime()-Date.now()
  if (d<=0) return 'LIVE'
  return `${Math.floor(d/3600000)}h ${Math.floor((d%3600000)/60000)}m`
}

export default function TournamentsPage() {
  const [filter,setFilter]=useState<'all'|'upcoming'|'active'>('all')
  const list = TOURNAMENTS.filter(t=>filter==='all'||t.status===filter)

  return (
    <div className="flex flex-col gap-0 pb-2">
      <div className="relative overflow-hidden px-4 pt-5 pb-5 hex-pattern"
        style={{ background:'linear-gradient(160deg,var(--y2) 0%,var(--y5) 70%)' }}>
        <DecorHex size={70} x={350} y={-15} opacity={0.15} stroke="var(--gold)" strokeWidth={1.2} />
        <div className="relative flex items-center gap-2">
          <Trophy size={16} style={{ color:'var(--gold-dark)' }} />
          <h2 className="text-xl font-black" style={{ color:'var(--nim-dark)' }}>TOURNAMENTS</h2>
        </div>
        <p className="text-[12px] mt-0.5" style={{ color:'var(--nim-muted)' }}>
          Compete for NIM prize pools
        </p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Filter */}
        <div className="flex rounded-xl p-1 gap-1" style={{ background:'var(--y3)', border:'1px solid var(--y2)' }}>
          {(['all','upcoming','active'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
              style={filter===f ? {background:'var(--nim-dark)',color:'var(--gold)'} : {color:'var(--nim-muted)'}}>
              {f}
            </button>
          ))}
        </div>

        {/* Prize split */}
        <div className="rounded-xl px-4 py-3 flex gap-4 text-center hex-pattern"
          style={{ background:'var(--y3)', border:'1px solid var(--y2)' }}>
          {[['70%','1st','#C49210'],['20%','2nd','var(--nim-mid)'],['10%','3rd','#8A7040']].map(([pct,place,col])=>(
            <div key={place} className="flex-1">
              <p className="font-black text-xl leading-none" style={{ color:col }}>{pct}</p>
              <p className="text-[10px] mt-0.5 tracking-widest" style={{ color:'var(--nim-muted)' }}>{place}</p>
            </div>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3 pb-2">
          {list.map((t,i)=>(
            <motion.div key={t.id}
              initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*.07}}
              className="rounded-2xl p-4"
              style={{background:'var(--y4)',border:'1.5px solid var(--y2)',boxShadow:'0 2px 12px rgba(31,35,72,.06)'}}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                      style={{color:TYPE_COL[t.type],background:TYPE_COL[t.type]+'18',border:`1px solid ${TYPE_COL[t.type]}40`}}>
                      {t.type.toUpperCase()}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                      style={{color:STAT_COL[t.status],background:STAT_COL[t.status]+'18',border:`1px solid ${STAT_COL[t.status]}40`}}>
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="font-black tracking-wider" style={{color:'var(--nim-dark)'}}>{t.name}</h3>
                  <p className="text-[11px]" style={{color:'var(--nim-muted)'}}>{t.game}</p>
                </div>
                <NimBadge amount={t.rewardPool} size="sm" />
              </div>

              <div className="flex gap-3 mb-3">
                {[
                  [<Users size={10}/>, `${t.currentPlayers}/${t.maxPlayers}`],
                  [<Coins size={10}/>, `${t.entryFee} NIM`],
                  [<Clock size={10}/>, tl(t.startTime)],
                ].map(([icon,text],k)=>(
                  <span key={k} className="flex items-center gap-1 text-[11px]"
                    style={{color:k===2?'var(--gold-dark)':'var(--nim-muted)'}}>
                    {icon}{text as string}
                  </span>
                ))}
              </div>

              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{background:'var(--y2)'}}>
                <div className="h-full rounded-full" style={{width:`${(t.currentPlayers/t.maxPlayers)*100}%`,background:'var(--gold)'}}/>
              </div>

              <button disabled={t.status==='ended'}
                className="w-full py-2.5 font-black rounded-xl text-sm disabled:opacity-30"
                style={{background:'var(--nim-dark)',color:'var(--gold)'}}>
                {t.status==='active' ? 'JOIN NOW' : t.status==='upcoming' ? `REGISTER · ${t.entryFee} NIM` : 'ENDED'}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
