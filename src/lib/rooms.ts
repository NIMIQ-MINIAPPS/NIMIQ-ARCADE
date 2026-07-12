// Async score-battle "Online" rooms — a series of N rounds (default 10,
// ~2 min each) across one or more games chosen by the host. Every round, all
// current players go play the SAME game normally through the Games tab;
// roomSync (hooked the same way backendSync.ts hooks XP/high-score sync)
// watches for that game's score and submits it automatically. No game file
// needs to know rooms exist.
//
// All round-advance / finalize / payout logic lives server-side in
// supabase/003_rooms_series.sql's start_room() and submit_round_score() RPCs
// — the client only ever calls those two functions, never writes rounds or
// round scores directly (there's no RLS insert policy for them on purpose).

import { supabase, supabaseConfigured } from './supabase'
import type { Database } from './database.types'

export const roomsAvailable = supabaseConfigured

export type RoomRow = Database['public']['Tables']['rooms']['Row']
export type RoomPlayerRow = Database['public']['Tables']['room_players']['Row']
export type RoomRoundRow = Database['public']['Tables']['room_rounds']['Row']

export const MAX_ROOM_PLAYERS = 10

export interface OpenRoom extends RoomRow {
  playerCount: number
}

export interface RoomPlayerWithProfile extends RoomPlayerRow {
  displayName: string
  avatar: string
}

export interface StandingsEntry {
  playerId: string
  displayName: string
  avatar: string
  total: number
  roundScores: Record<number, number>
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L — avoids read-aloud ambiguity

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return code
}

export async function createRoom(
  gameIds: string[], maxPlayers: number, rounds: number, hostId: string, entryFeeNim = 0,
): Promise<RoomRow | null> {
  if (!supabase || gameIds.length === 0) return null
  const clampedMax = Math.min(MAX_ROOM_PLAYERS, Math.max(2, maxPlayers))
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code, game_id: gameIds[0], game_ids: gameIds, host_id: hostId, max_players: clampedMax, rounds, entry_fee_nim: entryFeeNim })
      .select()
      .single()
    if (!error) {
      await supabase.from('room_players').insert({ room_id: data.id, player_id: hostId })
      return data
    }
    if (error.code !== '23505') {
      console.error('[rooms] createRoom failed:', error.message)
      return null
    }
  }
  return null
}

/** Read-only lookup so the caller can show/charge the entry fee BEFORE
 * actually joining — joinRoomByCode() is the one that writes the join. */
export async function peekRoomByCode(code: string): Promise<RoomRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('status', 'waiting')
    .single()
  if (error || !data) return null
  const { count } = await supabase
    .from('room_players')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', data.id)
  if ((count ?? 0) >= data.max_players) return null
  return data
}

export async function joinRoomByCode(code: string, playerId: string): Promise<RoomRow | null> {
  if (!supabase) return null
  const room = await peekRoomByCode(code)
  if (!room) {
    console.error('[rooms] joinRoomByCode: room not found, full, or not joinable')
    return null
  }
  const { error: joinErr } = await supabase.from('room_players').insert({ room_id: room.id, player_id: playerId })
  if (joinErr && joinErr.code !== '23505') { // 23505 = already joined, harmless
    console.error('[rooms] joinRoomByCode: insert failed:', joinErr.message)
    return null
  }
  return room
}

export async function listOpenRooms(gameId?: string): Promise<OpenRoom[]> {
  if (!supabase) return []
  let query = supabase
    .from('rooms')
    .select('*, room_players(count)')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(20)
  if (gameId) query = query.contains('game_ids', [gameId])
  const { data, error } = await query
  if (error) {
    console.error('[rooms] listOpenRooms failed:', error.message)
    return []
  }
  return (data as unknown as (RoomRow & { room_players: { count: number }[] })[]).map(r => ({
    ...r,
    playerCount: r.room_players?.[0]?.count ?? 0,
  }))
}

export async function quickMatch(gameId: string, playerId: string): Promise<RoomRow | null> {
  const open = await listOpenRooms(gameId)
  const joinable = open.find(r => r.playerCount < r.max_players)
  if (joinable) return joinRoomByCode(joinable.code, playerId)
  return createRoom([gameId], 4, 10, playerId)
}

export async function fetchRoomPlayers(roomId: string): Promise<RoomPlayerWithProfile[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('room_players')
    .select('*, players(display_name, avatar)')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })
  if (error) {
    console.error('[rooms] fetchRoomPlayers failed:', error.message)
    return []
  }
  return (data as unknown as (RoomPlayerRow & { players: { display_name: string; avatar: string } | null })[]).map(r => ({
    ...r,
    displayName: r.players?.display_name ?? 'Player',
    avatar: r.players?.avatar ?? '🎮',
  }))
}

export async function fetchRoom(roomId: string): Promise<RoomRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single()
  if (error) return null
  return data
}

export async function fetchCurrentRound(roomId: string, roundNumber: number): Promise<RoomRoundRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('room_rounds')
    .select('*')
    .eq('room_id', roomId)
    .eq('round_number', roundNumber)
    .maybeSingle()
  if (error) return null
  return data
}

/** Sum of every round's score per player, ranked descending. */
export async function fetchStandings(roomId: string): Promise<StandingsEntry[]> {
  if (!supabase) return []
  const [{ data: scores, error }, players] = await Promise.all([
    supabase.from('room_round_scores').select('player_id, round_number, score').eq('room_id', roomId),
    fetchRoomPlayers(roomId),
  ])
  if (error || !scores) return []
  const byPlayer = new Map<string, StandingsEntry>()
  for (const p of players) {
    byPlayer.set(p.player_id, { playerId: p.player_id, displayName: p.displayName, avatar: p.avatar, total: 0, roundScores: {} })
  }
  for (const s of scores) {
    const entry = byPlayer.get(s.player_id)
    if (!entry) continue
    entry.roundScores[s.round_number] = s.score
    entry.total += s.score
  }
  return [...byPlayer.values()].sort((a, b) => b.total - a.total)
}

export async function startRoom(roomId: string): Promise<RoomRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('start_room', { p_room_id: roomId })
  if (error) { console.error('[rooms] startRoom failed:', error.message); return null }
  return data
}

/** Submits this round's score. The RPC itself advances to the next round or
 * finalizes the room (computing standings + queueing prize payouts) once
 * every current player has submitted for the round. */
export async function submitRoundScore(roomId: string, roundNumber: number, score: number): Promise<RoomRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('submit_round_score', { p_room_id: roomId, p_round_number: roundNumber, p_score: score })
  if (error) { console.error('[rooms] submitRoundScore failed:', error.message); return null }
  return data
}

export function subscribeRoom(roomId: string, onChange: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_round_scores', filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe()
  return () => { supabase!.removeChannel(channel) }
}
