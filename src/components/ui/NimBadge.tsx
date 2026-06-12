interface NimBadgeProps { amount: number; size?: 'sm' | 'md' | 'lg' }

const sizes = { sm: 'text-[11px] px-2 py-0.5', md: 'text-xs px-2.5 py-1', lg: 'text-sm px-3 py-1.5' }

export default function NimBadge({ amount, size = 'md' }: NimBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full ${sizes[size]}`}
      style={{ background: 'var(--gold-bg)', border: '1.5px solid var(--gold)', color: 'var(--gold-dark)' }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10">
        <polygon points="5,0.5 9.3,2.75 9.3,7.25 5,9.5 0.7,7.25 0.7,2.75" fill="var(--gold)" />
      </svg>
      {amount.toFixed(3)} NIM
    </span>
  )
}
