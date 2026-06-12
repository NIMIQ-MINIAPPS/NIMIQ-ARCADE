import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from './store/useGameStore'
import BottomNav from './components/layout/BottomNav'
import HomePage from './pages/HomePage'
import GamesPage from './pages/GamesPage'
import OnlinePage from './pages/OnlinePage'
import TournamentsPage from './pages/TournamentsPage'
import ProfilePage from './pages/ProfilePage'
import { initNimiq } from './lib/nimiq'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export default function App() {
  const { activeTab, setNimiqAddress, setNimBalance } = useGameStore()

  useEffect(() => {
    initNimiq().then(async (sdk) => {
      const accounts = await sdk.listAccounts()
      if (accounts[0]) {
        setNimiqAddress(accounts[0].address)
        setNimBalance(accounts[0].balance)
      }
    })
  }, [setNimiqAddress, setNimBalance])

  const renderPage = () => {
    switch (activeTab) {
      case 'home': return <HomePage key="home" />
      case 'games': return <GamesPage key="games" />
      case 'online': return <OnlinePage key="online" />
      case 'tournaments': return <TournamentsPage key="tournaments" />
      case 'profile': return <ProfilePage key="profile" />
    }
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[#080808] relative scanlines">
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
