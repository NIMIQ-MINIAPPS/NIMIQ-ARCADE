// Data layer for the admin metrics dashboard (src/pages/AdminMetricsPage.tsx).
// All three RPCs are security-definer + admin-gated server-side (see
// supabase/012_admin_metrics.sql) — a non-admin caller gets a Postgres
// "not authorized" error back, which callers here surface as `unauthorized`
// rather than throwing, so the page can render a clean "not an admin" state.

import { supabase, supabaseConfigured } from './supabase'

export const adminMetricsAvailable = supabaseConfigured

export interface AdminOverview {
  totalPlayers: number
  playersWithWallet: number
  newPlayersToday: number
  newPlayers7d: number
  newPlayers30d: number
  activeToday: number
  active7d: number
  active30d: number
  totalGamesPlayed: number
  totalHighScores: number
  nimPaidOut: number
  nimPayoutsPending: number
  nimEntryFeesEst: number
}

export interface AdminTopGame {
  gameId: string
  uniquePlayers: number
  avgScore: number
  topScore: number
}

export interface AdminGrowthPoint {
  day: string
  newPlayers: number
}

export interface AdminVolumePoint {
  day: string
  nimPaidOut: number
}

export type AdminMetricsResult<T> =
  | { ok: true; data: T }
  | { ok: false; unauthorized: true }
  | { ok: false; unauthorized: false; error: string }

function isAuthError(message: string): boolean {
  return message.toLowerCase().includes('not authorized')
}

export async function fetchAdminOverview(): Promise<AdminMetricsResult<AdminOverview>> {
  if (!supabase) return { ok: false, unauthorized: false, error: 'Backend not configured' }
  const { data, error } = await supabase.rpc('admin_overview_metrics')
  if (error) return isAuthError(error.message) ? { ok: false, unauthorized: true } : { ok: false, unauthorized: false, error: error.message }
  const row = data?.[0]
  if (!row) return { ok: false, unauthorized: false, error: 'No data returned' }
  return {
    ok: true,
    data: {
      totalPlayers: row.total_players,
      playersWithWallet: row.players_with_wallet,
      newPlayersToday: row.new_players_today,
      newPlayers7d: row.new_players_7d,
      newPlayers30d: row.new_players_30d,
      activeToday: row.active_today,
      active7d: row.active_7d,
      active30d: row.active_30d,
      totalGamesPlayed: row.total_games_played,
      totalHighScores: row.total_high_scores,
      nimPaidOut: row.nim_paid_out,
      nimPayoutsPending: row.nim_payouts_pending,
      nimEntryFeesEst: row.nim_entry_fees_est,
    },
  }
}

export async function fetchAdminTopGames(limit = 8): Promise<AdminMetricsResult<AdminTopGame[]>> {
  if (!supabase) return { ok: false, unauthorized: false, error: 'Backend not configured' }
  const { data, error } = await supabase.rpc('admin_top_games', { p_limit: limit })
  if (error) return isAuthError(error.message) ? { ok: false, unauthorized: true } : { ok: false, unauthorized: false, error: error.message }
  return {
    ok: true,
    data: (data ?? []).map(r => ({ gameId: r.game_id, uniquePlayers: r.unique_players, avgScore: r.avg_score, topScore: r.top_score })),
  }
}

export async function fetchAdminGrowth(days = 30): Promise<AdminMetricsResult<AdminGrowthPoint[]>> {
  if (!supabase) return { ok: false, unauthorized: false, error: 'Backend not configured' }
  const { data, error } = await supabase.rpc('admin_growth', { p_days: days })
  if (error) return isAuthError(error.message) ? { ok: false, unauthorized: true } : { ok: false, unauthorized: false, error: error.message }
  return { ok: true, data: (data ?? []).map(r => ({ day: r.day, newPlayers: r.new_players })) }
}

export async function fetchAdminVolumeGrowth(days = 30): Promise<AdminMetricsResult<AdminVolumePoint[]>> {
  if (!supabase) return { ok: false, unauthorized: false, error: 'Backend not configured' }
  const { data, error } = await supabase.rpc('admin_volume_growth', { p_days: days })
  if (error) return isAuthError(error.message) ? { ok: false, unauthorized: true } : { ok: false, unauthorized: false, error: error.message }
  return { ok: true, data: (data ?? []).map(r => ({ day: r.day, nimPaidOut: r.nim_paid_out })) }
}
