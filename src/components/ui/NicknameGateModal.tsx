import { useState } from 'react'
import { motion } from 'framer-motion'
import { NimLogo, DecorHex, HexGrid } from './Hex'
import { updateDisplayName } from '../../lib/backend'
import { useGameStore } from '../../store/useGameStore'

/** Full-screen, unskippable gate shown until the player picks a nickname.
 * Mounted in App.tsx in place of the tab pages whenever !user.hasNickname. */
export default function NicknameGateModal() {
  const { user, setUser } = useGameStore()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const confirm = async () => {
    const trimmed = name.trim().slice(0, 24)
    if (trimmed.length < 2) { setError('Nickname must be at least 2 characters'); return }
    setSaving(true)
    setError(null)
    setUser({ ...user, displayName: trimmed, hasNickname: true })
    await updateDisplayName(trimmed)
    setSaving(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{ background: 'linear-gradient(160deg,var(--y3) 0%,var(--y5) 60%)' }}
    >
      <HexGrid opacity={0.06} />
      <DecorHex size={130} x={-30} y={-40} opacity={0.15} stroke="var(--gold)" strokeWidth={1.5} rotate={15} />
      <DecorHex size={80}  x={330} y={620} opacity={0.16} fill="var(--gold-bg)" stroke="var(--gold)" strokeWidth={1} />

      <motion.div
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
        className="relative w-full max-w-[360px] rounded-3xl p-6 flex flex-col items-center gap-4"
        style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)', boxShadow: '0 8px 32px rgba(31,35,72,.15)' }}
      >
        <NimLogo size={44} />
        <div className="text-center">
          <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--nim-dark)' }}>
            WELCOME TO <span style={{ color: 'var(--gold-dark)' }}>NIM ARCADE</span>
          </h1>
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--nim-muted)' }}>
            Pick a nickname to save your XP, scores and rank. You'll play under this name everywhere.
          </p>
        </div>

        <div className="w-full">
          <input
            autoFocus
            value={name}
            onChange={e => { setName(e.target.value); setError(null) }}
            onKeyDown={e => { if (e.key === 'Enter') confirm() }}
            maxLength={24}
            placeholder="Your nickname"
            className="w-full px-4 py-3 rounded-xl text-sm font-bold outline-none text-center"
            style={{ background: 'white', border: `1.5px solid ${error ? 'var(--red, #E74C3C)' : 'var(--gold)'}`, color: 'var(--nim-dark)' }}
          />
          {error && <p className="text-[11px] font-semibold mt-1.5 text-center" style={{ color: '#E74C3C' }}>{error}</p>}
        </div>

        <button
          onClick={confirm}
          disabled={saving || name.trim().length < 2}
          className="w-full py-3.5 font-black rounded-xl disabled:opacity-50 glow-gold-sm text-[14px] tracking-wide"
          style={{ background: 'var(--gold)', color: 'var(--nim-dark)' }}
        >
          {saving ? 'SAVING…' : 'ENTER ARCADE'}
        </button>
      </motion.div>
    </motion.div>
  )
}
