// Supabase Edge Function — wallet-signature login for the standalone metrics
// dapp (separate repo, not the arcade app). Verifies a Nimiq Keyguard
// signMessage() signature and, if it checks out, marks the CALLER'S OWN
// already-authenticated (anonymous) Supabase session as an admin by
// inserting its uid into public.admin_players. See
// supabase/012_admin_metrics.sql and supabase/013_admin_wallet_login.sql.
//
// WHY THIS HAS TO BE AN EDGE FUNCTION AND NOT CLIENT CODE: admin_players and
// admin_wallet_keys have zero RLS policies (see those migrations) — nothing
// a browser can read or write directly. Only this function, running with
// the service_role key, can promote a session to admin. That's the actual
// security boundary; the signature check below is what gates *who* this
// function will do that for.
//
// SIGNATURE ALGORITHM — verified against the real Nimiq Keyguard source
// (github.com/nimiq/keyguard, src/lib/Key.js `signMessage()` +
// client/src/SignMessagePrefix.ts), not just docs:
//   data = utf8(MSG_PREFIX) + utf8(String(messageBytes.byteLength)) + messageBytes
//   hash = SHA256(data)
//   signature = Ed25519.sign(hash, privateKey)   // Nimiq.Signature.create()
// So verification is plain Ed25519.verify(signature, hash, publicKey) — no
// Nimiq-specific crypto needed beyond reproducing that SHA256 pre-hash.
// MSG_PREFIX = '\x16Nimiq Signed Message:\n' (HubApi.MSG_PREFIX, 23 bytes).
//
// DELIBERATELY NOT verifying a Nimiq address at all: deriving an address
// from a public key requires reimplementing Nimiq's Blake2b + base32 +
// checksum encoding, which is easy to get subtly wrong. Instead
// admin_wallet_keys stores the raw Ed25519 public key straight from the
// Keyguard's response — no derivation, nothing to get wrong.
//
// BOOTSTRAP: while admin_wallet_keys is empty, the first wallet to sign a
// valid, fresh, session-bound challenge becomes the permanent admin key. Do
// your own first login immediately after deploying this function, before
// the dapp's URL is shared anywhere — see 013_admin_wallet_login.sql.
//
// DEPLOY:
//   supabase functions deploy verify-admin-wallet

import { createClient } from 'npm:@supabase/supabase-js@2'
import * as ed from 'npm:@noble/ed25519@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const MSG_PREFIX = '\x16Nimiq Signed Message:\n'
const CHALLENGE_HEADER = 'Nimiq Arcade Metrics — Admin Login'
const MAX_CHALLENGE_AGE_MS = 5 * 60 * 1000 // 5 minutes
const MAX_CLOCK_SKEW_MS = 30 * 1000 // tolerate the client's clock running slightly ahead

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrs) { out.set(a, offset); offset += a.length }
  return out
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(digest)
}

/** Reproduces exactly what the Nimiq Keyguard hashes before Ed25519-signing a message. */
async function nimiqMessageHash(message: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const messageBytes = enc.encode(message)
  const prefixBytes = enc.encode(MSG_PREFIX)
  const lengthBytes = enc.encode(String(messageBytes.byteLength))
  return sha256(concatBytes(prefixBytes, lengthBytes, messageBytes))
}

/** Parses "session:<uid>" and "issued:<iso>" lines out of the challenge and checks freshness + binding. */
function parseAndValidateChallenge(message: string, callerUid: string): { ok: true } | { ok: false; error: string } {
  const lines = message.split('\n')
  if (lines[0] !== CHALLENGE_HEADER) return { ok: false, error: 'unrecognized challenge format' }

  const sessionLine = lines.find(l => l.startsWith('session:'))
  const issuedLine = lines.find(l => l.startsWith('issued:'))
  if (!sessionLine || !issuedLine) return { ok: false, error: 'challenge missing session/issued fields' }

  const session = sessionLine.slice('session:'.length)
  if (session !== callerUid) return { ok: false, error: 'challenge was not issued for this session' }

  const issuedAt = new Date(issuedLine.slice('issued:'.length)).getTime()
  if (Number.isNaN(issuedAt)) return { ok: false, error: 'challenge has an invalid timestamp' }

  const age = Date.now() - issuedAt
  if (age > MAX_CHALLENGE_AGE_MS || age < -MAX_CLOCK_SKEW_MS) return { ok: false, error: 'challenge expired — try connecting again' }

  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ ok: false, error: 'missing Authorization header' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

  // Resolves the CALLER's own verified uid from their JWT — this is never
  // taken from the request body, so a caller can only ever authenticate
  // their own already-established session, never someone else's.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: userError } = await callerClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid session' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  let body: { message?: string; signature?: string; signerPublicKey?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  const { message, signature, signerPublicKey } = body
  if (!message || !signature || !signerPublicKey) {
    return new Response(JSON.stringify({ ok: false, error: 'message, signature and signerPublicKey are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const challengeCheck = parseAndValidateChallenge(message, user.id)
  if (!challengeCheck.ok) {
    return new Response(JSON.stringify({ ok: false, error: challengeCheck.error }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  let signatureBytes: Uint8Array, publicKeyBytes: Uint8Array
  try {
    signatureBytes = base64ToBytes(signature)
    publicKeyBytes = base64ToBytes(signerPublicKey)
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'signature/publicKey must be base64' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const hash = await nimiqMessageHash(message)
  const validSignature = await ed.verifyAsync(signatureBytes, hash, publicKeyBytes)
  if (!validSignature) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid signature' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { count, error: countError } = await admin
    .from('admin_wallet_keys')
    .select('public_key', { count: 'exact', head: true })
  if (countError) {
    return new Response(JSON.stringify({ ok: false, error: 'server error checking admin keys' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const publicKeyHex = Array.from(publicKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  let bootstrapped = false

  if (count === 0) {
    // First-ever successful login becomes the permanent admin key.
    const { error: insertKeyError } = await admin
      .from('admin_wallet_keys')
      .insert({ public_key: `\\x${publicKeyHex}`, label: 'bootstrap' })
    if (insertKeyError) {
      return new Response(JSON.stringify({ ok: false, error: 'failed to bootstrap admin key' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
    bootstrapped = true
  } else {
    const { data: match } = await admin
      .from('admin_wallet_keys')
      .select('public_key')
      .eq('public_key', `\\x${publicKeyHex}`)
      .maybeSingle()
    if (!match) {
      return new Response(JSON.stringify({ ok: false, error: 'this wallet is not an admin' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }
  }

  const { error: grantError } = await admin
    .from('admin_players')
    .upsert({ player_id: user.id }, { onConflict: 'player_id' })
  if (grantError) {
    return new Response(JSON.stringify({ ok: false, error: 'failed to grant admin session' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true, bootstrapped }), { headers: { 'Content-Type': 'application/json' } })
})
