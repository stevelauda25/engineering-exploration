import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { CursorTracker } from '@/features/fireball/cursor'
import { Fireball } from '@/features/fireball/Fireball'
import { SliderController } from '@/features/fireball/slider'
import {
  INITIAL_INTENSITY,
  PULSE_COOLDOWN,
  PULSE_VELOCITY_THRESHOLD,
  SLIDER_KNOB_WIDTH,
  SLIDER_TRAVEL,
} from '@/features/fireball/config'

// ============================================================
// Tailwind class strings — declared as literal const so the JIT
// scanner sees them at build time.
// ============================================================

// Knob base shadow has FIVE stops. The 5th is a placeholder fire-glow
// stop with alpha 0 so the dragging variant can interpolate it cleanly
// to a real glow without changing the stop count (CSS box-shadow only
// transitions smoothly between shadows with the same number of stops).
// Glow color is a softened warm tone (255,170,90) — not pure orange —
// matching the cool background palette.
const KNOB_BASE_SHADOW =
  'shadow-[0px_1px_4px_0px_rgba(0,0,0,0.35),0px_2px_8px_-2px_rgba(0,0,0,0.3),0px_6px_12px_-6px_rgba(0,0,0,0.35),0px_8px_16px_-8px_rgba(0,0,0,0.15),0px_0px_0px_0px_rgba(255,170,90,0)]'

// Same 5-stop shape, but the 5th stop blooms into a soft warm glow.
const KNOB_DRAGGING_SHADOW =
  'group-data-[dragging=true]:shadow-[0px_1px_4px_0px_rgba(0,0,0,0.35),0px_2px_8px_-2px_rgba(0,0,0,0.3),0px_6px_12px_-6px_rgba(0,0,0,0.35),0px_8px_16px_-8px_rgba(0,0,0,0.15),0px_0px_28px_0px_rgba(255,170,90,0.45)]'

const PILL_INNER_SHADOW =
  'shadow-[inset_0px_0.5px_0.5px_0px_rgba(255,255,255,0.25),inset_0px_-0.5px_0.5px_0px_rgba(0,0,0,0.25),inset_0px_0px_0px_0.5px_rgba(0,0,0,0.1)]'

// Cool light hairline border — visible on the dark background.
const TRACK_HAIRLINE = 'shadow-[inset_0px_0px_0px_0.5px_rgba(220,228,240,0.15)]'

// Badge: soft warm halo + cool dark drop shadow.
const BADGE_SHADOW =
  'shadow-[0px_0px_18px_0px_rgba(255,170,90,0.45),0px_4px_12px_0px_rgba(0,0,0,0.5)]'

export function FireballPage() {
  // Two independent input systems, both created once on mount.
  const [cursor] = useState(() => new CursorTracker())
  const [slider] = useState(() => new SliderController(INITIAL_INTENSITY))

  // DOM + instance refs (no per-frame React re-renders anywhere)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const trackGlowRef = useRef<HTMLDivElement>(null)
  const knobMoverRef = useRef<HTMLDivElement>(null)
  const knobScalerRef = useRef<HTMLDivElement>(null)
  const badgeTextRef = useRef<HTMLSpanElement>(null)
  const fireballRef = useRef<Fireball | null>(null)

  // ============================================================
  // Mount Three.js fireball + run the slider tick loop.
  // The fireball owns its own rAF for rendering; we run a parallel
  // rAF for the slider so its smoothing and inertia are independent.
  // ============================================================
  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    const fireball = new Fireball(container, cursor)
    fireballRef.current = fireball

    // Initial state — sync the fireball + DOM to the slider's starting value.
    // The slider was initialized to INITIAL_INTENSITY in its constructor.
    fireball.setIntensityTarget(INITIAL_INTENSITY)

    if (knobMoverRef.current) {
      const x = (INITIAL_INTENSITY / 100) * SLIDER_TRAVEL
      knobMoverRef.current.style.transform = `translateX(${x}px)`
    }
    if (trackGlowRef.current) {
      const knobCenter =
        (INITIAL_INTENSITY / 100) * SLIDER_TRAVEL + SLIDER_KNOB_WIDTH / 2
      trackGlowRef.current.style.setProperty('--glow-x', `${knobCenter}px`)
    }
    if (badgeTextRef.current) {
      badgeTextRef.current.textContent = String(INITIAL_INTENSITY)
    }

    fireball.start()

    // Slider tick loop — runs alongside the Fireball's render loop
    let lastTime = performance.now() / 1000
    let pulseCooldown = 0
    let rafId = 0

    const tickSlider = () => {
      const now = performance.now() / 1000
      const dt = Math.min(now - lastTime, 0.05)
      lastTime = now

      slider.tick(dt)

      // Update knob X position via direct DOM mutation (no React re-render)
      const x = (slider.value / 100) * SLIDER_TRAVEL
      const knobMover = knobMoverRef.current
      if (knobMover) knobMover.style.transform = `translateX(${x}px)`

      // Update the radial highlight center inside the track
      const trackGlow = trackGlowRef.current
      if (trackGlow) {
        const knobCenter = x + SLIDER_KNOB_WIDTH / 2
        trackGlow.style.setProperty('--glow-x', `${knobCenter}px`)
      }

      // Update the value badge text (Math.round so the displayed integer
      // changes once per perceived unit, no flicker)
      const badgeText = badgeTextRef.current
      if (badgeText) badgeText.textContent = String(Math.round(slider.value))

      // Push the smoothed slider value into the fireball as the intensity
      // target. The fireball has its OWN intensity smoothing on top of
      // this, giving the fire a "physical" delayed response.
      fireball.setIntensityTarget(slider.value)

      // Pulse on quick increase only (positive velocity). Decreases use
      // smooth lerp without a pulse.
      pulseCooldown -= dt
      if (slider.velocity > PULSE_VELOCITY_THRESHOLD && pulseCooldown <= 0) {
        const scaler = knobScalerRef.current
        if (scaler && typeof scaler.animate === 'function') {
          // Web Animations API — fire-and-forget keyframe pulse.
          // After it ends, CSS state takes over (scale-110 if still
          // dragging, 1.0 if released — the CSS transition smooths it).
          scaler.animate(
            [
              { transform: 'scale(1.10)', filter: 'brightness(1)' },
              {
                transform: 'scale(1.28)',
                filter: 'brightness(1.5)',
                offset: 0.5,
              },
              { transform: 'scale(1.10)', filter: 'brightness(1)' },
            ],
            { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
          )
        }
        pulseCooldown = PULSE_COOLDOWN
      }

      rafId = requestAnimationFrame(tickSlider)
    }
    rafId = requestAnimationFrame(tickSlider)

    return () => {
      cancelAnimationFrame(rafId)
      fireball.dispose()
      fireballRef.current = null
    }
  }, [cursor, slider])

  // ============================================================
  // Recenter cursor idle position on viewport resize
  // ============================================================
  useEffect(() => {
    const onResize = () => cursor.handleResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [cursor])

  // ============================================================
  // Cursor → fireball POSITION (viewport coords, no clamp)
  // ============================================================
  const handleViewportPointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      cursor.pointerMove(ev.clientX, ev.clientY)
    },
    [cursor],
  )

  // ============================================================
  // Slider → fireball INTENSITY (controller, fixed in position)
  // ============================================================
  const valueFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const localX = clientX - rect.left
    // Knob is 40px wide; align its center with the cursor, then clamp to [0, 200]
    const knobLeft = Math.max(
      0,
      Math.min(SLIDER_TRAVEL, localX - SLIDER_KNOB_WIDTH / 2),
    )
    return (knobLeft / SLIDER_TRAVEL) * 100
  }, [])

  // Toggles the data-dragging attribute on the track. All cinematic
  // affordances (knob scale, glow, badge fade-in, track highlight) are
  // CSS-driven via group-data-[dragging=true] descendants.
  const setDraggingAttr = useCallback((dragging: boolean) => {
    trackRef.current?.setAttribute(
      'data-dragging',
      dragging ? 'true' : 'false',
    )
  }, [])

  const handleSliderPointerDown = useCallback(
    (ev: ReactPointerEvent<HTMLDivElement>) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return
      ev.currentTarget.setPointerCapture(ev.pointerId)
      slider.startDrag()
      slider.setTarget(valueFromClientX(ev.clientX))
      setDraggingAttr(true)
    },
    [slider, valueFromClientX, setDraggingAttr],
  )

  const handleSliderPointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLDivElement>) => {
      if (!slider.isDragging) return
      slider.setTarget(valueFromClientX(ev.clientX))
    },
    [slider, valueFromClientX],
  )

  const handleSliderPointerUp = useCallback(
    (ev: ReactPointerEvent<HTMLDivElement>) => {
      if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
        ev.currentTarget.releasePointerCapture(ev.pointerId)
      }
      slider.endDrag()
      setDraggingAttr(false)
    },
    [slider, setDraggingAttr],
  )

  return (
    <main
      className="relative min-h-dvh w-full cursor-crosshair touch-none select-none overflow-hidden bg-[#2B3445] font-sans"
      onPointerMove={handleViewportPointerMove}
    >
      {/* Full-viewport Three.js canvas — fireball renders here */}
      <div ref={canvasContainerRef} className="absolute inset-0" aria-hidden />

      {/* Centered HUD overlay (Figma node 1812:77) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex w-[240px] flex-col items-center gap-[8px]">
          {/* Top section: fire region + slider, gap-[32px] (1812:73) */}
          <div className="flex w-full flex-col items-center gap-[32px]">
            {/* Fire region spacer — preserves Figma vertical layout (~86px offset) */}
            <div className="h-[160px] w-[128px]" aria-hidden />

            {/*
              Slider track — 240 x 32, semi-transparent black pill (1812:56).
              `group` class on the track lets all descendants react to its
              `data-dragging` attribute via Tailwind group-data variants.

              overflow-hidden is INTENTIONALLY removed so the knob's fire glow
              and the value badge above can render outside the track's bounds.
              The track's visual shape (rounded, bg-black/50, hairline border)
              is unchanged — only its clip behavior.
            */}
            <div
              ref={trackRef}
              role="slider"
              aria-label="Fireball intensity"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={INITIAL_INTENSITY}
              tabIndex={0}
              data-dragging="false"
              onPointerDown={handleSliderPointerDown}
              onPointerMove={handleSliderPointerMove}
              onPointerUp={handleSliderPointerUp}
              onPointerCancel={handleSliderPointerUp}
              className={`group pointer-events-auto relative h-[32px] w-full cursor-grab touch-none rounded-[999px] bg-white/15 active:cursor-grabbing ${TRACK_HAIRLINE}`}
            >
              {/*
                Track radial highlight — follows the knob via the --glow-x
                CSS variable (set every frame from the slider tick loop).
                Fades in/out via the group-data variant.
              */}
              <div
                ref={trackGlowRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-200 ease-out group-data-[dragging=true]:opacity-100"
                style={{
                  background:
                    'radial-gradient(ellipse 72px 20px at var(--glow-x, 20px) center, rgba(255,170,90,0.42), transparent 72%)',
                }}
              />

              {/*
                Knob mover — only translateX is set on this element (every
                frame, no transition). Splitting position from visual lets
                the per-frame DOM mutation coexist with the CSS transition
                on the inner scaler.
              */}
              <div
                ref={knobMoverRef}
                className="absolute left-0 top-0 h-[32px] w-[40px]"
                style={{ willChange: 'transform' }}
              >
                {/*
                  Value badge — positioned above the knob, fades in with
                  slight upward motion when dragging starts. translate-y-2
                  (8px below resting position) → translate-y-0 + opacity 0
                  → 1, both transitioned in 200ms.

                  tabular-nums + min-w-[32px] keeps the badge stable in
                  width as digits add (0 → 100), no jitter.
                */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-[28px] left-1/2 -translate-x-1/2 translate-y-2 opacity-0 transition-[opacity,transform] duration-200 ease-out group-data-[dragging=true]:translate-y-0 group-data-[dragging=true]:opacity-100"
                >
                  <div
                    className={`min-w-[32px] rounded-md bg-[#1a2230]/95 px-[8px] py-[3px] text-center text-[11px] font-medium leading-none tabular-nums text-[#e3e8ef] ${BADGE_SHADOW}`}
                  >
                    <span ref={badgeTextRef}>0</span>
                  </div>
                </div>

                {/*
                  Knob scaler — owns the visual (white pill, layered shadow)
                  AND the cinematic transform/glow that animates on drag.
                  220ms ease-out cubic-bezier transition on transform +
                  box-shadow. The 5-stop base shadow has a placeholder fire
                  glow at alpha 0 so the dragging variant can interpolate
                  it to a real glow without a stop-count change (CSS
                  box-shadow transitions only interpolate cleanly when
                  the stop counts match).
                */}
                <div
                  ref={knobScalerRef}
                  className={`relative h-full w-full rounded-[999px] bg-[#e8ecf2] transition-[transform,box-shadow] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[dragging=true]:scale-110 ${KNOB_BASE_SHADOW} ${KNOB_DRAGGING_SHADOW}`}
                  style={{ willChange: 'transform, box-shadow' }}
                >
                  {/* 3x3 grid of 4px gray dots (1812:67) */}
                  <div className="absolute left-1/2 top-[6px] flex w-[20px] -translate-x-1/2 flex-col gap-[4px]">
                    {[0, 1, 2].map((row) => (
                      <div
                        key={row}
                        className="flex w-full items-center gap-[4px]"
                      >
                        {[0, 1, 2].map((col) => (
                          <div
                            key={col}
                            className={`size-[4px] shrink-0 rounded-[999px] bg-[#c2c2c2] ${PILL_INNER_SHADOW}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Knob inset bevel + hairline border */}
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 rounded-[inherit] ${PILL_INNER_SHADOW}`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Labels row — 208 wide, "0" / "100", Inter Medium 10 cool gray (1812:76) */}
          <div className="flex w-[208px] items-center justify-between font-medium text-[10px] leading-none capitalize text-[#a8b1bf]">
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </main>
  )
}
