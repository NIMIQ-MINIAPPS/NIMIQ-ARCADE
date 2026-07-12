import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../store/useGameStore'
import { formatAddress } from '../lib/nimiq'
import { xpToNim, getXpProgress } from '../lib/xp'
import { GAMES } from '../lib/games'
import {
  backendAvailable, getCurrentPlayerId, fetchLeaderboard, fetchMyPayouts,
  requestXpConversion, type LeaderboardEntry, type PayoutRow,
} from '../lib/backend'
import XpBar from '../components/ui/XpBar'
import NimBadge from '../components/ui/NimBadge'
import { DecorHex } from '../components/ui/Hex'
import {
  Gamepad2, Layers, Zap, Loader2, Trophy, Flame, Compass, Star, Wallet,
  Crown, Shield, Gem, Sparkles, Rocket, Infinity as InfinityIcon, Puzzle, Lock,
  Sunrise, Target, Heart, Timer, Coins, Brain, Eye, TrendingUp, Award,
  Medal, Swords, PartyPopper, Ghost, ShieldCheck, BadgeCheck, ChevronDown,
} from 'lucide-react'

const MEDAL = ['#C49210', 'var(--nim-mid)', '#8A7040']

type Tier = 'bronze' | 'silver' | 'gold' | 'legendary'

// Each tier gets its own gradient, border, glow and badge shape so the
// achievement grid reads as a real progression ladder at a glance, not a
// uniform checklist — bronze is flat and circular, legendary gets a
// multi-hue gradient, glow, and the hex badge shape reserved for the rarest
// tiers.
const TIER_STYLE: Record<Tier, { bg: string; border: string; iconColor: string; glow: string; shape: 'circle' | 'square' | 'hex'; label: string }> = {
  bronze:    { bg: 'linear-gradient(135deg,#CD7F32,#8B5A2B)',            border: '#B87333', iconColor: '#FFF3E6', glow: 'transparent',            shape: 'circle', label: 'BRONZE' },
  silver:    { bg: 'linear-gradient(135deg,#DCE1E8,#98A2B3)',            border: '#98A2B3', iconColor: '#1F2348', glow: 'transparent',            shape: 'square', label: 'SILVER' },
  gold:      { bg: 'linear-gradient(135deg,#F7DC6F,#C49210)',            border: '#E9B213', iconColor: '#1F2348', glow: 'rgba(233,178,19,.5)',    shape: 'hex',    label: 'GOLD' },
  legendary: { bg: 'linear-gradient(135deg,#A855F7,#6366F1 55%,#00E5FF)', border: '#A855F7', iconColor: '#FFFFFF', glow: 'rgba(168,85,247,.55)',   shape: 'hex',    label: 'LEGENDARY' },
}

export default function ProfilePage() {
  const { user, nimiqAddress } = useGameStore()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [achievementsShown, setAchievementsShown] = useState(4)

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
  const playedIds = Object.keys(useGameStore.getState().highScores)
  const gamesTried = playedIds.length
  const categoriesPlayed = new Set(playedIds.map(id => GAMES.find(g => g.id === id)?.category).filter(Boolean)).size

  const conversions = payouts.filter(p => p.reason === 'xp_conversion').length
  const nimEarned = payouts.filter(p => p.status === 'sent').reduce((sum, p) => sum + p.amount_nim, 0)

  const wonPrize = payouts.some(p => p.reason !== 'xp_conversion')
  const achievements: { id: string; name: string; desc: string; unlocked: boolean; tier: Tier; icon: React.ReactNode }[] = [
    // ── Bronze — first taps ──────────────────────────────────────────────
    { id: 'first_game',   name: 'First Steps',    desc: 'Play your first game',              unlocked: user.gamesPlayed > 0,    tier: 'bronze', icon: <Gamepad2 size={15}/> },
    { id: 'first_convert',name: 'Cash In',         desc: 'Convert XP to NIM',                  unlocked: conversions >= 1,        tier: 'bronze', icon: <Wallet size={15}/> },
    { id: 'explorer',     name: 'Explorer',        desc: 'Try 3 different games',              unlocked: gamesTried >= 3,         tier: 'bronze', icon: <Compass size={15}/> },
    { id: 'warm_up',      name: 'Warming Up',      desc: 'Play 5 games',                       unlocked: user.gamesPlayed >= 5,   tier: 'bronze', icon: <Sunrise size={15}/> },
    { id: 'first_100xp',  name: 'Getting Started', desc: 'Earn 100 lifetime XP',               unlocked: totalXp >= 100,          tier: 'bronze', icon: <Target size={15}/> },
    { id: 'dedicated',    name: 'Dedicated',       desc: 'Play 10 games',                      unlocked: user.gamesPlayed >= 10,  tier: 'bronze', icon: <Heart size={15}/> },
    { id: 'quick_learner',name: 'Quick Learner',   desc: 'Reach level 3',                      unlocked: level >= 3,              tier: 'bronze', icon: <Timer size={15}/> },
    { id: 'small_change', name: 'Small Change',    desc: 'Earn any NIM from payouts',          unlocked: nimEarned > 0,           tier: 'bronze', icon: <Coins size={15}/> },
    // ── Silver — building a habit ────────────────────────────────────────
    { id: 'marathon',     name: 'Marathon',        desc: 'Play 25 games',                      unlocked: user.gamesPlayed >= 25,  tier: 'silver', icon: <Flame size={15}/> },
    { id: 'xp_10k',       name: 'XP Hoarder',      desc: 'Earn 10,000 lifetime XP',            unlocked: totalXp >= 10000,        tier: 'silver', icon: <Zap size={15}/> },
    { id: 'variety',      name: 'Jack of All Trades', desc: 'Try a game from all 4 categories', unlocked: categoriesPlayed >= 4,   tier: 'silver', icon: <Layers size={15}/> },
    { id: 'level_10',     name: 'Rising Star',     desc: 'Reach level 10',                     unlocked: level >= 10,             tier: 'silver', icon: <Star size={15}/> },
    { id: 'brainiac',     name: 'Brainiac',        desc: 'Try 8 different games',              unlocked: gamesTried >= 8,         tier: 'silver', icon: <Brain size={15}/> },
    { id: 'sharp_eye',    name: 'Sharp Eye',       desc: 'Play 50 games',                      unlocked: user.gamesPlayed >= 50,  tier: 'silver', icon: <Eye size={15}/> },
    { id: 'saver',        name: 'Saver',           desc: 'Convert XP to NIM 3 times',          unlocked: conversions >= 3,        tier: 'silver', icon: <TrendingUp size={15}/> },
    { id: 'level_15',     name: 'Halfway There',   desc: 'Reach level 15',                     unlocked: level >= 15,             tier: 'silver', icon: <Award size={15}/> },
    // ── Gold — real dedication ────────────────────────────────────────────
    { id: 'veteran',      name: 'Arcade Veteran',  desc: 'Play 100 games',                     unlocked: user.gamesPlayed >= 100, tier: 'gold',   icon: <Trophy size={15}/> },
    { id: 'xp_100k',      name: 'XP Titan',        desc: 'Earn 100,000 lifetime XP',           unlocked: totalXp >= 100000,       tier: 'gold',   icon: <Crown size={15}/> },
    { id: 'completionist',name: 'Completionist',   desc: 'Try 15 different games',             unlocked: gamesTried >= 15,        tier: 'gold',   icon: <Puzzle size={15}/> },
    { id: 'level_25',     name: 'Elite',           desc: 'Reach level 25',                     unlocked: level >= 25,             tier: 'gold',   icon: <Shield size={15}/> },
    { id: 'whale',        name: 'Whale',           desc: 'Earn 1+ NIM from payouts',           unlocked: nimEarned >= 1,          tier: 'gold',   icon: <Gem size={15}/> },
    { id: 'champion',     name: 'Champion',        desc: 'Win a prize from a room or tournament', unlocked: wonPrize,             tier: 'gold',   icon: <Medal size={15}/> },
    { id: 'unstoppable',  name: 'Unstoppable',     desc: 'Play 250 games',                     unlocked: user.gamesPlayed >= 250, tier: 'gold',   icon: <Swords size={15}/> },
    // ── Legendary — the ceiling ────────────────────────────────────────────
    { id: 'legend',       name: 'Living Legend',   desc: 'Play 500 games',                     unlocked: user.gamesPlayed >= 500, tier: 'legendary', icon: <Sparkles size={15}/> },
    { id: 'xp_1m',        name: 'XP Ascendant',    desc: 'Earn 1,000,000 lifetime XP',         unlocked: totalXp >= 1000000,      tier: 'legendary', icon: <Rocket size={15}/> },
    { id: 'max_level',    name: 'Max Level',       desc: 'Reach level 35',                     unlocked: level >= 35,             tier: 'legendary', icon: <InfinityIcon size={15}/> },
    { id: 'big_whale',    name: 'Mega Whale',      desc: 'Earn 5+ NIM from payouts',           unlocked: nimEarned >= 5,          tier: 'legendary', icon: <PartyPopper size={15}/> },
    { id: 'immortal',     name: 'Immortal',        desc: 'Play 1,000 games',                   unlocked: user.gamesPlayed >= 1000,tier: 'legendary', icon: <Ghost size={15}/> },
    { id: 'grandmaster',  name: 'Grandmaster',     desc: 'Try every game in the arcade',       unlocked: gamesTried >= GAMES.filter(g => g.available).length, tier: 'legendary', icon: <ShieldCheck size={15}/> },
    { id: 'ascended',     name: 'Ascended',        desc: 'Convert XP to NIM 10 times',         unlocked: conversions >= 10,       tier: 'legendary', icon: <BadgeCheck size={15}/> },
  ]
  const unlockedCount = achievements.filter(a => a.unlocked).length

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
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] tracking-widest font-bold" style={{color:'var(--nim-muted)'}}>ACHIEVEMENTS</p>
            <p className="text-[10px] font-bold" style={{color:'var(--nim-muted)'}}>{unlockedCount}/{achievements.length}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {achievements.slice(0, achievementsShown).map(a=>{
              const t = TIER_STYLE[a.tier]
              const badgeShape = t.shape === 'hex' ? 'hex-clip' : t.shape === 'circle' ? 'rounded-full' : 'rounded-lg'
              return (
                <motion.div key={a.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                  className="relative rounded-xl p-3 flex items-center gap-2.5 overflow-hidden"
                  style={{
                    background: a.unlocked ? 'var(--y4)' : 'var(--y4)',
                    opacity: a.unlocked ? 1 : 0.5,
                    border: `1.5px solid ${a.unlocked ? t.border : 'var(--y2)'}`,
                    boxShadow: a.unlocked && t.glow !== 'transparent' ? `0 0 14px ${t.glow}` : 'none',
                  }}>
                  <div className={`${badgeShape} w-9 h-9 flex items-center justify-center shrink-0`}
                    style={{ background: a.unlocked ? t.bg : 'var(--y2)' }}>
                    {a.unlocked ? <span style={{ color: t.iconColor }}>{a.icon}</span> : <Lock size={13} style={{ color: 'var(--nim-muted)' }}/>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black tracking-wider mb-0.5" style={{ color: a.unlocked ? t.border : 'var(--nim-muted)' }}>{t.label}</p>
                    <p className="text-xs font-black leading-tight truncate" style={{color:'var(--nim-dark)'}}>{a.name}</p>
                    <p className="text-[10px] leading-tight" style={{color:'var(--nim-muted)'}}>{a.desc}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
          {achievementsShown < achievements.length && (
            <button
              onClick={() => setAchievementsShown(n => Math.min(achievements.length, n + 8))}
              className="w-full mt-2 rounded-xl py-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold"
              style={{ background: 'var(--y4)', border: '1px solid var(--y2)', color: 'var(--nim-mid)' }}
            >
              SEE MORE ({achievements.length - achievementsShown}) <ChevronDown size={14}/>
            </button>
          )}
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
