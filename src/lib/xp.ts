const DAILY_XP_LIMIT = 50000
// 1000 XP = 0.02 NIM. Sized so even a player hitting the 50,000/day XP cap
// every single day converts at most ~1 NIM/day — the payout wallet's whole
// balance would take years to meaningfully dent even in that worst case.
// Must match the hardcoded rate in supabase/002_functions.sql's
// request_xp_conversion (computed server-side on purpose — never trust a
// client-supplied NIM amount for something that spends real money).
const XP_TO_NIM_RATE = 0.02 / 1000

export function xpToNim(xp: number): number {
  return xp * XP_TO_NIM_RATE
}

export function nimToXp(nim: number): number {
  return nim / XP_TO_NIM_RATE
}

export function calculateDailyXpReward(earnedToday: number, newXp: number): number {
  if (earnedToday >= DAILY_XP_LIMIT) return 0

  let effective = newXp
  const remaining = DAILY_XP_LIMIT - earnedToday

  if (effective > remaining) effective = remaining

  // Progressive reduction
  const firstTier = 5000
  const secondTier = 5000

  let reward = 0
  let xpLeft = Math.min(effective, remaining)

  if (earnedToday < firstTier) {
    const inTier = Math.min(xpLeft, firstTier - earnedToday)
    reward += inTier * 1.0
    xpLeft -= inTier
  }
  if (xpLeft > 0 && earnedToday < firstTier + secondTier) {
    const inTier = Math.min(xpLeft, secondTier)
    reward += inTier * 0.7
    xpLeft -= inTier
  }
  if (xpLeft > 0) {
    reward += xpLeft * 0.4
  }

  return Math.floor(reward)
}

export function getLevelFromXp(xp: number): number {
  if (xp < 100) return 1
  if (xp < 500) return Math.floor(xp / 100) + 1
  if (xp < 5000) return Math.floor(xp / 500) + 5
  if (xp < 100000) return Math.floor(xp / 5000) + 15
  return Math.floor(xp / 100000) + 35
}

export function getXpForNextLevel(level: number): number {
  if (level < 5) return level * 100
  if (level < 15) return (level - 4) * 500
  if (level < 35) return (level - 14) * 5000
  return (level - 34) * 100000
}

export function getXpProgress(xp: number): { level: number; progress: number; xpForNext: number } {
  const level = getLevelFromXp(xp)
  const xpForNext = getXpForNextLevel(level)
  const xpForCurrent = getXpForNextLevel(level - 1)
  const progress = Math.min(100, ((xp - xpForCurrent) / (xpForNext - xpForCurrent)) * 100)
  return { level, progress, xpForNext }
}
