// Tournament entry + ranking. Tournaments themselves are admin/service_role-only
// to create (see supabase/schema.sql — no insert policy for regular clients);
// entering and submitting a best score is self-service.
//
// Entry fees: `entry_fee_nim` is tracked per tournament but NOT collected yet —
// that requires a house wallet address to send the payment to, which hasn't
// been provided. All seeded tournaments have entry_fee_nim = 0 so this is
// honest (nothing is silently free that was supposed to cost NIM). Wiring real
// collection is a `sdk.requestPayment({ recipient: HOUSE_WALLET, amount })`
// call in enterTournament() once that address exists — left as a TODO, not
// faked.

import { supabase, supabaseConfigured } from './supabase'
import type { Database } from './database.types'

export const tournamentsAvailable = supabaseConfigured

export type TournamentRow = Database['public']['Tables']['tournaments']['Row']
export type TournamentEntryRow = Database['public']['Tables']['tournament_entries']['Row']

export interface RankedEntry extends TournamentEntryRow {
  displayName: string
  avatar: string
}

export async function fetchTournaments(): Promise<TournamentRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('tournaments').select('*').order('starts_at', { ascending: true })
  if (error) {
    console.error('[tournaments] fetchTournaments failed:', error.message)
    return []
  }
  return data
}

export async function fetchMyEntry(tournamentId: string, playerId: string): Promise<TournamentEntryRow | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('tournament_entries')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
    .maybeSingle()
  return data
}

export async function enterTournament(tournamentId: string, playerId: string, paidTxHash?: string): Promise<TournamentEntryRow | null> {
  if (!supabase) return null
  const existing = await fetchMyEntry(tournamentId, playerId)
  if (existing) return existing
  const { data, error } = await supabase
    .from('tournament_entries')
    .insert({ tournament_id: tournamentId, player_id: playerId, paid_tx_hash: paidTxHash ?? null })
    .select()
    .single()
  if (error) {
    console.error('[tournaments] enterTournament failed:', error.message)
    return null
  }
  return data
}

/** Client-side "keep the max" — small race window on rapid double-submits, acceptable for this scale. */
export async function submitTournamentScore(tournamentId: string, playerId: string, score: number): Promise<void> {
  if (!supabase) return
  const current = await fetchMyEntry(tournamentId, playerId)
  if (current && score <= current.best_score) return
  const { error } = await supabase
    .from('tournament_entries')
    .update({ best_score: score })
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
  if (error) console.error('[tournaments] submitTournamentScore failed:', error.message)
}

export async function fetchRanking(tournamentId: string, limit = 50): Promise<RankedEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tournament_entries')
    .select('*, players(display_name, avatar)')
    .eq('tournament_id', tournamentId)
    .order('best_score', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[tournaments] fetchRanking failed:', error.message)
    return []
  }
  return (data as unknown as (TournamentEntryRow & { players: { display_name: string; avatar: string } | null })[]).map(r => ({
    ...r,
    displayName: r.players?.display_name ?? 'Player',
    avatar: r.players?.avatar ?? '🎮',
  }))
}
