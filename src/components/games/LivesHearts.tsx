import { Heart } from 'lucide-react'

/** Shared lives display for every game that tracks lives — replaces each
 * game's bespoke dot/number UI with a consistent row of hearts. */
export default function LivesHearts({
  lives,
  maxLives,
  size = 14,
  color = '#FF6B6B',
  emptyColor = 'rgba(255,255,255,0.15)',
}: {
  lives: number
  maxLives: number
  size?: number
  color?: string
  emptyColor?: string
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxLives }, (_, i) => (
        <Heart
          key={i}
          size={size}
          fill={i < lives ? color : emptyColor}
          stroke={i < lives ? color : emptyColor}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}
