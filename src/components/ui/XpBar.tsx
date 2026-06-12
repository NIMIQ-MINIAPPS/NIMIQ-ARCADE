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
        <span className="text-[10px] font-bold text-[#FFC107] tracking-wider">LVL {level}</span>
        <div className="flex-1 h-1.5 bg-[#222] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#FFC107] to-[#FF9800] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[10px] text-[#555]">{xpForNext} XP</span>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-[#FFC107]">LEVEL {level}</span>
        <span className="text-xs text-[#666]">{xp.toLocaleString()} / {xpForNext.toLocaleString()} XP</span>
      </div>
      <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#333]">
        <motion.div
          className="h-full bg-gradient-to-r from-[#FFC107] to-[#FF9800] rounded-full relative"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <div className="absolute inset-0 bg-white/20 rounded-full" />
        </motion.div>
      </div>
    </div>
  )
}
