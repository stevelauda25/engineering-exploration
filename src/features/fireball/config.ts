// ============================================================
// Slider — used by drag math (Figma layout values hardcoded in JSX)
// ============================================================
export const SLIDER_KNOB_WIDTH = 40
export const SLIDER_TRAVEL = 200 // SLIDER_WIDTH (240) - SLIDER_KNOB_WIDTH (40)

// ============================================================
// Slider drag smoothing + inertia (SliderController)
// ============================================================
// Higher = snappier knob follow (less lag behind cursor)
export const DRAG_LERP_RATE = 12
// Higher = inertia stops faster after release
export const INERTIA_DECAY_RATE = 5
// Velocity below this clamps to 0
export const VELOCITY_EPSILON = 0.5
// Pulse-on-quick-increase trigger threshold (units/sec, positive only)
export const PULSE_VELOCITY_THRESHOLD = 220
// Cooldown between pulses (seconds)
export const PULSE_COOLDOWN = 0.32

// ============================================================
// Idle position offset from viewport center
// Matches the Figma fire icon position: centered horizontally, 42 px above
// vertical center (because the icon sits above the slider in the layout).
// ============================================================
export const IDLE_OFFSET_Y = -42

// ============================================================
// Camera (orthographic — pixels-to-world)
// ============================================================
export const CAMERA_NEAR = 1
export const CAMERA_FAR = 100
export const CAMERA_Z = 10

// ============================================================
// Particle system
// ============================================================
export const MAX_PARTICLES = 2000
export const SPAWN_RATE_MIN = 250 // particles/sec at intensity 0
export const SPAWN_RATE_MAX = 1800 // particles/sec at intensity 100
export const PARTICLE_LIFE_MIN = 0.55
export const PARTICLE_LIFE_MAX = 1.2
export const PARTICLE_BASE_SIZE = 12 // CSS pixels
export const PARTICLE_SIZE_RANGE = 22
export const PARTICLE_BASE_UPWARD = 130 // initial upward speed (px/sec)
export const PARTICLE_DRAG_RATE = 1.0 // velocity decay per second (lower → flies farther)

// ============================================================
// Per-intensity scaling
// All "intensity-driven" values use a power curve so 0–50 stays subtle and
// 50–100 explodes. Tune INTENSITY_POWER to change the dramatic-ness.
// ============================================================
export const INTENSITY_POWER = 1.8

// Per-particle size multiplier (applied to baseSize each frame)
export const SIZE_INTENSITY_BASE = 0.45
export const SIZE_INTENSITY_GAIN = 1.95

// Buoyancy — upward acceleration in -y world direction (px/sec²)
export const BUOYANCY_BASE = 50
export const BUOYANCY_GAIN = 230

// Turbulence amplitude (chaos)
export const TURBULENCE_BASE = 8
export const TURBULENCE_GAIN = 122

// Spawn radial scatter — initial position offset from center (px)
export const SPAWN_SCATTER_BASE = 3
export const SPAWN_SCATTER_GAIN = 22

// Spawn radial spread — initial sideways velocity range (px/sec)
export const SPAWN_RADIAL_SPREAD_BASE = 10
export const SPAWN_RADIAL_SPREAD_GAIN = 120

// Shader alpha multiplier — soft glow at 0, vivid at 100
export const SHADER_ALPHA_BASE = 0.3
export const SHADER_ALPHA_GAIN = 0.7

// ============================================================
// Cursor follow
// ============================================================
// Higher = snappier follow, lower = laggier "natural" feel
export const CURSOR_FOLLOW_LERP = 4.8

// ============================================================
// Intensity smoothing (controller → renderer)
// ============================================================
export const INTENSITY_LERP_RATE = 6
export const INITIAL_INTENSITY = 0
