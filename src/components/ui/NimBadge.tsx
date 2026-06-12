interface NimBadgeProps {
  amount: number
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'text-[11px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
}

export default function NimBadge({ amount, size = 'md' }: NimBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full ${sizes[size]}`}
      style={{
        background: 'var(--gold-deep)',
        border: '1px solid var(--gold)',
        color: 'var(--gold-bright)',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10">
        <polygon
          points="5,0.5 9,2.5 9,7.5 5,9.5 1,7.5 1,2.5"
          fill="var(--gold)"
        />
      </svg>
      {amount.toFixed(3)} NIM
    </span>
  )
}
