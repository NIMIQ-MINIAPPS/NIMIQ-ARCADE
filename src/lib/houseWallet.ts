// The address entry fees (rooms + tournaments) get paid to. Public info by
// design — receiving funds needs only an address, never a private key, so
// this is safe to ship in the client bundle. Paying OUT prizes is a
// completely separate concern (see supabase/functions/process-payouts) that
// needs a private key that must never live here.

import { getNimiqSDK } from './nimiq'

export const HOUSE_WALLET_ADDRESS = import.meta.env.VITE_HOUSE_WALLET_ADDRESS as string | undefined

export type FeeResult = { ok: true; txHash?: string } | { ok: false; error: string }

/** No-ops (and succeeds) for a 0 fee — callers don't need to special-case free entry. */
export async function collectEntryFee(amountNim: number, message: string): Promise<FeeResult> {
  if (amountNim <= 0) return { ok: true }
  if (!HOUSE_WALLET_ADDRESS) return { ok: false, error: 'Entry fees are not configured yet.' }
  const sdk = getNimiqSDK()
  if (!sdk) return { ok: false, error: 'Wallet not ready — try again in a moment.' }
  const res = await sdk.requestPayment({ recipient: HOUSE_WALLET_ADDRESS, amount: amountNim, message })
  if (!res.success) return { ok: false, error: res.error ?? 'Payment failed' }
  return { ok: true, txHash: res.txHash }
}
