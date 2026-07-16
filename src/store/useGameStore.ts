import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Tab } from '../types'
import { getLevelFromXp, calculateDailyXpReward } from '../lib/xp'
import { setSoundMuted } from '../lib/gameAudio'

export interface ActiveRoom {
  roomId: string
  gameId: string
  code: string
  roundNumber: number
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
  highScores: Record<string, number>
  setHighScore: (gameId: string, score: number) => void
  /** Fires on every setHighScore() call, record or not — unlike highScores
   * (which only changes on a new record), this is how backendSync detects
   * "a room/tournament round just ended with score N" even when N is lower
   * than the player's all-time best for that game. */
  lastScoreEvent: { gameId: string; score: number; nonce: number } | null

  /** Persisted user preference — every game's snd() reads lib/gameAudio's
   * module-level `soundMuted` flag, which toggleSound keeps in sync with
   * this on every change and on store hydration. */
  soundEnabled: boolean
  toggleSound: () => void
}

const defaultUser: User = {
  id: 'local',
  nimiqAddress: '',
  displayName: 'Player',
  hasNickname: false,
  avatar: '🎮',
  xp: 0,
  totalXp: 0,
  level: 1,
  totalNimEarned: 0,
  gamesPlayed: 0,
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
      lastScoreEvent: null,
      soundEnabled: true,

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
        // totalXp only ever goes up — it's what ranking/level are based on,
        // so converting xp to NIM later never costs a player their rank.
        const newTotalXp = (user.totalXp ?? user.xp) + effective

        set({
          user: {
            ...user,
            xp: newXp,
            totalXp: newTotalXp,
            level: getLevelFromXp(newTotalXp),
            dailyXpEarned: dailyXp + effective,
            lastActiveDate: today,
            gamesPlayed: user.gamesPlayed + 1,
          },
        })
      },

      setHighScore: (gameId, score) => {
        const { highScores, lastScoreEvent } = get()
        const isRecord = (highScores[gameId] ?? 0) < score
        set({
          ...(isRecord ? { highScores: { ...highScores, [gameId]: score } } : {}),
          lastScoreEvent: { gameId, score, nonce: (lastScoreEvent?.nonce ?? 0) + 1 },
        })
      },

      toggleSound: () => {
        const next = !get().soundEnabled
        setSoundMuted(!next)
        set({ soundEnabled: next })
      },
    }),
    {
      name: 'nim-arcade-store',
      onRehydrateStorage: () => (state) => {
        // gameAudio's `soundMuted` is a plain module variable, not part of
        // this store, so it needs to be re-synced from the persisted
        // preference on every load — otherwise sound defaults back to
        // unmuted after a refresh even if the user had muted it.
        if (state) setSoundMuted(!state.soundEnabled)
      },
    }
  )
)
