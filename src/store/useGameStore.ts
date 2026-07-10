import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Tab } from '../types'
import { getLevelFromXp, calculateDailyXpReward } from '../lib/xp'

export interface ActiveRoom {
  roomId: string
  gameId: string
  code: string
}

export interface ActiveTournament {
  tournamentId: string
  gameId: string
}

interface GameStore {
  user: User | null
  activeTab: Tab
  nimiqAddress: string | null
  nimBalance: number
  deviceIdentifier: string | null
  activeRoom: ActiveRoom | null
  /** The room the player is currently in the lobby/results view of — separate
   * from activeRoom (which only exists while they're off playing a match).
   * Persisted so returning to the Online tab lands back in the room instead
   * of the default Quick/Create/Join screen. */
  currentRoomId: string | null
  /** Set right before the player goes off to play a tournament's game; the
   * next matching setHighScore() submits their best score, same pattern as activeRoom. */
  activeTournament: ActiveTournament | null

  setUser: (user: User) => void
  setActiveTab: (tab: Tab) => void
  setNimiqAddress: (address: string) => void
  setNimBalance: (balance: number) => void
  setDeviceIdentifier: (id: string) => void
  setActiveRoom: (room: ActiveRoom | null) => void
  setCurrentRoomId: (id: string | null) => void
  setActiveTournament: (t: ActiveTournament | null) => void
  addXp: (amount: number) => void
  recordWin: () => void
  recordLoss: () => void
  highScores: Record<string, number>
  setHighScore: (gameId: string, score: number) => void
}

const defaultUser: User = {
  id: 'local',
  nimiqAddress: '',
  displayName: 'Player',
  avatar: '🎮',
  xp: 0,
  level: 1,
  totalNimEarned: 0,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  dailyXpEarned: 0,
  lastActiveDate: new Date().toDateString(),
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      user: defaultUser,
      activeTab: 'home',
      nimiqAddress: null,
      nimBalance: 0,
      deviceIdentifier: null,
      activeRoom: null,
      currentRoomId: null,
      activeTournament: null,
      highScores: {},

      setUser: (user) => set({ user }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setNimiqAddress: (address) => set({ nimiqAddress: address }),
      setNimBalance: (balance) => set({ nimBalance: balance }),
      setDeviceIdentifier: (id) => set({ deviceIdentifier: id }),
      setActiveRoom: (room) => set({ activeRoom: room }),
      setCurrentRoomId: (id) => set({ currentRoomId: id }),
      setActiveTournament: (t) => set({ activeTournament: t }),

      addXp: (amount) => {
        const { user } = get()
        if (!user) return

        const today = new Date().toDateString()
        const dailyXp = user.lastActiveDate === today ? user.dailyXpEarned : 0
        const effective = calculateDailyXpReward(dailyXp, amount)
        const newXp = user.xp + effective

        set({
          user: {
            ...user,
            xp: newXp,
            level: getLevelFromXp(newXp),
            dailyXpEarned: dailyXp + effective,
            lastActiveDate: today,
            gamesPlayed: user.gamesPlayed + 1,
          },
        })
      },

      recordWin: () => {
        const { user } = get()
        if (!user) return
        set({ user: { ...user, wins: user.wins + 1 } })
      },

      recordLoss: () => {
        const { user } = get()
        if (!user) return
        set({ user: { ...user, losses: user.losses + 1 } })
      },

      setHighScore: (gameId, score) => {
        const { highScores } = get()
        if ((highScores[gameId] ?? 0) < score) {
          set({ highScores: { ...highScores, [gameId]: score } })
        }
      },
    }),
    { name: 'nim-arcade-store' }
  )
)
