import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SphereCanvas } from '@/features/particle-sphere/SphereCanvas'
import { StateDropdown } from '@/features/particle-sphere/StateDropdown'
import { type SphereState } from '@/features/particle-sphere/states'
import { experiments } from '@/lib/experiments'

export function ExperimentPage() {
  const { id } = useParams<{ id: string }>()
  const experiment = experiments.find((e) => e.id === id)
  const [state, setState] = useState<SphereState>('thinking')

  if (!experiment) {
    return <NotFound />
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white font-sans">
      {/* Figma node 1803:2 — Experiment 001 — 600 x 600 */}
      <div className="relative h-[600px] w-[600px]">
        {/*
          Inner content frame — 240 x 304 at (180, 148)
          Centered in the 600x600 frame both horizontally and vertically.
        */}
        <div className="absolute left-1/2 top-1/2 flex h-[304px] w-[240px] -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          {/* Visualization area — 240 x 240 */}
          <div className="relative h-[240px] w-[240px]">
            <SphereCanvas state={state} />
          </div>

          {/* Pill row — 32 px below visualization, 32 px tall, horizontally centered */}
          <div className="mt-[32px] flex h-[32px] items-center justify-center">
            <StateDropdown value={state} onChange={setState} />
          </div>
        </div>
      </div>
    </main>
  )
}

function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-white font-sans text-black">
      <h1 className="text-2xl font-medium">Unknown experiment</h1>
      <Link to="/" className="mt-4 text-sm underline">
        Back
      </Link>
    </main>
  )
}
