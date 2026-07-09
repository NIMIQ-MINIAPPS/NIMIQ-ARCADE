// Nimiq Pay Mini App SDK integration.
//
// Real SDK verified by installing @nimiq/mini-app-sdk@0.1.0 and reading its
// shipped .d.ts (node_modules/@nimiq/mini-app-sdk/dist/{index,provider}.d.ts) —
// its actual surface differs from what earlier docs/specs assumed:
//   - `nimiq.listAccounts()` resolves to `string[]` (addresses only, no balance).
//   - There is no `requestPayment()`. Payments are `NimiqProvider#sendBasicTransaction
//     ({ recipient, value, fee?, validityStartHeight? })`, where `value` is in
//     Lunas (1 NIM = 1e5 Lunas), not decimal NIM. It resolves to the tx hash.
//   - `requestDeviceIdentifier` is a top-level SDK export (not a provider method)
//     and requires `{ reason: string }` shown to the user in a consent prompt.
//   - `init(options?: { timeout?: number })` resolves once Nimiq Pay injects
//     `window.nimiq`; it never resolves outside Nimiq Pay, so callers must not
//     await it unconditionally — detect the host first (see `isRunningInNimiqPay`).
//
// KNOWN GAP: no documented method for fetching a NIM balance was found in this
// package's types, nimiq.dev's Mini Apps page, or the Hub API references linked
// from it. `listAccounts()` in this module intentionally returns `balance: 0`
// for real (non-mock) accounts until that's confirmed — do not fake a number
// here, callers should treat 0 as "unknown" rather than "empty wallet".

import { init, requestDeviceIdentifier as sdkRequestDeviceIdentifier } from '@nimiq/mini-app-sdk'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'

const LUNAS_PER_NIM = 1e5

export interface NimiqAccount {
  address: string
  balance: number
  label?: string
}

export interface NimiqSDK {
  listAccounts: () => Promise<NimiqAccount[]>
  requestPayment: (params: PaymentRequest) => Promise<PaymentResult>
  requestDeviceIdentifier: () => Promise<string>
}

export interface PaymentRequest {
  recipient: string
  amount: number // in NIM
  message?: string
}

export interface PaymentResult {
  success: boolean
  txHash?: string
  error?: string
}

/** True once we've detected the Mini App is actually running inside Nimiq Pay. */
export function isRunningInNimiqPay(): boolean {
  return typeof window !== 'undefined' && !!window.nimiq
}

// ── Mock SDK — used only when NOT running inside Nimiq Pay (local dev / preview) ──
class MockNimiqSDK implements NimiqSDK {
  async listAccounts(): Promise<NimiqAccount[]> {
    return [
      {
        address: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
        balance: 42.5,
        label: 'My Wallet',
      },
    ]
  }

  async requestPayment(params: PaymentRequest): Promise<PaymentResult> {
    console.log('[Nimiq mock] Payment requested:', params)
    await new Promise(r => setTimeout(r, 1000))
    return { success: true, txHash: '0x' + Math.random().toString(16).slice(2) }
  }

  async requestDeviceIdentifier(): Promise<string> {
    return 'device_' + Math.random().toString(36).slice(2)
  }
}

// ── Real SDK adapter — wraps NimiqProvider to match our NimiqSDK interface ──
class RealNimiqSDK implements NimiqSDK {
  private provider: NimiqProvider
  constructor(provider: NimiqProvider) {
    this.provider = provider
  }

  async listAccounts(): Promise<NimiqAccount[]> {
    const result = await this.provider.listAccounts()
    if (!Array.isArray(result)) {
      console.error('[Nimiq] listAccounts failed:', result.error)
      return []
    }
    // balance intentionally 0/unknown — see KNOWN GAP note above.
    return result.map(address => ({ address, balance: 0 }))
  }

  async requestPayment({ recipient, amount }: PaymentRequest): Promise<PaymentResult> {
    const value = Math.round(amount * LUNAS_PER_NIM)
    const result = await this.provider.sendBasicTransaction({ recipient, value })
    if (typeof result === 'string') return { success: true, txHash: result }
    return { success: false, error: result.error.message }
  }

  async requestDeviceIdentifier(): Promise<string> {
    return sdkRequestDeviceIdentifier({ reason: 'Identify your device for leaderboards and match history' })
  }
}

let sdk: NimiqSDK | null = null
let usingMock = false

export function isUsingMockSdk(): boolean {
  return usingMock
}

export async function initNimiq(): Promise<NimiqSDK> {
  if (sdk) return sdk

  if (isRunningInNimiqPay()) {
    try {
      const provider = await init({ timeout: 8000 })
      sdk = new RealNimiqSDK(provider)
      usingMock = false
      return sdk
    } catch (err) {
      console.error('[Nimiq] init() failed even though window.nimiq was present, falling back to mock:', err)
    }
  }

  usingMock = true
  sdk = new MockNimiqSDK()
  return sdk
}

export function getNimiqSDK(): NimiqSDK | null {
  return sdk
}

export function formatAddress(address: string): string {
  if (address.length < 12) return address
  return address.slice(0, 9) + '…' + address.slice(-6)
}

export function formatNim(amount: number): string {
  return amount.toFixed(3) + ' NIM'
}
