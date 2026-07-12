// Wires useGameStore to the Supabase backend without touching any game file —
// games only ever call addXp()/setHighScore() on the local store (as before);
// this module observes that store and pushes changes up. Call startBackendSync()
// once from App.tsx after the Nimiq SDK has resolved (so deviceIdentifier/
// nimiqAddress are available for the first push).
//
// Same hook also drives Online rooms/Tournaments: if the player has an
// `activeRoom`/`activeTournament` set (OnlinePage.tsx / TournamentsPage.tsx
// set these right before sending the player off to play) and the next score
// event is for that game, it's submitted automatically.
//
// This listens to `lastScoreEvent`, NOT `highScores` diffs — highScores only
// changes on a new personal record, but a room round (or a tournament retry)
// can legitimately end with a LOWER score than the player's all-time best,
// and that still has to reach the room or the round would hang forever
// waiting on this player. lastScoreEvent fires on every setHighScore() call.

import { useGameStore } from '../store/useGameStore'
import { ensureSession, mergeProgress, pushHighScore, backendAvailable } from './backend'
import { submitRoundScore } from './rooms'
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
    totalXp: user.totalXp ?? user.xp,
    level: user.level,
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
        totalXp: merged.total_xp_earned,
        level: merged.level,
        gamesPlayed: merged.games_played,
        dailyXpEarned: merged.daily_xp_earned,
        lastActiveDate: merged.last_active_date,
        displayName: merged.display_name,
        avatar: merged.avatar,
      })
    }
  }

  let lastHighScores: Record<string, number> = { ...useGameStore.getState().highScores }
  let lastEventNonce = useGameStore.getState().lastScoreEvent?.nonce ?? 0
  let pushTimer: ReturnType<typeof setTimeout> | null = null

  useGameStore.subscribe((state) => {
    for (const [gameId, score] of Object.entries(state.highScores)) {
      if (lastHighScores[gameId] !== score) pushHighScore(gameId, score)
    }
    lastHighScores = { ...state.highScores }

    const event = state.lastScoreEvent
    if (event && event.nonce !== lastEventNonce) {
      lastEventNonce = event.nonce

      const room = state.activeRoom
      if (room && room.gameId === event.gameId) {
        submitRoundScore(room.roomId, room.roundNumber, event.score)
        useGameStore.getState().setActiveRoom(null)
      }

      const tourney = state.activeTournament
      if (tourney && tourney.gameId === event.gameId) {
        submitTournamentScore(tourney.tournamentId, playerId, event.score)
        useGameStore.getState().setActiveTournament(null)
      }
    }

    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      const s = useGameStore.getState()
      if (!s.user) return
      mergeProgress({
        xp: s.user.xp,
        totalXp: s.user.totalXp ?? s.user.xp,
        level: s.user.level,
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
