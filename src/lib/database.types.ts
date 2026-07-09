// Hand-written to match supabase/schema.sql exactly. Once the Supabase CLI is
// linked to the project (`supabase login && supabase link`), regenerate with
// `supabase gen types typescript --linked > src/lib/database.types.ts` and this
// file becomes disposable — until then, keep it in sync with schema.sql by hand.

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string
          device_identifier: string | null
          nimiq_address: string | null
          display_name: string
          avatar: string
          xp: number
          level: number
          wins: number
          losses: number
          games_played: number
          daily_xp_earned: number
          last_active_date: string
          created_at: string
        }
        Insert: {
          id: string
          device_identifier?: string | null
          nimiq_address?: string | null
          display_name?: string
          avatar?: string
          xp?: number
          level?: number
          wins?: number
          losses?: number
          games_played?: number
          daily_xp_earned?: number
          last_active_date?: string
        }
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      high_scores: {
        Row: {
          player_id: string
          game_id: string
          score: number
          updated_at: string
        }
        Insert: {
          player_id: string
          game_id: string
          score: number
        }
        Update: Partial<Database['public']['Tables']['high_scores']['Insert']>
      }
      rooms: {
        Row: {
          id: string
          code: string
          game_id: string
          host_id: string
          max_players: number
          entry_fee_nim: number
          status: 'waiting' | 'playing' | 'finished'
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          game_id: string
          host_id: string
          max_players?: number
          entry_fee_nim?: number
          status?: 'waiting' | 'playing' | 'finished'
        }
        Update: Partial<Database['public']['Tables']['rooms']['Insert']>
      }
      room_players: {
        Row: {
          room_id: string
          player_id: string
          score: number | null
          finished_at: string | null
          joined_at: string
        }
        Insert: {
          room_id: string
          player_id: string
          score?: number | null
          finished_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['room_players']['Insert']>
      }
      tournaments: {
        Row: {
          id: string
          name: string
          game_id: string
          entry_fee_nim: number
          max_players: number | null
          prize_pool_nim: number
          starts_at: string
          ends_at: string
          status: 'upcoming' | 'active' | 'ended'
          type: 'daily' | 'weekly' | 'monthly'
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          game_id: string
          entry_fee_nim?: number
          max_players?: number | null
          prize_pool_nim?: number
          starts_at: string
          ends_at: string
          status?: 'upcoming' | 'active' | 'ended'
          type: 'daily' | 'weekly' | 'monthly'
        }
        Update: Partial<Database['public']['Tables']['tournaments']['Insert']>
      }
      tournament_entries: {
        Row: {
          tournament_id: string
          player_id: string
          best_score: number
          paid_tx_hash: string | null
          entered_at: string
        }
        Insert: {
          tournament_id: string
          player_id: string
          best_score?: number
          paid_tx_hash?: string | null
        }
        Update: Partial<Database['public']['Tables']['tournament_entries']['Insert']>
      }
      payouts: {
        Row: {
          id: string
          player_id: string
          amount_nim: number
          reason: string
          tx_hash: string | null
          status: 'pending' | 'sent' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          amount_nim: number
          reason: string
          tx_hash?: string | null
          status?: 'pending' | 'sent' | 'failed'
        }
        Update: Partial<Database['public']['Tables']['payouts']['Insert']>
      }
    }
  }
}
