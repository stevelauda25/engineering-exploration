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
]
