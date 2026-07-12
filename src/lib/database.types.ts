// Hand-written to match supabase/schema.sql + supabase/002_functions.sql exactly.
// Once the Supabase CLI is linked to the project
// (`supabase login && supabase link`), regenerate with
// `supabase gen types typescript --linked > src/lib/database.types.ts` and this
// file becomes disposable — until then, keep it in sync by hand.
//
// `Relationships: []` on every table and the empty `Views` are required to
// satisfy supabase-js's `GenericSchema` constraint (checked against the
// installed @supabase/supabase-js version's .d.ts) — not decorative.

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
          total_xp_earned: number
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
          total_xp_earned?: number
        }
        Update: Partial<Database['public']['Tables']['players']['Insert']>
        Relationships: []
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
        Relationships: []
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
          rounds: number
          current_round: number
          game_ids: string[]
          round_duration_s: number
        }
        Insert: {
          id?: string
          code: string
          game_id: string
          host_id: string
          max_players?: number
          entry_fee_nim?: number
          status?: 'waiting' | 'playing' | 'finished'
          rounds?: number
          game_ids: string[]
          round_duration_s?: number
        }
        Update: Partial<Database['public']['Tables']['rooms']['Insert']>
        Relationships: []
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
        Relationships: []
      }
      room_rounds: {
        Row: {
          room_id: string
          round_number: number
          game_id: string
          started_at: string
          ends_at: string
        }
        Insert: {
          room_id: string
          round_number: number
          game_id: string
          ends_at: string
        }
        Update: Partial<Database['public']['Tables']['room_rounds']['Insert']>
        Relationships: []
      }
      room_round_scores: {
        Row: {
          room_id: string
          round_number: number
          player_id: string
          score: number
          submitted_at: string
        }
        Insert: {
          room_id: string
          round_number: number
          player_id: string
          score?: number
        }
        Update: Partial<Database['public']['Tables']['room_round_scores']['Insert']>
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      payouts: {
        Row: {
          id: string
          player_id: string
          amount_nim: number
          reason: string
          tx_hash: string | null
          status: 'pending' | 'processing' | 'sent' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          amount_nim: number
          reason: string
          tx_hash?: string | null
          status?: 'pending' | 'processing' | 'sent' | 'failed'
        }
        Update: Partial<Database['public']['Tables']['payouts']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      merge_player_progress: {
        Args: {
          p_xp: number
          p_level: number
          p_wins: number
          p_losses: number
          p_games_played: number
          p_daily_xp_earned: number
          p_last_active_date: string
          p_display_name: string
          p_avatar: string
          p_nimiq_address: string | null
          p_device_identifier: string | null
          p_total_xp_earned?: number
        }
        Returns: Database['public']['Tables']['players']['Row']
      }
      upsert_high_score: {
        Args: { p_game_id: string; p_score: number }
        Returns: Database['public']['Tables']['high_scores']['Row']
      }
      request_xp_conversion: {
        Args: { p_xp_amount: number }
        Returns: Database['public']['Tables']['payouts']['Row']
      }
      start_room: {
        Args: { p_room_id: string }
        Returns: Database['public']['Tables']['rooms']['Row']
      }
      submit_round_score: {
        Args: { p_room_id: string; p_round_number: number; p_score: number }
        Returns: Database['public']['Tables']['rooms']['Row']
      }
    }
  }
}
