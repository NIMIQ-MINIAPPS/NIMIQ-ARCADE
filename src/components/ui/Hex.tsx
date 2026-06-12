// Nimiq hexagon design system — all hex decoratives live here

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
  fill = 'var(--gold-bg)',
  stroke = 'var(--gold)',
  strokeWidth = 1.5,
  children,
  className,
}: HexBadgeProps) {
  const r = size / 2
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${r + r * 0.9 * Math.cos(a)},${r + r * 0.9 * Math.sin(a)}`
  }).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {children}
    </svg>
  )
}

// Nimiq wordmark + hex logo
export function NimLogo({ size = 32 }: { size?: number }) {
  const r = size / 2
  const outer = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${r + r * 0.9 * Math.cos(a)},${r + r * 0.9 * Math.sin(a)}`
  }).join(' ')
  const inner = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${r + r * 0.52 * Math.cos(a)},${r + r * 0.52 * Math.sin(a)}`
  }).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={outer} fill="var(--gold-bg)"  stroke="var(--gold)" strokeWidth="1.8" />
      <polygon points={inner} fill="var(--gold)" />
    </svg>
  )
}

// Large decorative floating hexagon
export function DecorHex({
  size,
  x,
  y,
  opacity = 1,
  fill = 'none',
  stroke = 'var(--gold)',
  strokeWidth = 1,
  rotate = 0,
}: {
  size: number; x: number; y: number
  opacity?: number; fill?: string; stroke?: string
  strokeWidth?: number; rotate?: number
}) {
  const r = size / 2
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + (rotate * Math.PI) / 180
    return `${r + r * Math.cos(a)},${r + r * Math.sin(a)}`
  }).join(' ')
  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none' }}
    >
      <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    </svg>
  )
}

// Full-page hex grid (SVG background pattern as inline SVG for crisp rendering)
export function HexGrid({
  color = 'var(--nim-dark)',
  opacity = 0.055,
  size = 52,
}: {
  color?: string; opacity?: number; size?: number
}) {
  const W = size * Math.sqrt(3)
  const H = size * 1.5
  const cols = Math.ceil(440 / W) + 2
  const rows = Math.ceil(900 / H) + 2

  const hexes: { cx: number; cy: number }[] = []
  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      hexes.push({
        cx: col * W + (row % 2 === 0 ? 0 : W / 2),
        cy: row * H,
      })
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
          return `${cx + size * 0.88 * Math.cos(a)},${cy + size * 0.88 * Math.sin(a)}`
        }).join(' ')
        return (
          <polygon key={i} points={pts} fill="none" stroke={color} strokeWidth="0.9" />
        )
      })}
    </svg>
  )
}

// Animated pulse hex — used for active/live states
export function PulseHex({ size = 48 }: { size?: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <HexBadge size={size} fill="var(--gold-bg)" stroke="var(--gold)" strokeWidth={2} />
      <div
        className="absolute inset-0 animate-ping"
        style={{ opacity: 0.4 }}
      >
        <HexBadge size={size} fill="none" stroke="var(--gold)" strokeWidth={1} />
      </div>
    </div>
  )
}
