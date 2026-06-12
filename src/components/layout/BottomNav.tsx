import { motion } from 'framer-motion'
import { Home, Grid2X2, Wifi, Trophy, User } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { Tab } from '../../types'

const TABS: { id: Tab; icon: React.ReactNode; label: string }[] = [
  { id: 'home',        icon: <Home        size={18} strokeWidth={1.8} />, label: 'HOME'    },
  { id: 'games',       icon: <Grid2X2     size={18} strokeWidth={1.8} />, label: 'GAMES'   },
  { id: 'online',      icon: <Wifi        size={18} strokeWidth={1.8} />, label: 'ONLINE'  },
  { id: 'tournaments', icon: <Trophy      size={18} strokeWidth={1.8} />, label: 'CUPS'    },
  { id: 'profile',     icon: <User        size={18} strokeWidth={1.8} />, label: 'PROFILE' },
]

export default function BottomNav() {
  const { activeTab, setActiveTab } = useGameStore()

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
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
                  layoutId="nav-bg"
                  className="absolute inset-0"
                  style={{ background: 'rgba(212,168,67,.08)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              {active && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: 'var(--gold)' }}
                />
              )}
              <span style={{ color: active ? 'var(--gold)' : 'var(--cream-muted)' }}>
                {tab.icon}
              </span>
              <span
                className="text-[9px] font-bold tracking-widest"
                style={{ color: active ? 'var(--gold)' : 'var(--cream-muted)' }}
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
