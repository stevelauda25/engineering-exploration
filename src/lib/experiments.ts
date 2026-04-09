export type ExperimentStatus = 'live' | 'soon'

export type Experiment = {
  id: string
  index: string
  title: string
  description: string
  tag: string
  status: ExperimentStatus
  path: string
}

export const experiments: Experiment[] = [
  {
    id: 'particle-sphere',
    index: '01',
    title: '3D Particle Sphere',
    description:
      'A sphere built from thousands of points — breathing, spiraling, jittering, and predicting through five distinct cognitive states.',
    tag: 'WebGL · Three.js',
    status: 'live',
    path: '/experiments/particle-sphere',
  },
  {
    id: 'fireball',
    index: '02',
    title: 'Interactive Fireball',
    description:
      'A living particle fireball that follows the cursor — bursts on flicks, intensifies on hover, pulses on click, and trails a fading wake of embers.',
    tag: 'WebGL · Particles',
    status: 'live',
    path: '/experiment/fireball',
  },
]
