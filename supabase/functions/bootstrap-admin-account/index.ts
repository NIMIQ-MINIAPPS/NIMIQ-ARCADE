// Supabase Edge Function — one-time creation of the metrics dapp's admin
// account. Replaces the earlier wallet-signature login (verify-admin-wallet):
// the admin's phone wallet and computer wallet are different addresses, so
// wallet-based login couldn't work across devices for one person. A normal
// email+password Supabase Auth account has no such problem — it logs in
// identically from any device.
//
// WHY AN EDGE FUNCTION AND NOT PLAIN supabase.auth.signUp(): signUp() would
// require email confirmation (a real inbox + working mail delivery from this
// project) before the account is usable — unnecessary friction for a single
// personal account. This function uses the Admin API (service_role) to
// create the user with email_confirm: true, so it's usable immediately.
//
// SAFE BY CONSTRUCTION, NOT BY OBSCURITY: only runs while public.admin_players
// is EMPTY — the very first successful call creates the one admin account
// and grants it; every call after that (regardless of email/password) is
// refused with 403. That means this endpoint is only exploitable in the
// narrow window between deploying it and you actually using it — do that
// immediately, same caveat as the wallet flow it replaces.
//
// DEPLOY:
//   supabase functions deploy bootstrap-admin-account

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  const email = body.email?.trim()
  const password = body.password
  if (!email || !password) {
    return new Response(JSON.stringify({ ok: false, error: 'email and password are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ ok: false, error: 'password must be at least 8 characters' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { count, error: countError } = await admin
    .from('admin_players')
    .select('player_id', { count: 'exact', head: true })
  if (countError) {
    return new Response(JSON.stringify({ ok: false, error: 'server error checking admin state' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
  if (count && count > 0) {
    return new Response(JSON.stringify({ ok: false, error: 'an admin account already exists' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (createError || !created?.user) {
    return new Response(JSON.stringify({ ok: false, error: createError?.message ?? 'failed to create account' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const { error: grantError } = await admin
    .from('admin_players')
    .upsert({ player_id: created.user.id }, { onConflict: 'player_id' })
  if (grantError) {
    return new Response(JSON.stringify({ ok: false, error: 'account created but failed to grant admin — contact support' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
