import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/useGameStore'
import { formatAddress, formatNim, getNimiqSDK, fetchNimBalance } from '../lib/nimiq'
import { xpToNim } from '../lib/xp'
import { updateDisplayName, requestXpConversion } from '../lib/backend'
import XpBar from '../components/ui/XpBar'
import { NimLogo, DecorHex } from '../components/ui/Hex'
import GameIllustration from '../components/games/GameIllustration'
import { GAMES } from '../lib/games'
import { ChevronRight, Zap, Gift, ArrowUpRight, Pencil, Check, X, Loader2 } from 'lucide-react'

const FEATURED = ['nimtris', 'hexfall', 'runner', 'quicktap', 'memory']

function SendModal({ onClose }: { onClose: () => void }) {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const handleSend = async () => {
    const amt = Number(amount)
    if (!recipient.trim() || !amt || amt <= 0) return
    setSending(true)
    const sdk = getNimiqSDK()
    const res = await sdk?.requestPayment({ recipient: recipient.trim(), amount: amt })
    setSending(false)
    if (res?.success) setResult({ ok: true, text: `Sent! ${res.txHash?.slice(0, 14)}…` })
    else setResult({ ok: false, text: res?.error ?? 'Payment failed' })
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(31,35,72,.45)' }}
      onClick={onClose}>
      <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[430px] rounded-t-3xl p-5 space-y-3"
        style={{ background: 'var(--y5)' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-black text-sm" style={{ color: 'var(--nim-dark)' }}>SEND NIM</p>
          <button onClick={onClose}><X size={18} style={{ color: 'var(--nim-muted)' }} /></button>
        </div>
        <input placeholder="Recipient address (NQ…)" value={recipient} onChange={e => setRecipient(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none"
          style={{ background: 'var(--y4)', border: '1px solid var(--y2)', color: 'var(--nim-dark)' }} />
        <input placeholder="Amount (NIM)" type="number" min="0" step="0.001" value={amount} onChange={e => setAmount(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--y4)', border: '1px solid var(--y2)', color: 'var(--nim-dark)' }} />
        {result && (
          <p className="text-[12px] font-semibold" style={{ color: result.ok ? 'var(--green)' : '#E74C3C' }}>{result.text}</p>
        )}
        <button onClick={handleSend} disabled={sending || !recipient.trim() || !amount}
          className="w-full py-3 font-black rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: 'var(--nim-dark)', color: 'var(--gold)' }}>
          {sending ? <Loader2 size={16} className="animate-spin" /> : 'CONFIRM SEND'}
        </button>
      </motion.div>
    </motion.div>
  )
}

export default function HomePage() {
  const { user, nimBalance, nimiqAddress, setActiveTab, highScores, setUser, setNimBalance } = useGameStore()
  const [sendOpen, setSendOpen] = useState(false)
  const [converting, setConverting] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  // The Mini App SDK has no balance-reading method, so we read the real
  // on-chain balance directly (see lib/nimiq's fetchNimBalance). Refresh on
  // every visit to Home and poll while it's open, since a payout can land
  // seconds to minutes after a conversion or a room/tournament payout.
  useEffect(() => {
    if (!nimiqAddress) return
    const refresh = () => { fetchNimBalance(nimiqAddress).then(setNimBalance) }
    refresh()
    const id = setInterval(refresh, 15000)
    return () => clearInterval(id)
  }, [nimiqAddress, setNimBalance])

  if (!user) return null

  const featured = FEATURED.map(id => GAMES.find(g => g.id === id)!).filter(Boolean)
  const convertibleXp = Math.min(user.xp, 5000)

  const startEditName = () => { setNameDraft(user.displayName); setEditingName(true) }
  const saveName = async () => {
    const name = nameDraft.trim().slice(0, 24)
    if (!name) { setEditingName(false); return }
    setUser({ ...user, displayName: name })
    setEditingName(false)
    await updateDisplayName(name)
  }

  const handleConvert = async () => {
    if (converting || convertibleXp <= 0) return
    setConverting(true)
    const payout = await requestXpConversion(convertibleXp)
    if (payout) setUser({ ...user, xp: user.xp - convertibleXp })
    setConverting(false)
  }

  return (
    <div className="flex flex-col gap-5 pb-2">

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-5 pt-6 pb-8 hex-pattern"
        style={{ background: 'linear-gradient(160deg,var(--y3) 0%,var(--y5) 60%)' }}
      >
        {/* decorative hexagons */}
        <DecorHex size={110} x={270} y={-30} opacity={0.13} stroke="var(--gold)" strokeWidth={1.5} rotate={15} />
        <DecorHex size={60}  x={320} y={55}  opacity={0.18} fill="var(--gold-bg)" stroke="var(--gold)" strokeWidth={1} />
        <DecorHex size={45}  x={-18} y={60}  opacity={0.12} stroke="var(--nim-dark)" strokeWidth={1} rotate={10} />

        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <NimLogo size={28} />
              <div>
                <h1
                  className="text-2xl font-black tracking-tighter leading-none"
                  style={{ color: 'var(--nim-dark)' }}
                >
                  NIM<span style={{ color: 'var(--gold-dark)' }}>ARCADE</span>
                </h1>
                <p className="text-[9px] tracking-[0.2em] font-semibold mt-0.5" style={{ color: 'var(--nim-muted)' }}>
                  WEB3 ARCADE PLATFORM
                </p>
              </div>
            </div>
          </div>

          {/* Level hex badge */}
          <div
            className="hex-clip w-12 h-12 flex items-center justify-center font-black text-sm"
            style={{ background: 'var(--gold)', color: 'var(--nim-dark)' }}
          >
            {user.level}
          </div>
        </div>

        {/* display name */}
        <div className="relative mt-4 flex items-center gap-1.5">
          {editingName ? (
            <>
              <input
                autoFocus
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                maxLength={24}
                className="px-2.5 py-1 rounded-lg text-sm font-bold outline-none"
                style={{ background: 'white', border: '1.5px solid var(--gold)', color: 'var(--nim-dark)', width: 160 }}
              />
              <button onClick={saveName}><Check size={16} style={{ color: 'var(--green)' }} /></button>
              <button onClick={() => setEditingName(false)}><X size={16} style={{ color: 'var(--nim-muted)' }} /></button>
            </>
          ) : (
            <button onClick={startEditName} className="flex items-center gap-1.5">
              <span className="text-sm font-black" style={{ color: 'var(--nim-dark)' }}>{user.displayName}</span>
              <Pencil size={11} style={{ color: 'var(--nim-muted)' }} />
            </button>
          )}
        </div>

        {/* address pill */}
        <div className="relative mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono"
          style={{ background: 'rgba(255,255,255,.6)', border: '1px solid var(--y2)', color: 'var(--nim-mid)' }}>
          <svg width="8" height="8" viewBox="0 0 10 10"><polygon points="5,0.5 9.3,2.75 9.3,7.25 5,9.5 0.7,7.25 0.7,2.75" fill="var(--gold)"/></svg>
          {nimiqAddress ? formatAddress(nimiqAddress) : 'NQ07 0000…0000'}
        </div>
      </div>

      {/* ── Wallet + XP ─────────────────────────────────────────────────── */}
      <div className="px-4 -mt-5 space-y-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)', boxShadow: '0 4px 20px rgba(31,35,72,.08)' }}
        >
          {/* balance */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--y2)' }}>
            <div>
              <p className="text-[10px] tracking-widest font-semibold mb-0.5" style={{ color: 'var(--nim-muted)' }}>BALANCE</p>
              <p className="text-3xl font-black leading-none" style={{ color: 'var(--nim-dark)' }}>
                {nimBalance.toFixed(3)}
                <span className="text-base font-semibold ml-1" style={{ color: 'var(--nim-muted)' }}>NIM</span>
              </p>
            </div>
            <button
              onClick={() => setSendOpen(true)}
              className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl"
              style={{ background: 'var(--nim-dark)', color: 'var(--gold)' }}
            >
              Send <ArrowUpRight size={12} />
            </button>
          </div>

          {/* XP → NIM convert */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap size={12} style={{ color: 'var(--gold-dark)' }} />
                <span className="text-[10px] tracking-widest font-bold" style={{ color: 'var(--nim-muted)' }}>EXPERIENCE</span>
              </div>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--nim-mid)' }}>
                {(user.totalXp ?? user.xp).toLocaleString()} XP
              </span>
            </div>
            <XpBar xp={user.totalXp ?? user.xp} />
            <div className="flex items-center justify-between mt-3">
              <p className="text-[11px]" style={{ color: 'var(--nim-mid)' }}>
                {convertibleXp.toLocaleString()} XP
                <span style={{ color: 'var(--nim-light)' }}> = </span>
                <span className="font-bold" style={{ color: 'var(--gold-dark)' }}>{formatNim(xpToNim(convertibleXp))}</span>
              </p>
              <button
                onClick={handleConvert}
                disabled={converting || convertibleXp <= 0}
                className="text-[11px] font-black px-3 py-1.5 rounded-lg glow-gold-sm disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: 'var(--gold)', color: 'var(--nim-dark)' }}
              >
                {converting ? <Loader2 size={12} className="animate-spin" /> : 'CONVERT'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* stats strip */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'GAMES PLAYED', value: user.gamesPlayed,        color: 'var(--nim-dark)' },
            { label: 'TOTAL XP',     value: (user.totalXp ?? user.xp).toLocaleString(),color: 'var(--gold-dark)'},
          ].map(s => (
            <div key={s.label} className="rounded-xl px-3 py-2.5 text-center"
              style={{ background: 'var(--y4)', border: '1px solid var(--y2)' }}>
              <p className="text-xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9px] mt-0.5 tracking-widest" style={{ color: 'var(--nim-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Daily reward ────────────────────────────────────────────────── */}
      <div className="px-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="rounded-2xl px-4 py-3.5 flex items-center justify-between hex-pattern-gold"
          style={{ background: 'var(--gold-bg)', border: '1.5px solid var(--gold)', boxShadow: '0 0 20px var(--gold-glow)' }}
        >
          <div className="flex items-center gap-3">
            <div className="hex-clip w-10 h-10 flex items-center justify-center"
              style={{ background: 'var(--gold)' }}>
              <Gift size={16} style={{ color: 'var(--nim-dark)' }} />
            </div>
            <div>
              <p className="text-sm font-black" style={{ color: 'var(--nim-dark)' }}>Daily Reward</p>
              <p className="text-[11px]" style={{ color: 'var(--nim-mid)' }}>Play to earn bonus XP today</p>
            </div>
          </div>
          <button onClick={() => setActiveTab('games')}
            className="flex items-center gap-0.5 text-xs font-black"
            style={{ color: 'var(--gold-dark)' }}>
            PLAY <ChevronRight size={13} />
          </button>
        </motion.div>
      </div>

      {/* ── Quick play ──────────────────────────────────────────────────── */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold tracking-widest" style={{ color: 'var(--nim-muted)' }}>QUICK PLAY</p>
          <button onClick={() => setActiveTab('games')}
            className="text-[11px] flex items-center gap-0.5 font-semibold"
            style={{ color: 'var(--gold-dark)' }}>
            See all <ChevronRight size={11} />
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
          {featured.map(game => (
            <motion.button
              key={game.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => setActiveTab('games')}
              className="shrink-0 rounded-xl overflow-hidden"
              style={{ width: 112, background: 'var(--y4)', border: '1px solid var(--y2)', boxShadow: '0 2px 10px rgba(31,35,72,.07)' }}
            >
              <div style={{ width: 112, height: 75 }}>
                <GameIllustration id={game.id} className="w-full h-full" />
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[11px] font-black text-left truncate" style={{ color: 'var(--nim-dark)' }}>
                  {game.name}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--nim-muted)' }}>
                  {(highScores[game.id] ?? 0) > 0 ? (highScores[game.id] ?? 0).toLocaleString() : 'No record'}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {sendOpen && <SendModal onClose={() => setSendOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
