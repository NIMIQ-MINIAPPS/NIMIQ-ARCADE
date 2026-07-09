// Tiny feature-detected haptics wrapper — shared by all games
export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {/* unsupported */}
}
