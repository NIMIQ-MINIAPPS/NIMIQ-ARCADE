import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Volume2, VolumeX } from 'lucide-react'
import { useGameStore } from './store/useGameStore'
import BottomNav from './components/layout/BottomNav'
import HomePage from './pages/HomePage'
import GamesPage from './pages/GamesPage'
import OnlinePage from './pages/OnlinePage'
import TournamentsPage from './pages/TournamentsPage'
import ProfilePage from './pages/ProfilePage'
import NicknameGateModal from './components/ui/NicknameGateModal'
import AdminMetricsPage from './pages/AdminMetricsPage'
import { initNimiq, isUsingMockSdk } from './lib/nimiq'
import { startBackendSync } from './lib/backendSync'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export default function App() {
  const { activeTab, user, setUser, setNimiqAddress, setNimBalance, setDeviceIdentifier, soundEnabled, toggleSound } = useGameStore()
  const [demoMode, setDemoMode] = useState(false)
  // Hidden entry point for the internal metrics dashboard — never a bottom-nav
  // tab (regular players shouldn't see it). Just open the app with #admin.
  const [isAdminRoute, setIsAdminRoute] = useState(() => window.location.hash === '#admin')

  useEffect(() => {
    const onHashChange = () => setIsAdminRoute(window.location.hash === '#admin')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // One-time migration: players who already had a custom display name before
  // the nickname gate existed shouldn't be re-prompted for one.
  useEffect(() => {
    if (user && !user.hasNickname && user.displayName && user.displayName !== 'Player') {
      setUser({ ...user, hasNickname: true })
    }
  }, [user, setUser])

  useEffect(() => {
    initNimiq().then(async (sdk) => {
      const mock = isUsingMockSdk()
      setDemoMode(mock)
      const accounts = await sdk.listAccounts()
      if (accounts[0]) {
        setNimiqAddress(accounts[0].address)
        setNimBalance(accounts[0].balance)
      }
      if (!mock) {
        try {
          setDeviceIdentifier(await sdk.requestDeviceIdentifier())
        } catch (err) {
          console.error('[App] requestDeviceIdentifier failed:', err)
        }
      }
      startBackendSync()
    })
  }, [setNimiqAddress, setNimBalance, setDeviceIdentifier])

  const renderPage = () => {
    switch (activeTab) {
      case 'home': return <HomePage key="home" />
      case 'games': return <GamesPage key="games" />
      case 'online': return <OnlinePage key="online" />
      case 'tournaments': return <TournamentsPage key="tournaments" />
      case 'profile': return <ProfilePage key="profile" />
    }
  }

  if (isAdminRoute) {
    return <AdminMetricsPage />
  }

  if (user && !user.hasNickname) {
    return <NicknameGateModal />
  }

  return (
    <div className="flex flex-col min-h-dvh relative" style={{ background: 'var(--bg)' }}>
      <button
        onClick={toggleSound}
        aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
        className="absolute z-40 flex items-center justify-center rounded-full"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          right: 10,
          width: 34, height: 34,
          background: 'var(--y4)',
          border: '1.5px solid var(--y1)',
          boxShadow: '0 2px 10px rgba(31,35,72,.1)',
          color: soundEnabled ? 'var(--gold-dark)' : 'var(--nim-muted)',
        }}
      >
        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
      {demoMode && (
        <div
          className="shrink-0 text-center text-[10px] font-bold tracking-widest py-1"
          style={{ background: 'var(--nim-dark)', color: 'var(--gold)' }}
        >
          DEMO MODE — NOT RUNNING INSIDE NIMIQ PAY
        </div>
      )}
      <main className="flex-1 overflow-y-auto pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.15 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
