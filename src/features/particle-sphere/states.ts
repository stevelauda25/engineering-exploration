import { SPHERE_RADIUS } from './config'

export type SphereState =
  | 'thinking'
  | 'analyzing'
  | 'calculating'
  | 'observing'
  | 'predicting'

export const SPHERE_STATES: SphereState[] = [
  'thinking',
  'analyzing',
  'calculating',
  'observing',
  'predicting',
]

export const STATE_LABELS: Record<SphereState, string> = {
  thinking: 'Thinking',
  analyzing: 'Analyzing',
  calculating: 'Calculating',
  observing: 'Observing',
  predicting: 'Predicting',
}

export const STATE_DESCRIPTIONS: Record<SphereState, string> = {
  thinking: 'Pulsating breath. Smooth expansion and contraction.',
  analyzing: 'Spiraling vortex. Particles rotate around the core.',
  calculating: 'Fast micro jitter. Precise computational tremor.',
  observing: 'Slow rotation. Minimal, watchful motion.',
  predicting: 'Forward momentum. Particles stretch and lead.',
}

type Vec3 = [number, number, number]

export type StateBehavior = {
  /** Per-particle position offset (relative to base position). Mutates `out`. */
  offset(
    out: Vec3,
    bx: number,
    by: number,
    bz: number,
    time: number,
    index: number,
  ): void
  /** Continuous rotation velocity applied to the points group (radians/sec). */
  rotationSpeed: Vec3
  /** Global size multiplier evolving over time. */
  sizeFactor(time: number): number
}

/**
 * Per-state offset budgets are tuned so every state's worst-case particle
 * position stays inside the camera frustum (no clipping at SPHERE_RADIUS=2.5,
 * camera z=7.0, FOV 45°).
 */
export const STATES: Record<SphereState, StateBehavior> = {
  thinking: {
    offset(out, bx, by, bz, time, index) {
      const breath = Math.sin(time * 1.25 + index * 0.0006) * 0.5 + 0.5
      const subtle = Math.sin(time * 2.3 + index * 0.011) * 0.008
      const scale = breath * 0.07 + subtle
      out[0] = bx * scale
      out[1] = by * scale
      out[2] = bz * scale
    },
    rotationSpeed: [0, 0.05, 0],
    sizeFactor: (t) => 1 + Math.sin(t * 1.25) * 0.08,
  },

  analyzing: {
    offset(out, bx, by, bz, time, index) {
      const r = Math.sqrt(bx * bx + bz * bz)
      const baseAngle = Math.atan2(bz, bx)
      const swirl = time * 0.95 + (by / SPHERE_RADIUS) * 1.5
      const a = baseAngle + swirl
      const radial = 1 + Math.sin(time * 0.7 + by * 2.1) * 0.05
      const newX = Math.cos(a) * r * radial
      const newZ = Math.sin(a) * r * radial
      out[0] = newX - bx
      out[1] = Math.sin(time * 0.9 + index * 0.008) * 0.025
      out[2] = newZ - bz
    },
    rotationSpeed: [0, 0.04, 0],
    sizeFactor: () => 1,
  },

  calculating: {
    offset(out, _bx, _by, _bz, time, index) {
      out[0] = Math.sin(time * 24 + index * 12.9898) * 0.04
      out[1] = Math.sin(time * 26 + index * 78.233) * 0.04
      out[2] = Math.sin(time * 22 + index * 37.719) * 0.04
    },
    rotationSpeed: [0, 0.1, 0],
    sizeFactor: (t) => 1 + Math.sin(t * 18) * 0.12,
  },

  observing: {
    offset(out, bx, by, bz, time, index) {
      const wobble = Math.sin(time * 0.45 + index * 0.05) * 0.008
      out[0] = bx * wobble
      out[1] = by * wobble
      out[2] = bz * wobble
    },
    rotationSpeed: [0, 0.08, 0],
    sizeFactor: () => 1,
  },

  predicting: {
    offset(out, _bx, _by, bz, time, index) {
      // Particles closer to +z lead the motion (forward stretch — kept small).
      // The "directional motion" cue comes from a faster Y rotation.
      const front = (bz / SPHERE_RADIUS + 1) * 0.5
      const surge = Math.pow(front, 1.6) * 0.12
      const wave = Math.sin(time * 1.6 + bz * 1.4 + index * 0.013) * 0.04
      const drift = Math.sin(time * 0.75 + index * 0.005) * 0.02
      out[0] = drift * 0.25
      out[1] = drift * 0.25
      out[2] = surge + wave + 0.04
    },
    rotationSpeed: [0, 0.4, 0],
    sizeFactor: (t) => 1 + Math.sin(t * 1.6) * 0.04,
  },
}
