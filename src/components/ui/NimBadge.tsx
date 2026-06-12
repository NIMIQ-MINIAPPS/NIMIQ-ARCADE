interface NimBadgeProps {
  amount: number
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
  lg: 'text-base px-4 py-1.5',
}

export default function NimBadge({ amount, size = 'md' }: NimBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-full bg-[#FFC107]/10 border border-[#FFC107]/30 text-[#FFC107] ${sizes[size]}`}>
      <span className="text-[1.1em]">⬡</span>
      {amount.toFixed(3)} NIM
    </span>
  )
}
