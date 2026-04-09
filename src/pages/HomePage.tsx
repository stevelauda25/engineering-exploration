import type { CSSProperties } from 'react'
import { ExperimentCard } from '@/components/ExperimentCard'
import { experiments } from '@/lib/experiments'

export function HomePage() {
  const liveCount = experiments.filter((e) => e.status === 'live').length
  const total = experiments.length

  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      {/* Background layers */}
      <div aria-hidden className="blueprint-grid pointer-events-none fixed inset-0" />
      <div
        aria-hidden
        className="scanline pointer-events-none fixed inset-0 opacity-40 mix-blend-overlay"
      />

      {/* Top system bar */}
      <TopBar liveCount={liveCount} total={total} />

      {/* Bottom system bar */}
      <BottomBar />

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-6 pt-32 pb-32 sm:px-10 sm:pt-36">
        <header className="flex flex-col items-start gap-5">
          <div
            className="rise-in inline-flex items-center gap-3"
            style={{ '--stagger': 0 } as CSSProperties}
          >
            <span className="pulse-ring size-1.5 rounded-full bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-300/80">
              Engineering / Exploration
            </span>
          </div>

          <h1
            className="
              rise-in text-balance
              text-4xl font-medium leading-[1.05] tracking-tight text-ink-100
              sm:text-5xl md:text-6xl
            "
            style={{ '--stagger': 1 } as CSSProperties}
          >
            A workbench for{' '}
            <span className="bg-gradient-to-br from-ink-100 via-ink-300 to-accent bg-clip-text text-transparent">
              interactive systems
            </span>
          </h1>

          <p
            className="rise-in max-w-xl text-balance text-[15px] leading-relaxed text-ink-300/75"
            style={{ '--stagger': 2 } as CSSProperties}
          >
            A precision collection of engineering experiments — small studies in
            motion, interface, and feel.
          </p>

          <div
            className="rise-in mt-1 flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500"
            style={{ '--stagger': 3 } as CSSProperties}
          >
            <span className="text-accent">●</span>
            <span>Active modules</span>
            <span className="h-px w-8 bg-ink-800" />
            <span>{String(liveCount).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
          </div>
        </header>

        {/* Section divider */}
        <div
          className="rise-in mt-16 flex items-center gap-4"
          style={{ '--stagger': 4 } as CSSProperties}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            // experiments
          </span>
          <span className="h-px flex-1 bg-ink-800" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            v0.1
          </span>
        </div>

        {/* Experiment grid */}
        <section
          aria-label="Experiments"
          className="mt-6 grid grid-cols-1 gap-4 sm:max-w-xl"
        >
          {experiments.map((experiment, i) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              index={i + 5}
            />
          ))}
        </section>
      </div>
    </main>
  )
}

function TopBar({ liveCount, total }: { liveCount: number; total: number }) {
  return (
    <div
      className="
        fade-in fixed inset-x-0 top-0 z-10
        flex items-center justify-between
        border-b border-ink-800/80 bg-ink-1000/60 backdrop-blur-md
        px-6 py-3 sm:px-10
        font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500
      "
      style={{ '--stagger': 0 } as CSSProperties}
    >
      <div className="flex items-center gap-3">
        <span className="size-1.5 rounded-full bg-accent" />
        <span className="text-ink-300">EE / SYS</span>
        <span className="hidden h-3 w-px bg-ink-800 sm:block" />
        <span className="hidden sm:inline">Node 01 · Sector A</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden sm:inline">
          MOD {String(liveCount).padStart(2, '0')}/{String(total).padStart(2, '0')}
        </span>
        <span className="hidden h-3 w-px bg-ink-800 sm:block" />
        <span className="text-ink-300">ONLINE</span>
      </div>
    </div>
  )
}

function BottomBar() {
  return (
    <div
      className="
        fade-in fixed inset-x-0 bottom-0 z-10
        flex items-center justify-between
        border-t border-ink-800/80 bg-ink-1000/60 backdrop-blur-md
        px-6 py-3 sm:px-10
        font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500
      "
      style={{ '--stagger': 1 } as CSSProperties}
    >
      <span>// engineering-exploration</span>
      <div className="flex items-center gap-4">
        <span className="hidden sm:inline">↳ scroll to explore</span>
        <span className="hidden h-3 w-px bg-ink-800 sm:block" />
        <span>v0.1.0</span>
      </div>
    </div>
  )
}
