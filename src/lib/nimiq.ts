// Nimiq Pay Mini App SDK integration
// In production: import { init } from '@nimiq/mini-app-sdk'

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

// Mock SDK for development — replace with real SDK in production
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
    console.log('[Nimiq] Payment requested:', params)
    await new Promise(r => setTimeout(r, 1000))
    return { success: true, txHash: '0x' + Math.random().toString(16).slice(2) }
  }

  async requestDeviceIdentifier(): Promise<string> {
    return 'device_' + Math.random().toString(36).slice(2)
  }
}

let sdk: NimiqSDK | null = null

export async function initNimiq(): Promise<NimiqSDK> {
  if (sdk) return sdk

  // In production: sdk = await init()
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
