import { IDLE_OFFSET_Y } from './config'

/**
 * Tracks the cursor in VIEWPORT coordinates (clientX/clientY).
 *
 * Pure position state — no velocity, no hover dwell, no clicks, no presses.
 * The fireball uses this for POSITION only; cursor speed has no effect on
 * intensity or particle motion.
 *
 *   pointerMove(viewportX, viewportY) — set position, mark as moved
 *   handleResize()                    — recenter idle position if not yet moved
 *
 * No clamping. The fireball is allowed to follow the cursor anywhere in the
 * viewport without restriction.
 */
export class CursorTracker {
  /** Viewport coords (px from top-left of the browser viewport). */
  targetX = 0
  targetY = 0

  /** Once true, position is locked to user input and never reverts to idle. */
  private hasMoved = false

  constructor() {
    this.recenterIdle()
  }

  pointerMove(x: number, y: number) {
    this.targetX = x
    this.targetY = y
    this.hasMoved = true
  }

  /** Called on viewport resize — recenters idle position if user hasn't moved yet. */
  handleResize() {
    if (this.hasMoved) return
    this.recenterIdle()
  }

  private recenterIdle() {
    if (typeof window === 'undefined') return
    this.targetX = window.innerWidth / 2
    this.targetY = window.innerHeight / 2 + IDLE_OFFSET_Y
  }
}
