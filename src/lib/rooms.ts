// Async score-battle "Online" rooms. Players join a room, then go play the
// room's game normally through the Games tab — roomSync.ts (hooked the same
// way backendSync.ts hooks XP/high-score sync) watches for that game's score
// and submits it automatically. No game file needs to know rooms exist.

import { supabase, supabaseConfigured } from './supabase'
import type { Database } from './database.types'

export const roomsAvailable = supabaseConfigured

export type RoomRow = Database['public']['Tables']['rooms']['Row']
export type RoomPlayerRow = Database['public']['Tables']['room_players']['Row']

export interface OpenRoom extends RoomRow {
  playerCount: number
}

export interface RoomPlayerWithProfile extends RoomPlayerRow {
  displayName: string
  avatar: string
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L — avoids read-aloud ambiguity

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return code
}

export async function createRoom(gameId: string, maxPlayers: number, hostId: string): Promise<RoomRow | null> {
  if (!supabase) return null
  // Retry on the (rare) code collision — unique constraint will reject it.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code, game_id: gameId, host_id: hostId, max_players: maxPlayers })
      .select()
      .single()
    if (!error) {
      await supabase.from('room_players').insert({ room_id: data.id, player_id: hostId })
      return data
    }
    if (error.code !== '23505') { // not a unique-violation — some other real error, stop retrying
      console.error('[rooms] createRoom failed:', error.message)
      return null
    }
  }
  return null
}

export async function joinRoomByCode(code: string, playerId: string): Promise<RoomRow | null> {
  if (!supabase) return null
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('status', 'waiting')
    .single()
  if (error || !room) {
    console.error('[rooms] joinRoomByCode: room not found or not joinable:', error?.message)
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
  if (gameId) query = query.eq('game_id', gameId)
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
  return createRoom(gameId, 4, playerId)
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

export async function startRoom(roomId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId)
  if (error) console.error('[rooms] startRoom failed:', error.message)
}

export async function submitRoomScore(roomId: string, playerId: string, score: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('room_players')
    .update({ score, finished_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('player_id', playerId)
  if (error) console.error('[rooms] submitRoomScore failed:', error.message)

  // If everyone in the room has now finished, close it out.
  const players = await fetchRoomPlayers(roomId)
  if (players.length > 0 && players.every(p => p.finished_at)) {
    await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
  }
}

export function subscribeRoom(roomId: string, onChange: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, onChange)
    .subscribe()
  return () => { supabase!.removeChannel(channel) }
}
