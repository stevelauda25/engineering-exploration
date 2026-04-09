import * as THREE from 'three'
import {
  CAMERA_DISTANCE,
  CAMERA_FOV,
  PARTICLE_COUNT,
  SPHERE_RADIUS,
  TRANSITION_DURATION,
} from './config'
import { STATES, type SphereState } from './states'

type Vec3 = [number, number, number]

// Hover tilt — radians of max rotation when cursor is at the container edge.
const HOVER_TILT_STRENGTH = 0.18
// Higher = snappier hover lerp. Frame-rate independent.
const HOVER_TILT_SMOOTHING = 6

// Drag — pixels-to-radians.
const DRAG_SENSITIVITY = 0.0065
// Inertia decay rate (higher = stops faster). exp(-DECAY * dt) per frame.
const DRAG_INERTIA_DECAY = 2.4
// EMA factor for tracking drag angular velocity (0..1, higher = trusts latest sample more).
const DRAG_VEL_EMA = 0.55
// Below this magnitude inertia is clamped to zero.
const DRAG_VEL_EPSILON = 0.0008

/**
 * Renders a particle sphere with smoothly interpolated animation states,
 * subtle hover tilt, and drag-to-rotate with inertia.
 *
 * Lifecycle:
 *   const sphere = new ParticleSphere(container)
 *   sphere.start()
 *   sphere.setState('analyzing')
 *   sphere.setHover(nx, ny)
 *   sphere.startDrag(clientX, clientY) / dragTo / endDrag
 *   sphere.dispose()
 */
export class ParticleSphere {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  /** Wraps `points` so hover tilt can be applied without disturbing drag/auto rotation. */
  private readonly tiltGroup: THREE.Group
  private readonly points: THREE.Points
  private readonly material: THREE.ShaderMaterial
  private readonly positionAttr: THREE.BufferAttribute
  private readonly base: Float32Array
  private readonly current: Float32Array

  private rafId: number | null = null
  private lastTime = 0
  private clock = 0

  private currentState: SphereState = 'thinking'
  private prevState: SphereState = 'thinking'
  private transitionStart = 0
  private transitionActive = false

  // Hover tilt — applied to tiltGroup
  private hoverTargetX = 0
  private hoverTargetY = 0
  private hoverCurrentX = 0
  private hoverCurrentY = 0

  // Drag — mutates points.rotation directly + tracks velocity for inertia
  private isDragging = false
  private dragLastX = 0
  private dragLastY = 0
  private dragLastTime = 0
  private dragVelX = 0 // radians/sec
  private dragVelY = 0

  private resizeObserver: ResizeObserver | null = null

  // Reusable scratch vectors to avoid per-frame allocation
  private readonly offsetA: Vec3 = [0, 0, 0]
  private readonly offsetB: Vec3 = [0, 0, 0]

  constructor(container: HTMLElement) {
    this.container = container

    const width = container.clientWidth || 1
    const height = container.clientHeight || 1

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height, false)
    this.renderer.setClearColor(0x000000, 0)

    const canvas = this.renderer.domElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    container.appendChild(canvas)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 100)
    this.camera.position.set(0, 0, CAMERA_DISTANCE)
    this.camera.lookAt(0, 0, 0)

    this.base = new Float32Array(PARTICLE_COUNT * 3)
    this.current = new Float32Array(PARTICLE_COUNT * 3)
    this.generateBase()

    const geometry = new THREE.BufferGeometry()
    this.positionAttr = new THREE.BufferAttribute(this.current, 3)
    this.positionAttr.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('position', this.positionAttr)

    const sizes = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      sizes[i] = 0.5 + Math.random() * 0.5
    }
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        // Figma brand400 — Colors/Brand/bg/brand400
        uColor: { value: new THREE.Color(0x2f8cf9) },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uSizeBoost: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        uniform float uPixelRatio;
        uniform float uSizeBoost;
        varying float vDepth;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uSizeBoost * uPixelRatio * (32.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          vDepth = clamp((-mvPosition.z - 4.0) / 4.5, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vDepth;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          float core = smoothstep(0.5, 0.0, d);
          float alpha = pow(core, 1.4) * mix(0.95, 0.25, vDepth);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })

    this.points = new THREE.Points(geometry, this.material)
    this.tiltGroup = new THREE.Group()
    this.tiltGroup.add(this.points)
    this.scene.add(this.tiltGroup)

    this.resizeObserver = new ResizeObserver(this.handleResize)
    this.resizeObserver.observe(container)
  }

  private generateBase() {
    // Fibonacci sphere — even, dense distribution
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const theta = golden * i
      const x = Math.cos(theta) * r * SPHERE_RADIUS
      const z = Math.sin(theta) * r * SPHERE_RADIUS
      const py = y * SPHERE_RADIUS
      const ix = i * 3
      this.base[ix] = x
      this.base[ix + 1] = py
      this.base[ix + 2] = z
      this.current[ix] = x
      this.current[ix + 1] = py
      this.current[ix + 2] = z
    }
  }

  setState(state: SphereState) {
    if (state === this.currentState) return
    this.prevState = this.currentState
    this.currentState = state
    this.transitionStart = this.clock
    this.transitionActive = true
  }

  /** Pointer in normalized [-1, 1] over container. Drives subtle hover tilt. */
  setHover(nx: number, ny: number) {
    this.hoverTargetX = nx
    this.hoverTargetY = ny
  }

  startDrag(clientX: number, clientY: number) {
    this.isDragging = true
    this.dragLastX = clientX
    this.dragLastY = clientY
    this.dragLastTime = performance.now() / 1000
    this.dragVelX = 0
    this.dragVelY = 0
  }

  dragTo(clientX: number, clientY: number) {
    if (!this.isDragging) return
    const dx = clientX - this.dragLastX
    const dy = clientY - this.dragLastY
    this.dragLastX = clientX
    this.dragLastY = clientY

    const now = performance.now() / 1000
    const dt = Math.max(now - this.dragLastTime, 0.001)
    this.dragLastTime = now

    const dRotY = dx * DRAG_SENSITIVITY
    const dRotX = dy * DRAG_SENSITIVITY

    // Apply immediately so the sphere tracks the cursor without lag
    this.points.rotation.y += dRotY
    this.points.rotation.x += dRotX

    // Smooth velocity (EMA) for inertia after release
    const newVelY = dRotY / dt
    const newVelX = dRotX / dt
    this.dragVelX = this.dragVelX * (1 - DRAG_VEL_EMA) + newVelX * DRAG_VEL_EMA
    this.dragVelY = this.dragVelY * (1 - DRAG_VEL_EMA) + newVelY * DRAG_VEL_EMA
  }

  endDrag() {
    this.isDragging = false
    // Velocity persists; tick() decays it for inertial spin-down.
  }

  isDragActive() {
    return this.isDragging
  }

  start() {
    if (this.rafId !== null) return
    this.lastTime = performance.now() / 1000
    const loop = () => {
      this.tick()
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  private tick() {
    const now = performance.now() / 1000
    const dt = Math.min(now - this.lastTime, 0.05)
    this.lastTime = now
    this.clock += dt

    // --- Hover tilt (frame-rate independent lerp) ---
    // Fade tilt to 0 while dragging so the two interactions don't fight.
    if (this.isDragging) {
      this.hoverTargetX = 0
      this.hoverTargetY = 0
    }
    const tiltAlpha = 1 - Math.exp(-dt * HOVER_TILT_SMOOTHING)
    this.hoverCurrentX += (this.hoverTargetX - this.hoverCurrentX) * tiltAlpha
    this.hoverCurrentY += (this.hoverTargetY - this.hoverCurrentY) * tiltAlpha
    // Cursor up → pitch up; cursor right → yaw right.
    this.tiltGroup.rotation.x = -this.hoverCurrentY * HOVER_TILT_STRENGTH
    this.tiltGroup.rotation.y = this.hoverCurrentX * HOVER_TILT_STRENGTH

    // --- Drag inertia (only after release) ---
    if (!this.isDragging) {
      if (
        Math.abs(this.dragVelX) > DRAG_VEL_EPSILON ||
        Math.abs(this.dragVelY) > DRAG_VEL_EPSILON
      ) {
        this.points.rotation.x += this.dragVelX * dt
        this.points.rotation.y += this.dragVelY * dt
        const decay = Math.exp(-DRAG_INERTIA_DECAY * dt)
        this.dragVelX *= decay
        this.dragVelY *= decay
      } else {
        this.dragVelX = 0
        this.dragVelY = 0
      }
    }

    // --- State transition factor (eased) ---
    let t = 1
    if (this.transitionActive) {
      const raw = (this.clock - this.transitionStart) / TRANSITION_DURATION
      if (raw >= 1) {
        t = 1
        this.transitionActive = false
      } else {
        t = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2
      }
    }

    // --- Per-particle offsets ---
    const curr = STATES[this.currentState]
    const prev = STATES[this.prevState]
    const positions = this.current
    const base = this.base
    const time = this.clock
    const a = this.offsetA
    const b = this.offsetB
    const blending = this.transitionActive || t < 1

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3
      const bx = base[ix]
      const by = base[ix + 1]
      const bz = base[ix + 2]
      curr.offset(a, bx, by, bz, time, i)
      if (blending) {
        prev.offset(b, bx, by, bz, time, i)
        positions[ix] = bx + b[0] + (a[0] - b[0]) * t
        positions[ix + 1] = by + b[1] + (a[1] - b[1]) * t
        positions[ix + 2] = bz + b[2] + (a[2] - b[2]) * t
      } else {
        positions[ix] = bx + a[0]
        positions[ix + 1] = by + a[1]
        positions[ix + 2] = bz + a[2]
      }
    }

    this.positionAttr.needsUpdate = true

    // --- Auto rotation from state (additive on top of drag rotation) ---
    const cr = curr.rotationSpeed
    const pr = prev.rotationSpeed
    const rx = pr[0] + (cr[0] - pr[0]) * t
    const ry = pr[1] + (cr[1] - pr[1]) * t
    const rz = pr[2] + (cr[2] - pr[2]) * t
    this.points.rotation.x += rx * dt
    this.points.rotation.y += ry * dt
    this.points.rotation.z += rz * dt

    // --- Size pulse blend ---
    const cs = curr.sizeFactor(time)
    const ps = prev.sizeFactor(time)
    this.material.uniforms.uSizeBoost.value = ps + (cs - ps) * t

    this.renderer.render(this.scene, this.camera)
  }

  private handleResize = () => {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    this.scene.remove(this.tiltGroup)
    this.points.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
    const canvas = this.renderer.domElement
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas)
    }
  }
}
