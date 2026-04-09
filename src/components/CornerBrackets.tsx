type CornerBracketsProps = {
  size?: number
  className?: string
}

export function CornerBrackets({ size = 14, className = '' }: CornerBracketsProps) {
  const stroke = 'border-ink-700/80'
  const s = `${size}px`
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <span
        className={`absolute left-0 top-0 border-l border-t ${stroke}`}
        style={{ width: s, height: s }}
      />
      <span
        className={`absolute right-0 top-0 border-r border-t ${stroke}`}
        style={{ width: s, height: s }}
      />
      <span
        className={`absolute left-0 bottom-0 border-l border-b ${stroke}`}
        style={{ width: s, height: s }}
      />
      <span
        className={`absolute right-0 bottom-0 border-r border-b ${stroke}`}
        style={{ width: s, height: s }}
      />
    </div>
  )
}
