// Player identity + progress sync against Supabase. Requires supabase/schema.sql
// and supabase/002_functions.sql to already be applied, and Anonymous Sign-ins
// enabled (Authentication → Providers) — see AGENTS.md.

import { supabase, supabaseConfigured } from './supabase'
import type { Database } from './database.types'

export type PlayerRow = Database['public']['Tables']['players']['Row']

export const backendAvailable = supabaseConfigured

/**
 * Ensures there's a signed-in (anonymous) Supabase session and that the
 * player's row exists. Reuses a persisted session across reloads — only
 * calls signInAnonymously() once per device, ever.
 */
/** Reads the current (already-established) session without triggering a new sign-in. */
export async function getCurrentPlayerId(): Promise<string | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user.id ?? null
}

export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) return session.user.id

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.session) {
    console.error('[backend] anonymous sign-in failed:', error?.message)
    return null
  }
  return data.session.user.id
}

interface LocalProgress {
  xp: number
  level: number
  wins: number
  losses: number
  gamesPlayed: number
  dailyXpEarned: number
  lastActiveDate: string
  displayName: string
  avatar: string
  nimiqAddress: string | null
  deviceIdentifier: string | null
}

/** Atomic "keep the max" merge — never loses progress from either side. */
export async function mergeProgress(p: LocalProgress): Promise<PlayerRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('merge_player_progress', {
    p_xp: p.xp,
    p_level: p.level,
    p_wins: p.wins,
    p_losses: p.losses,
    p_games_played: p.gamesPlayed,
    p_daily_xp_earned: p.dailyXpEarned,
    p_last_active_date: p.lastActiveDate,
    p_display_name: p.displayName,
    p_avatar: p.avatar,
    p_nimiq_address: p.nimiqAddress,
    p_device_identifier: p.deviceIdentifier,
  })
  if (error) {
    console.error('[backend] mergeProgress failed:', error.message)
    return null
  }
  return data
}

export async function pushHighScore(gameId: string, score: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('upsert_high_score', { p_game_id: gameId, p_score: score })
  if (error) console.error('[backend] pushHighScore failed:', error.message)
}

export interface LeaderboardEntry {
  id: string
  displayName: string
  avatar: string
  xp: number
  level: number
  wins: number
}

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('players')
    .select('id, display_name, avatar, xp, level, wins')
    .order('xp', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[backend] fetchLeaderboard failed:', error.message)
    return []
  }
  return data.map(r => ({ id: r.id, displayName: r.display_name, avatar: r.avatar, xp: r.xp, level: r.level, wins: r.wins }))
}

export type PayoutRow = Database['public']['Tables']['payouts']['Row']

export async function fetchMyPayouts(): Promise<PayoutRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[backend] fetchMyPayouts failed:', error.message)
    return []
  }
  return data
}

/** Spends XP and creates a 'pending' payout row. See 002_functions.sql for why this needs an RPC. */
export async function requestXpConversion(xpAmount: number): Promise<PayoutRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('request_xp_conversion', { p_xp_amount: xpAmount })
  if (error) {
    console.error('[backend] requestXpConversion failed:', error.message)
    return null
  }
  return data
}
