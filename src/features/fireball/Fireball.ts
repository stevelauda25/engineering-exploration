import * as THREE from 'three'
import {
  BUOYANCY_BASE,
  BUOYANCY_GAIN,
  CAMERA_FAR,
  CAMERA_NEAR,
  CAMERA_Z,
  CURSOR_FOLLOW_LERP,
  INTENSITY_POWER,
  MAX_PARTICLES,
  PARTICLE_BASE_SIZE,
  PARTICLE_BASE_UPWARD,
  PARTICLE_DRAG_RATE,
  PARTICLE_LIFE_MAX,
  PARTICLE_LIFE_MIN,
  PARTICLE_SIZE_RANGE,
  SHADER_ALPHA_BASE,
  SHADER_ALPHA_GAIN,
  SIZE_INTENSITY_BASE,
  SIZE_INTENSITY_GAIN,
  SPAWN_RADIAL_SPREAD_BASE,
  SPAWN_RADIAL_SPREAD_GAIN,
  SPAWN_RATE_MAX,
  SPAWN_RATE_MIN,
  SPAWN_SCATTER_BASE,
  SPAWN_SCATTER_GAIN,
  TURBULENCE_BASE,
  TURBULENCE_GAIN,
} from './config'
import { CursorTracker } from './cursor'
import { IntensitySystem } from './intensity'

/**
 * Renders an interactive particle fireball in the FULL VIEWPORT using
 * THREE.Points with a custom shader. Owns:
 *   - the WebGL renderer + orthographic camera (viewport-pixel coords, y down)
 *   - the per-particle CPU state (Float32Arrays)
 *   - the main rAF loop and update logic
 *
 * Two completely independent inputs:
 *   1. CursorTracker (viewport coords)   → drives POSITION only.  No clamp.
 *   2. setIntensityTarget(value)         → drives SIZE / SPREAD / GLOW / CHAOS.
 *
 * The Fireball never reads cursor velocity, hover dwell, click events, or
 * presses. Position and intensity are completely independent.
 *
 * No position clamping anywhere. The fireball can follow the cursor to any
 * pixel in the viewport. Particles that fly off-screen are clipped naturally
 * by the canvas overflow.
 */
export class Fireball {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.OrthographicCamera

  // --- particle state (parallel typed arrays) ---
  private readonly positions: Float32Array
  private readonly velocities: Float32Array
  private readonly ages: Float32Array
  private readonly maxAges: Float32Array
  private readonly baseSizes: Float32Array
  private readonly seeds: Float32Array

  // --- GPU buffers (uploaded each frame) ---
  private readonly gpuPositions: Float32Array
  private readonly gpuSizes: Float32Array
  private readonly gpuAge01: Float32Array

  private readonly geometry: THREE.BufferGeometry
  private readonly positionAttr: THREE.BufferAttribute
  private readonly sizeAttr: THREE.BufferAttribute
  private readonly ageAttr: THREE.BufferAttribute
  private readonly material: THREE.ShaderMaterial
  private readonly points: THREE.Points

  /** Number of currently-alive particles (first N slots in the arrays). */
  private liveCount = 0

  /** Smoothed fireball center — chases cursor target with lerp. */
  centerX: number
  centerY: number

  /** Continuous spawn fractional accumulator. */
  private spawnAcc = 0

  private readonly cursor: CursorTracker
  private readonly intensity: IntensitySystem

  // rAF loop state
  private rafId: number | null = null
  private lastTime = 0
  private clock = 0

  private resizeObserver: ResizeObserver | null = null

  constructor(container: HTMLElement, cursor: CursorTracker) {
    this.container = container
    this.cursor = cursor
    this.intensity = new IntensitySystem()

    // Start the center wherever the cursor currently is — at first mount that's
    // the viewport center + Figma offset.
    this.centerX = cursor.targetX
    this.centerY = cursor.targetY

    const width =
      container.clientWidth ||
      (typeof window !== 'undefined' ? window.innerWidth : 1)
    const height =
      container.clientHeight ||
      (typeof window !== 'undefined' ? window.innerHeight : 1)

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
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

    // Orthographic camera mapping viewport pixels directly:
    //   x ∈ [0, width]  left → right
    //   y ∈ [0, height] top → bottom (top < bottom flips y to match screen coords)
    this.camera = new THREE.OrthographicCamera(
      0,
      width,
      0,
      height,
      CAMERA_NEAR,
      CAMERA_FAR,
    )
    this.camera.position.z = CAMERA_Z

    // --- particle storage ---
    this.positions = new Float32Array(MAX_PARTICLES * 2)
    this.velocities = new Float32Array(MAX_PARTICLES * 2)
    this.ages = new Float32Array(MAX_PARTICLES)
    this.maxAges = new Float32Array(MAX_PARTICLES).fill(1)
    this.baseSizes = new Float32Array(MAX_PARTICLES)
    this.seeds = new Float32Array(MAX_PARTICLES)

    this.gpuPositions = new Float32Array(MAX_PARTICLES * 3)
    this.gpuSizes = new Float32Array(MAX_PARTICLES)
    this.gpuAge01 = new Float32Array(MAX_PARTICLES)

    // --- geometry ---
    this.geometry = new THREE.BufferGeometry()
    this.positionAttr = new THREE.BufferAttribute(this.gpuPositions, 3)
    this.positionAttr.setUsage(THREE.DynamicDrawUsage)
    this.sizeAttr = new THREE.BufferAttribute(this.gpuSizes, 1)
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage)
    this.ageAttr = new THREE.BufferAttribute(this.gpuAge01, 1)
    this.ageAttr.setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('position', this.positionAttr)
    this.geometry.setAttribute('size', this.sizeAttr)
    this.geometry.setAttribute('age', this.ageAttr)
    this.geometry.setDrawRange(0, 0)

    // --- material ---
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uIntensity: { value: 0 }, // 0..1, set each frame from intensity.value
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float age;
        uniform float uPixelRatio;
        varying float vAge;
        void main() {
          vAge = clamp(age, 0.0, 1.0);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          // Particles shrink slightly over their lifetime
          float lifeShrink = 1.0 - 0.30 * vAge;
          gl_PointSize = size * lifeShrink * uPixelRatio;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uIntensity;
        varying float vAge;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;

          // Soft round particle with a glow falloff
          float core = smoothstep(0.5, 0.0, d);
          float glow = pow(core, 1.6);

          // Color ramp — recalibrated for the cool #2B3445 background:
          //   - Core: warm cream (not pure white)
          //   - Mid:  slightly desaturated golden / orange
          //   - Outer: darker rust red
          vec3 cream  = vec3(1.00, 0.94, 0.74);
          vec3 yellow = vec3(1.00, 0.78, 0.36);
          vec3 orange = vec3(0.92, 0.48, 0.16);
          vec3 red    = vec3(0.62, 0.20, 0.10);
          vec3 color;
          if (vAge < 0.20) {
            color = mix(cream, yellow, vAge / 0.20);
          } else if (vAge < 0.50) {
            color = mix(yellow, orange, (vAge - 0.20) / 0.30);
          } else if (vAge < 0.85) {
            color = mix(orange, red, (vAge - 0.50) / 0.35);
          } else {
            color = red;
          }

          // Subtle warm boost on the very young (white-hot core feel) —
          // smaller and warm-tinted so it doesn't pop against the cool bg.
          color += (1.0 - smoothstep(0.0, 0.15, vAge)) * vec3(0.12, 0.10, 0.04);

          // Ambient blend — old particles fade their hue toward the
          // background color so the outer edges of the fireball dissolve
          // into the scene instead of hard-edged.
          vec3 ambient = vec3(0.169, 0.204, 0.271); // #2B3445
          color = mix(color, ambient, smoothstep(0.55, 1.0, vAge) * 0.35);

          // Alpha: smooth fade-in / fade-out across life, capped lower
          // than before (max 0.80 instead of 1.00) so the glow stays
          // restrained against the dark background.
          float alphaIn  = smoothstep(0.00, 0.05, vAge);
          float alphaOut = 1.0 - smoothstep(0.65, 1.00, vAge);
          float intensityAlpha = ${SHADER_ALPHA_BASE.toFixed(2)} + ${SHADER_ALPHA_GAIN.toFixed(2)} * uIntensity;
          float alpha = glow * alphaIn * alphaOut * intensityAlpha;

          gl_FragColor = vec4(color, alpha);
        }
      `,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.scene.add(this.points)

    this.resizeObserver = new ResizeObserver(this.handleResize)
    this.resizeObserver.observe(container)
  }

  // ============================================================
  // Public API
  // ============================================================

  /** Called by the controller (slider drag) to set the intensity target. */
  setIntensityTarget(value: number) {
    this.intensity.setTarget(value)
  }

  /** Read the smoothed intensity (e.g. for HUD display). */
  getIntensity() {
    return this.intensity.value
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

  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    this.scene.remove(this.points)
    this.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
    const canvas = this.renderer.domElement
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas)
    }
  }

  // ============================================================
  // Per-frame update
  // ============================================================

  private tick() {
    const now = performance.now() / 1000
    const dt = Math.min(now - this.lastTime, 0.05)
    this.lastTime = now
    this.clock += dt

    // 1. Read target — viewport coords directly. NO CLAMP.
    const targetX = this.cursor.targetX
    const targetY = this.cursor.targetY

    // 2. Lerp center toward target — smooth, slightly delayed (natural)
    const followAlpha = 1 - Math.exp(-CURSOR_FOLLOW_LERP * dt)
    this.centerX += (targetX - this.centerX) * followAlpha
    this.centerY += (targetY - this.centerY) * followAlpha

    // 3. Smooth intensity toward the controller's target
    this.intensity.update(dt)
    const intensity01 = this.intensity.value / 100
    // Power curve — gentle 0..50, dramatic 50..100
    const intensityCurve = Math.pow(intensity01, INTENSITY_POWER)

    // 4. Push intensity into the shader (linear for brightness; the visual
    //    "size pop" comes from the curve applied to size + spawn rate)
    this.material.uniforms.uIntensity.value = intensity01

    // 5. Continuous spawn at curved rate
    const spawnRate =
      SPAWN_RATE_MIN + (SPAWN_RATE_MAX - SPAWN_RATE_MIN) * intensityCurve
    this.spawnAcc += spawnRate * dt
    const spawnCount = Math.floor(this.spawnAcc)
    this.spawnAcc -= spawnCount
    if (spawnCount > 0) {
      this.spawnContinuous(spawnCount, intensityCurve)
    }

    // 6. Step + compact + upload particles
    this.updateParticles(dt, intensityCurve)

    // 7. Render
    this.renderer.render(this.scene, this.camera)
  }

  // ============================================================
  // Particle update + compaction
  // ============================================================

  private updateParticles(dt: number, intensityCurve: number) {
    const drag = Math.exp(-PARTICLE_DRAG_RATE * dt)
    const buoyancy = BUOYANCY_BASE + BUOYANCY_GAIN * intensityCurve // -y in screen coords
    const turbulenceAmp = TURBULENCE_BASE + TURBULENCE_GAIN * intensityCurve
    const sizeIntensityScale =
      SIZE_INTENSITY_BASE + SIZE_INTENSITY_GAIN * intensityCurve

    let alive = 0
    for (let i = 0; i < this.liveCount; i++) {
      let age = this.ages[i]
      const maxAge = this.maxAges[i]
      age += dt
      if (age >= maxAge) continue // dead — drop from live list

      const ix = i * 2
      let vx = this.velocities[ix]
      let vy = this.velocities[ix + 1]
      let px = this.positions[ix]
      let py = this.positions[ix + 1]

      const seed = this.seeds[i]
      const t01 = age / maxAge

      // Turbulence — bounded sine of clock + per-particle seed for chaos
      const turbX = Math.sin(this.clock * 4 + seed * 53) * turbulenceAmp * 0.6
      const turbY = Math.cos(this.clock * 3 + seed * 71) * turbulenceAmp * 0.3

      vx = vx * drag + turbX * dt
      // Negative-y is "up" in screen-pixel world coords
      vy = vy * drag - buoyancy * dt + turbY * dt

      px += vx * dt
      py += vy * dt

      // Compact: write the surviving particle into slot `alive`
      const aliveIx = alive * 2
      this.positions[aliveIx] = px
      this.positions[aliveIx + 1] = py
      this.velocities[aliveIx] = vx
      this.velocities[aliveIx + 1] = vy
      this.ages[alive] = age
      this.maxAges[alive] = maxAge
      const baseSize = this.baseSizes[i]
      this.baseSizes[alive] = baseSize
      this.seeds[alive] = seed

      // GPU buffers
      const gp = alive * 3
      this.gpuPositions[gp] = px
      this.gpuPositions[gp + 1] = py
      this.gpuPositions[gp + 2] = 0
      this.gpuSizes[alive] = baseSize * sizeIntensityScale
      this.gpuAge01[alive] = t01

      alive++
    }

    this.liveCount = alive
    this.geometry.setDrawRange(0, alive)
    this.positionAttr.needsUpdate = true
    this.sizeAttr.needsUpdate = true
    this.ageAttr.needsUpdate = true
  }

  // ============================================================
  // Spawning
  // ============================================================

  /** Continuous spawn at the fireball center. Spread/scatter scale with intensity. */
  private spawnContinuous(count: number, intensityCurve: number) {
    const scatter =
      SPAWN_SCATTER_BASE + SPAWN_SCATTER_GAIN * intensityCurve
    const radialSpread =
      SPAWN_RADIAL_SPREAD_BASE + SPAWN_RADIAL_SPREAD_GAIN * intensityCurve

    for (let n = 0; n < count; n++) {
      if (this.liveCount >= MAX_PARTICLES) return

      const i = this.liveCount
      const ix = i * 2

      // Small radial scatter at the spawn point — denser cloud at higher intensity
      const ang = Math.random() * Math.PI * 2
      const r = Math.random() * scatter
      this.positions[ix] = this.centerX + Math.cos(ang) * r
      this.positions[ix + 1] = this.centerY + Math.sin(ang) * r

      // Velocity: upward base + radial spread
      // (No cursor velocity inheritance — cursor speed must NOT influence motion)
      const upward = PARTICLE_BASE_UPWARD + Math.random() * 60
      const vx = (Math.random() - 0.5) * radialSpread
      const vy = -upward + (Math.random() - 0.5) * 30

      this.velocities[ix] = vx
      this.velocities[ix + 1] = vy

      this.ages[i] = 0
      this.maxAges[i] =
        PARTICLE_LIFE_MIN + Math.random() * (PARTICLE_LIFE_MAX - PARTICLE_LIFE_MIN)
      this.baseSizes[i] = PARTICLE_BASE_SIZE + Math.random() * PARTICLE_SIZE_RANGE
      this.seeds[i] = Math.random() * 100

      this.liveCount++
    }
  }

  // ============================================================
  // Resize — update renderer + camera when the canvas (= viewport) resizes
  // ============================================================

  private handleResize = () => {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.camera.right = w
    this.camera.bottom = h
    this.camera.updateProjectionMatrix()
  }
}
