import { useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Experiment } from '@/lib/experiments'
import { CornerBrackets } from '@/components/CornerBrackets'

type ExperimentCardProps = {
  experiment: Experiment
  index: number
}

export function ExperimentCard({ experiment, index }: ExperimentCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pressed, setPressed] = useState(false)
  const isLive = experiment.status === 'live'

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    node.style.setProperty('--mx', `${x}%`)
    node.style.setProperty('--my', `${y}%`)
  }

  const cardClass = `
    group relative h-full overflow-hidden rounded-md
    border border-ink-800 bg-ink-900/50 backdrop-blur-sm
    p-5 sm:p-6
    transition-[transform,border-color,background-color,box-shadow]
    duration-200 ease-[var(--ease-out-quick)]
    will-change-transform
    ${
      isLive
        ? `cursor-pointer
           hover:border-accent/60 hover:bg-ink-900/75
           hover:shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-accent)_20%,transparent),0_20px_60px_-30px_color-mix(in_oklch,var(--color-accent)_50%,transparent)]
           hover:scale-[1.015]`
        : 'cursor-not-allowed opacity-50 saturate-50'
    }
    ${pressed ? '!scale-[0.99]' : ''}
  `

  const content = (
    <div
      ref={ref}
      onMouseMove={isLive ? handleMouseMove : undefined}
      onMouseDown={() => isLive && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className={cardClass}
    >
      {/* Cursor-tracked spotlight */}
      {isLive && (
        <div
          aria-hidden
          className="
            pointer-events-none absolute inset-0 opacity-0
            transition-opacity duration-200 ease-[var(--ease-out-quick)]
            group-hover:opacity-100
          "
          style={{
            background:
              'radial-gradient(320px circle at var(--mx,50%) var(--my,50%), color-mix(in oklch, var(--color-accent) 14%, transparent), transparent 55%)',
          }}
        />
      )}

      <CornerBrackets size={10} />

      <div className="relative flex h-full flex-col">
        {/* Top row: ID + status */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            <span className="text-ink-300">{experiment.index}</span>
            <span className="h-px w-4 bg-ink-800" />
            <span>{experiment.tag}</span>
          </div>
          <StatusBadge status={experiment.status} />
        </div>

        {/* Title */}
        <h3
          className="
            mt-10 text-lg font-medium tracking-tight text-ink-100
            transition-colors duration-200 ease-[var(--ease-out-quick)]
            group-hover:text-accent-strong
          "
        >
          {experiment.title}
        </h3>

        {/* Description */}
        <p className="mt-2 text-[13px] leading-relaxed text-ink-300/80 text-balance">
          {experiment.description}
        </p>

        {/* Bottom row: id label + open arrow */}
        <div className="mt-auto flex items-end justify-between pt-10 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          <span>ID · {experiment.id}</span>
          {isLive && (
            <span
              aria-hidden
              className="
                inline-flex items-center gap-1 text-ink-300
                transition-all duration-200 ease-[var(--ease-out-quick)]
                group-hover:gap-2 group-hover:text-accent
              "
            >
              Open
              <Arrow />
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (!isLive) {
    return (
      <div
        aria-disabled
        className="rise-in h-full"
        style={{ '--stagger': index } as CSSProperties}
      >
        {content}
      </div>
    )
  }

  return (
    <Link
      to={experiment.path}
      className="rise-in block h-full rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
      style={{ '--stagger': index } as CSSProperties}
    >
      {content}
    </Link>
  )
}

function StatusBadge({ status }: { status: Experiment['status'] }) {
  if (status === 'soon') {
    return (
      <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
        <span className="size-1.5 rounded-full bg-ink-700" />
        Coming soon
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
      <span className="pulse-ring size-1.5 rounded-full bg-accent" />
      Live
    </span>
  )
}

function Arrow() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}
