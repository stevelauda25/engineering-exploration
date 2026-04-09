import { useEffect, useRef } from 'react'
import { ParticleSphere } from './ParticleSphere'
import type { SphereState } from './states'

type SphereCanvasProps = {
  state: SphereState
}

export function SphereCanvas({ state }: SphereCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sphereRef = useRef<ParticleSphere | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const sphere = new ParticleSphere(container)
    sphereRef.current = sphere
    sphere.start()

    const toNormalized = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect()
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1
      const ny = -(((clientY - rect.top) / rect.height) * 2 - 1)
      return { nx, ny }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const { nx, ny } = toNormalized(event.clientX, event.clientY)
      sphere.setHover(nx, ny)
      // dragTo is a no-op when not actively dragging
      sphere.dragTo(event.clientX, event.clientY)
    }

    const handlePointerLeave = () => {
      // Only fade hover; drag continues via pointer capture
      if (!sphere.isDragActive()) sphere.setHover(0, 0)
    }

    const handlePointerDown = (event: PointerEvent) => {
      // Mouse: primary button only. Touch/pen: any.
      if (event.pointerType === 'mouse' && event.button !== 0) return
      container.setPointerCapture(event.pointerId)
      sphere.startDrag(event.clientX, event.clientY)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId)
      }
      sphere.endDrag()
    }

    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)
    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointerup', handlePointerUp)
    container.addEventListener('pointercancel', handlePointerUp)

    return () => {
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointerup', handlePointerUp)
      container.removeEventListener('pointercancel', handlePointerUp)
      sphere.dispose()
      sphereRef.current = null
    }
  }, [])

  useEffect(() => {
    sphereRef.current?.setState(state)
  }, [state])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
      aria-hidden
    />
  )
}
