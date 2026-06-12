// Hexagon shape + icon utilities – replaces all emoji usage

interface HexBadgeProps {
  size?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  children?: React.ReactNode
  className?: string
}

export function HexBadge({
  size = 40,
  fill = 'var(--gold-deep)',
  stroke = 'var(--gold)',
  strokeWidth = 1.5,
  children,
  className,
}: HexBadgeProps) {
  const r = size / 2
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${r + r * 0.92 * Math.cos(a)},${r + r * 0.92 * Math.sin(a)}`
  }).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {children}
    </svg>
  )
}

// Nim logo hex
export function NimLogo({ size = 32 }: { size?: number }) {
  const r = size / 2
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${r + r * 0.88 * Math.cos(a)},${r + r * 0.88 * Math.sin(a)}`
  }).join(' ')
  const inner = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${r + r * 0.52 * Math.cos(a)},${r + r * 0.52 * Math.sin(a)}`
  }).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={pts} fill="var(--gold-deep)" stroke="var(--gold)" strokeWidth="1.5" />
      <polygon points={inner} fill="var(--gold)" />
    </svg>
  )
}

// Decorative hex grid background
export function HexGrid({ opacity = 0.04 }: { opacity?: number }) {
  const hexes: { cx: number; cy: number }[] = []
  const R = 28, W = R * Math.sqrt(3), H = R * 1.5
  for (let row = -1; row < 10; row++) {
    for (let col = -1; col < 8; col++) {
      hexes.push({ cx: col * W + (row % 2 === 0 ? 0 : W / 2), cy: row * H })
    }
  }
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity }}
      preserveAspectRatio="xMidYMid slice"
    >
      {hexes.map(({ cx, cy }, i) => {
        const pts = Array.from({ length: 6 }, (_, j) => {
          const a = (Math.PI / 3) * j - Math.PI / 6
          return `${cx + R * 0.9 * Math.cos(a)},${cy + R * 0.9 * Math.sin(a)}`
        }).join(' ')
        return <polygon key={i} points={pts} fill="none" stroke="var(--gold)" strokeWidth="0.8" />
      })}
    </svg>
  )
}
