import { motion } from 'framer-motion'
import { Home, Grid2X2, Wifi, Trophy, User } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { Tab } from '../../types'

const TABS: { id: Tab; icon: React.ReactNode; label: string }[] = [
  { id: 'home',        icon: <Home     size={19} strokeWidth={1.7} />, label: 'HOME'    },
  { id: 'games',       icon: <Grid2X2  size={19} strokeWidth={1.7} />, label: 'GAMES'   },
  { id: 'online',      icon: <Wifi     size={19} strokeWidth={1.7} />, label: 'ONLINE'  },
  { id: 'tournaments', icon: <Trophy   size={19} strokeWidth={1.7} />, label: 'CUPS'    },
  { id: 'profile',     icon: <User     size={19} strokeWidth={1.7} />, label: 'PROFILE' },
]

export default function BottomNav() {
  const { activeTab, setActiveTab } = useGameStore()

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50"
      style={{
        background: 'var(--y4)',
        borderTop: '1.5px solid var(--y2)',
        boxShadow: '0 -4px 24px rgba(31,35,72,.07)',
      }}
    >
      <div className="flex items-stretch">
        {TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 relative overflow-hidden"
            >
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0"
                  style={{ background: 'var(--gold-bg)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              {active && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: 'var(--gold)' }}
                />
              )}
              <span className="relative" style={{ color: active ? 'var(--gold-dark)' : 'var(--nim-muted)' }}>
                {tab.icon}
              </span>
              <span
                className="relative text-[9px] font-bold tracking-widest"
                style={{ color: active ? 'var(--gold-dark)' : 'var(--nim-muted)' }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
