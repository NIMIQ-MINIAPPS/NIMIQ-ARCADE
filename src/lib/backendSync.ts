// Wires useGameStore to the Supabase backend without touching any game file —
// games only ever call addXp()/setHighScore() on the local store (as before);
// this module observes that store and pushes changes up. Call startBackendSync()
// once from App.tsx after the Nimiq SDK has resolved (so deviceIdentifier/
// nimiqAddress are available for the first push).
//
// Same hook also drives Online rooms: if the player has an `activeRoom` set
// (OnlinePage.tsx sets it after joining a room lobby) and the next
// setHighScore() call is for that room's gameId, that score is submitted to
// the room automatically and activeRoom is cleared — one submission per match.

import { useGameStore } from '../store/useGameStore'
import { ensureSession, mergeProgress, pushHighScore, backendAvailable } from './backend'
import { submitRoomScore } from './rooms'
import { submitTournamentScore } from './tournaments'

function toISODate(input: string): string {
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10)
}

let started = false

export async function startBackendSync(): Promise<void> {
  if (started || !backendAvailable) return
  started = true

  const playerId = await ensureSession()
  if (!playerId) return

  const { user, nimiqAddress, deviceIdentifier } = useGameStore.getState()
  if (!user) return

  const merged = await mergeProgress({
    xp: user.xp,
    level: user.level,
    wins: user.wins,
    losses: user.losses,
    gamesPlayed: user.gamesPlayed,
    dailyXpEarned: user.dailyXpEarned,
    lastActiveDate: toISODate(user.lastActiveDate),
    displayName: user.displayName,
    avatar: user.avatar,
    nimiqAddress,
    deviceIdentifier,
  })

  if (merged) {
    const current = useGameStore.getState().user
    if (current) {
      useGameStore.getState().setUser({
        ...current,
        id: merged.id,
        xp: merged.xp,
        level: merged.level,
        wins: merged.wins,
        losses: merged.losses,
        gamesPlayed: merged.games_played,
        dailyXpEarned: merged.daily_xp_earned,
        lastActiveDate: merged.last_active_date,
        displayName: merged.display_name,
        avatar: merged.avatar,
      })
    }
  }

  let lastHighScores: Record<string, number> = { ...useGameStore.getState().highScores }
  let pushTimer: ReturnType<typeof setTimeout> | null = null

  useGameStore.subscribe((state) => {
    for (const [gameId, score] of Object.entries(state.highScores)) {
      if (lastHighScores[gameId] !== score) {
        pushHighScore(gameId, score)

        const room = state.activeRoom
        if (room && room.gameId === gameId) {
          submitRoomScore(room.roomId, playerId, score)
          useGameStore.getState().setActiveRoom(null)
        }

        const tourney = state.activeTournament
        if (tourney && tourney.gameId === gameId) {
          submitTournamentScore(tourney.tournamentId, playerId, score)
          useGameStore.getState().setActiveTournament(null)
        }
      }
    }
    lastHighScores = { ...state.highScores }

    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      const s = useGameStore.getState()
      if (!s.user) return
      mergeProgress({
        xp: s.user.xp,
        level: s.user.level,
        wins: s.user.wins,
        losses: s.user.losses,
        gamesPlayed: s.user.gamesPlayed,
        dailyXpEarned: s.user.dailyXpEarned,
        lastActiveDate: toISODate(s.user.lastActiveDate),
        displayName: s.user.displayName,
        avatar: s.user.avatar,
        nimiqAddress: s.nimiqAddress,
        deviceIdentifier: s.deviceIdentifier,
      })
    }, 1500)
  })
}
