import { motion } from 'framer-motion'
import { getXpProgress } from '../../lib/xp'

interface XpBarProps {
  xp: number
  compact?: boolean
}

export default function XpBar({ xp, compact = false }: XpBarProps) {
  const { level, progress, xpForNext } = getXpProgress(xp)

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black tracking-wider" style={{ color: 'var(--gold)' }}>
          LVL {level}
        </span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--gold), var(--gold-bright))' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[10px]" style={{ color: 'var(--cream-muted)' }}>
          {xpForNext.toLocaleString()}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-black" style={{ color: 'var(--gold)' }}>LEVEL {level}</span>
        <span className="text-[11px]" style={{ color: 'var(--cream-muted)' }}>
          {xp.toLocaleString()} / {xpForNext.toLocaleString()} XP
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--cream-faint)', border: '1px solid var(--border)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, var(--gold), var(--gold-bright))' }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
