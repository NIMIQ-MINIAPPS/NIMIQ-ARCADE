import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import type { GameTheme } from '../../lib/gameThemes'

interface HudItem {
  label: string
  value: string | number
  color?: string
}

interface GameShellProps {
  theme: GameTheme
  onExit: () => void
  children: React.ReactNode
  hud?: HudItem[]
  hudRight?: React.ReactNode
}

export function GameShell({ theme, onExit, children, hud, hudRight }: GameShellProps) {
  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg }}>
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: theme.hudBg, borderBottom: `1px solid ${theme.gridLine}` }}
      >
        <button onClick={onExit} style={{ color: theme.hudMuted }}>
          <ArrowLeft size={20} />
        </button>
        <h2
          className="font-black tracking-[0.15em] text-[13px]"
          style={{ color: theme.hudText }}
        >
          {theme.name}
        </h2>
        {hudRight ?? (
          <div className="flex items-center gap-3">
            {hud?.map(item => (
              <div key={item.label} className="text-right">
                <p className="text-[9px] tracking-widest font-semibold" style={{ color: theme.hudMuted }}>
                  {item.label}
                </p>
                <p className="font-black text-[15px] leading-none" style={{ color: item.color ?? theme.accent }}>
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 relative overflow-hidden">
        {children}
      </div>
    </div>
  )
}

interface StartOverlayProps {
  theme: GameTheme
  onStart: () => void
  icon?: React.ReactNode
}

export function StartOverlay({ theme, onStart, icon }: StartOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1"
      style={{ background: theme.overlayBg }}
    >
      {icon && <div className="mb-3">{icon}</div>}
      <h3
        className="text-2xl font-black tracking-tight"
        style={{ color: theme.accent }}
      >
        {theme.name}
      </h3>
      <p className="text-[12px] mb-6" style={{ color: theme.hudMuted }}>
        {theme.tagline}
      </p>
      <button
        onClick={onStart}
        className="px-8 py-3 rounded-xl font-black text-[15px] tracking-wide"
        style={{ background: theme.btnPrimary, color: theme.btnPrimaryText }}
      >
        PLAY
      </button>
    </motion.div>
  )
}

interface GameOverOverlayProps {
  theme: GameTheme
  score: number
  onRestart: () => void
  onExit: () => void
  xpEarned: number
  isNewBest?: boolean
  won?: boolean
  stats?: { label: string; value: string | number }[]
  title?: string
}

export function GameOverOverlay({
  theme, score, onRestart, onExit, xpEarned, isNewBest, won, stats, title,
}: GameOverOverlayProps) {
  const headColor = won === true ? theme.success : won === false ? theme.danger : theme.danger
  const headText = title ?? (won === true ? 'YOU WIN!' : won === false ? 'YOU LOSE' : 'GAME OVER')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2"
      style={{ background: theme.overlayBg }}
    >
      <p className="text-xl font-black tracking-wide" style={{ color: headColor }}>
        {headText}
      </p>
      <p className="text-4xl font-black" style={{ color: theme.hudText }}>
        {score.toLocaleString()}
      </p>
      {isNewBest && (
        <p className="text-[11px] font-bold tracking-widest" style={{ color: theme.accent }}>
          NEW BEST
        </p>
      )}
      {stats && (
        <div className="flex gap-4 mt-1">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-[10px] tracking-widest" style={{ color: theme.hudMuted }}>{s.label}</p>
              <p className="text-sm font-black" style={{ color: theme.hudText }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-[12px] font-semibold mt-1" style={{ color: theme.accent }}>
        +{xpEarned} XP
      </p>
      <div className="flex gap-3 mt-3">
        <button
          onClick={onRestart}
          className="px-6 py-2.5 rounded-xl font-black text-[13px]"
          style={{ background: theme.btnPrimary, color: theme.btnPrimaryText }}
        >
          PLAY AGAIN
        </button>
        <button
          onClick={onExit}
          className="px-6 py-2.5 rounded-xl font-black text-[13px]"
          style={{ background: theme.btnSecondary, color: theme.btnSecondaryText }}
        >
          EXIT
        </button>
      </div>
    </motion.div>
  )
}
