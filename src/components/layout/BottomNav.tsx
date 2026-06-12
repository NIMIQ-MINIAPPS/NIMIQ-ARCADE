import { motion } from 'framer-motion'
import { Home, Gamepad2, Wifi, Trophy, User } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { Tab } from '../../types'

const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
  { id: 'home', icon: <Home size={20} />, label: 'HOME' },
  { id: 'games', icon: <Gamepad2 size={20} />, label: 'GAMES' },
  { id: 'online', icon: <Wifi size={20} />, label: 'ONLINE' },
  { id: 'tournaments', icon: <Trophy size={20} />, label: 'CUPS' },
  { id: 'profile', icon: <User size={20} />, label: 'PROFILE' },
]

export default function BottomNav() {
  const { activeTab, setActiveTab } = useGameStore()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50">
      <div className="bg-[#0d0d0d] border-t border-[#222] flex items-stretch">
        {tabs.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 relative overflow-hidden"
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-[#FFC107]/8"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#FFC107] rounded-full" />
              )}
              <span className={active ? 'text-[#FFC107]' : 'text-[#555]'}>
                {tab.icon}
              </span>
              <span className={`text-[9px] font-bold tracking-widest ${active ? 'text-[#FFC107]' : 'text-[#555]'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
