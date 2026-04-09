import {
  DRAG_LERP_RATE,
  INERTIA_DECAY_RATE,
  VELOCITY_EPSILON,
} from './config'

/**
 * Slider drag controller with smoothing + inertia.
 *
 * Two-state model:
 *   1. While dragging — `value` chases `target` via exponential smoothing.
 *      Velocity is derived from the per-tick change so the system has
 *      momentum at the moment of release.
 *   2. After release — velocity is preserved and decays exponentially.
 *      `value` continues to advance for a short coast-down ("inertia").
 *      When velocity drops below VELOCITY_EPSILON it clamps to 0.
 *
 * Frame contract:
 *   - drag handlers call setTarget() / startDrag() / endDrag() at any time
 *   - render loop calls tick(dt) once per frame and reads `value` + `velocity`
 *
 * Hard clamps `value` to [0, 100] at all times. Inertia is killed if it
 * pushes the value past either boundary.
 */
export class SliderController {
  /** Smoothed displayed value (0-100). What the renderer reads. */
  value: number
  /** Where the user wants the value to be (set by drag handlers). */
  target: number
  /** Units/sec — used for inertia after drag end and for pulse detection. */
  velocity = 0
  /** True while the user is actively dragging. */
  isDragging = false

  constructor(initial = 0) {
    const clamped = initial < 0 ? 0 : initial > 100 ? 100 : initial
    this.value = clamped
    this.target = clamped
  }

  setTarget(value: number) {
    if (value < 0) value = 0
    else if (value > 100) value = 100
    this.target = value
  }

  startDrag() {
    this.isDragging = true
    // Reset velocity at the start so inertia from a previous release
    // doesn't carry into the new drag.
    this.velocity = 0
  }

  endDrag() {
    this.isDragging = false
    // velocity is preserved; tick() applies inertia and decays it
  }

  /**
   * Step the slider state forward by dt seconds.
   *
   *   dragging   → lerp value toward target, recompute velocity from delta
   *   released   → apply velocity * dt, decay velocity exponentially,
   *                clamp to [0, 100] (kills velocity at the wall)
   */
  tick(dt: number) {
    if (this.isDragging) {
      const alpha = 1 - Math.exp(-DRAG_LERP_RATE * dt)
      const newValue = this.value + (this.target - this.value) * alpha
      this.velocity = (newValue - this.value) / dt
      this.value = newValue
    } else if (Math.abs(this.velocity) > VELOCITY_EPSILON) {
      const newValue = this.value + this.velocity * dt
      if (newValue <= 0) {
        this.value = 0
        this.velocity = 0
      } else if (newValue >= 100) {
        this.value = 100
        this.velocity = 0
      } else {
        this.value = newValue
        this.velocity *= Math.exp(-INERTIA_DECAY_RATE * dt)
      }
    } else {
      this.velocity = 0
    }
  }

  reset() {
    this.value = 0
    this.target = 0
    this.velocity = 0
    this.isDragging = false
  }
}
