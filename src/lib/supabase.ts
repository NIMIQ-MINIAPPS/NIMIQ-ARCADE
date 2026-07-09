// Supabase client — browser-safe. Only the anon/publishable key ever lives here;
// it's meant to be public (RLS policies in supabase/schema.sql are what actually
// protect the data, not secrecy of this key). Never import the service_role /
// secret key into any file under src/ — that key belongs server-side only
// (Supabase Edge Functions secrets), never in the client bundle.

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = !!url && !!anonKey

if (!supabaseConfigured) {
  console.warn('[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — online features disabled. See .env.example.')
}

export const supabase = supabaseConfigured
  ? createClient<Database>(url!, anonKey!)
  : null
