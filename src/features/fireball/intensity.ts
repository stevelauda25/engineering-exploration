import { INITIAL_INTENSITY, INTENSITY_LERP_RATE } from './config'

/**
 * Holds a smoothed intensity value (0-100). The value chases a target set by
 * an external controller — it has no opinion about WHY the target changed and
 * never reads cursor or interaction state directly.
 *
 *   setTarget(value) — instant; clamped to [0, 100]
 *   update(dt)       — frame-rate-independent lerp toward target
 *
 * Frame contract:
 *   - controller (slider drag) calls setTarget() at any time
 *   - render loop calls update(dt) once per frame, then reads `value`
 */
export class IntensitySystem {
  /** Smoothed value the renderer reads. */
  value = INITIAL_INTENSITY
  /** Target set by the controller. */
  target = INITIAL_INTENSITY

  setTarget(value: number) {
    if (value < 0) value = 0
    else if (value > 100) value = 100
    this.target = value
  }

  update(dt: number) {
    const alpha = 1 - Math.exp(-INTENSITY_LERP_RATE * dt)
    this.value += (this.target - this.value) * alpha
  }

  reset() {
    this.value = INITIAL_INTENSITY
    this.target = INITIAL_INTENSITY
  }
}
