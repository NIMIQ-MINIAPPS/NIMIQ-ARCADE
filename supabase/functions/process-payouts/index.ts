// Supabase Edge Function — sends real NIM for every `pending` row in `payouts`.
//
// WHY THIS EXISTS AS AN EDGE FUNCTION AND NOT CLIENT CODE: `payouts` has no
// insert/update RLS policy for regular clients (see supabase/schema.sql) —
// rows only ever get created as 'pending' by security-definer RPCs
// (request_xp_conversion, submit_round_score's finalize branch). Turning
// 'pending' into 'sent' requires signing with a real private key, which must
// never be reachable from the browser bundle. This function is the only
// thing that ever touches that key.
//
// STATUS: written, NOT deployed, NOT tested against a real network — there
// is no funded wallet yet (see AGENTS.md). The Supabase read/write side is
// straightforward and should work as-is. The Nimiq signing/broadcasting side
// uses real, verified APIs from the installed @nimiq/core package (see the
// comment above `signAndBroadcast` for exactly what was checked and what
// wasn't), but has never run against a live node — treat the RPC method name
// and network ID as needing a final check against current Nimiq RPC docs
// before the first real run, not as guaranteed-correct.
//
// DEPLOY (once a payout wallet exists):
//   supabase secrets set NIMIQ_PAYOUT_MNEMONIC="word1 word2 ... word24"
//   supabase secrets set NIMIQ_RPC_URL=<your Nimiq JSON-RPC node URL>
//   supabase secrets set NIMIQ_NETWORK_ID=<network id — verify against Nimiq docs>
//   supabase functions deploy process-payouts
// VERIFY FIRST (does not send anything, safe to run immediately after deploy):
//   curl https://<project>.functions.supabase.co/process-payouts \
//     -H "Authorization: Bearer <anon or service key>"
//   → { "derivedAddress": "NQ..." } — confirm this matches the wallet you
//   expect BEFORE ever sending a POST to this function.
// RUN (manually, or wire to a cron via `supabase functions schedule` / pg_cron):
//   curl -X POST https://<project>.functions.supabase.co/process-payouts \
//     -H "Authorization: Bearer <anon or service key>"
//
// WHY A MNEMONIC AND NOT A RAW PRIVATE KEY: standard Nimiq wallets (Nimiq
// Wallet, Nimiq Pay) deliberately don't expose a raw hex private key in their
// UI — what a user actually has access to is either a 24-word recovery
// phrase or an encrypted Login File + PIN. The recovery phrase is the
// realistic thing to ask for, so this function derives the actual signing
// key from it at runtime instead of expecting a hex string nobody can
// produce. Alternatively set NIMIQ_PAYOUT_PRIVATE_KEY_HEX directly if a raw
// key is ever available (e.g. a wallet generated specifically for this via
// @nimiq/core's own PrivateKey.generate()) — that path is also supported
// below and skips derivation entirely.

import { createClient } from 'npm:@supabase/supabase-js@2'
// @nimiq/core is a WASM package built for browsers; `npm:` specifiers in Deno
// pull the same npm package but its WASM init may need the explicit
// `/web` or bundler entry point depending on how Deno resolves it — verify
// this import resolves cleanly on first `supabase functions deploy` (Deno's
// npm compat layer is generally solid for this, but WASM-heavy packages are
// exactly the category most likely to need adjustment).
import { PrivateKey, KeyPair, Address, TransactionBuilder, MnemonicUtils } from 'npm:@nimiq/core@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PAYOUT_MNEMONIC = Deno.env.get('NIMIQ_PAYOUT_MNEMONIC')
const PAYOUT_PRIVATE_KEY_HEX = Deno.env.get('NIMIQ_PAYOUT_PRIVATE_KEY_HEX')
const RPC_URL = Deno.env.get('NIMIQ_RPC_URL')
const NETWORK_ID = Number(Deno.env.get('NIMIQ_NETWORK_ID') ?? '0')

// Nimiq's standard BIP44 derivation path — coin type 242 is Nimiq's
// registered SLIP-44 index, account/address index 0 matches the first
// (default) account a wallet shows. Verified against @nimiq/core's
// ExtendedPrivateKey/Entropy/MnemonicUtils API surface (all confirmed to
// exist with this shape in node_modules/@nimiq/core/lib/index.d.ts) — the
// path string itself matches Nimiq Keyguard's well-known convention, but
// wasn't independently re-derived against a real wallet in this session, so
// double check the resulting address matches the expected NQ… address the
// FIRST time this runs, before trusting it with real payouts.
const NIMIQ_DERIVATION_PATH = "m/44'/242'/0'/0'"

/** Derives the actual signing PrivateKey from either a 24-word mnemonic or a raw hex key. */
function resolvePayoutKeyPair(): KeyPair {
  if (PAYOUT_PRIVATE_KEY_HEX) {
    return KeyPair.derive(PrivateKey.fromHex(PAYOUT_PRIVATE_KEY_HEX))
  }
  if (PAYOUT_MNEMONIC) {
    const entropy = MnemonicUtils.mnemonicToEntropy(PAYOUT_MNEMONIC.trim())
    const extended = entropy.toExtendedPrivateKey().derivePath(NIMIQ_DERIVATION_PATH)
    return KeyPair.derive(extended.privateKey)
  }
  throw new Error('Neither NIMIQ_PAYOUT_MNEMONIC nor NIMIQ_PAYOUT_PRIVATE_KEY_HEX is configured')
}

const LUNAS_PER_NIM = 1e5
const MAX_PER_RUN = 20 // keep each invocation short and bounded

interface PendingPayout {
  id: string
  player_id: string
  amount_nim: number
}

/**
 * Signs a basic NIM transfer with @nimiq/core (pure WASM crypto — no network
 * needed, confirmed against node_modules/@nimiq/core/types/wasm/web.d.ts:
 * PrivateKey.fromHex, KeyPair.derive, Address.fromUserFriendlyAddress,
 * TransactionBuilder.newBasic(sender, recipient, value, fee, validityStartHeight, networkId)
 * all exist with exactly this shape), then broadcasts it via a plain
 * JSON-RPC POST to `rpcUrl`.
 *
 * UNVERIFIED: the JSON-RPC method name (`sendRawTransaction` is the
 * conventional name across most chains' RPC specs and is used here as the
 * best-available guess, not a confirmed Nimiq method — cross-check against
 * https://nimiq.dev or the node's own `rpc_methods` listing before relying
 * on this) and the numeric `networkId` for Nimiq's Albatross mainnet/testnet
 * (left as a required env var instead of a hardcoded guess for that reason).
 * `validityStartHeight` also needs the current block height — fetched below
 * via a `getBlockNumber` RPC call, same caveat on the exact method name.
 */
async function signAndBroadcast(recipientAddress: string, amountNim: number): Promise<string> {
  if (!RPC_URL) throw new Error('NIMIQ_RPC_URL not configured')
  if (!NETWORK_ID) throw new Error('NIMIQ_NETWORK_ID not configured')

  const rpcCall = async <T,>(method: string, params: unknown[] = []): Promise<T> => {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
    })
    const json = await res.json()
    if (json.error) throw new Error(`RPC ${method} failed: ${JSON.stringify(json.error)}`)
    return json.result
  }

  const keyPair = resolvePayoutKeyPair()
  const sender = keyPair.toAddress()
  const recipient = Address.fromUserFriendlyAddress(recipientAddress)
  const valueLunas = BigInt(Math.round(amountNim * LUNAS_PER_NIM))

  const blockNumber = await rpcCall<number>('getBlockNumber')

  const tx = TransactionBuilder.newBasic(sender, recipient, valueLunas, undefined, blockNumber, NETWORK_ID)
  keyPair.signTransaction(tx)

  const rawHex = Array.from(tx.serialize()).map(b => b.toString(16).padStart(2, '0')).join('')
  const txHash = await rpcCall<string>('sendRawTransaction', [rawHex])
  return txHash
}

Deno.serve(async (req) => {
  // GET = safe dry-run: derive the signing key and report its address WITHOUT
  // sending anything. Use this first — call it, confirm the returned address
  // matches the wallet you expect, before ever hitting this with a POST.
  if (req.method === 'GET') {
    try {
      const address = resolvePayoutKeyPair().toAddress().toUserFriendlyAddress()
      return new Response(JSON.stringify({ derivedAddress: address }), { headers: { 'Content-Type': 'application/json' } })
    } catch (err) {
      return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: pending, error } = await supabase
    .from('payouts')
    .select('id, player_id, amount_nim')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { headers: { 'Content-Type': 'application/json' } })
  }

  const results: { id: string; status: 'sent' | 'failed'; detail: string }[] = []

  for (const payout of pending as PendingPayout[]) {
    // Optimistic lock: only proceed if this row is still 'pending' at the
    // moment we claim it — guards against two overlapping invocations
    // double-sending the same payout.
    const { data: claimed } = await supabase
      .from('payouts')
      .update({ status: 'processing' })
      .eq('id', payout.id)
      .eq('status', 'pending')
      .select()
      .maybeSingle()
    if (!claimed) continue // someone else already claimed it

    const { data: player } = await supabase
      .from('players')
      .select('nimiq_address')
      .eq('id', payout.player_id)
      .single()

    if (!player?.nimiq_address) {
      await supabase.from('payouts').update({ status: 'failed' }).eq('id', payout.id)
      results.push({ id: payout.id, status: 'failed', detail: 'player has no nimiq_address on file' })
      continue
    }

    try {
      const txHash = await signAndBroadcast(player.nimiq_address, payout.amount_nim)
      await supabase.from('payouts').update({ status: 'sent', tx_hash: txHash }).eq('id', payout.id)
      results.push({ id: payout.id, status: 'sent', detail: txHash })
    } catch (err) {
      await supabase.from('payouts').update({ status: 'failed' }).eq('id', payout.id)
      results.push({ id: payout.id, status: 'failed', detail: err instanceof Error ? err.message : String(err) })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), { headers: { 'Content-Type': 'application/json' } })
})
