import { initialParticleForm, particleForms } from './particle-forms'

export const morphTiming = {
  holds: particleForms.map((form) => form.holdSeconds),
  transition: 3,
  forms: particleForms.length,
} as const

let stageStart = 0
let flowStart = 0
const stages = morphTiming.holds.map((hold, index) => {
  const stage = { index, hold, start: stageStart, end: stageStart + hold + morphTiming.transition, flowStart }
  stageStart = stage.end
  flowStart += hold
  return stage
})
const cycleDuration = stageStart
const cycleFlowDuration = flowStart

export const getMorphFrame = (elapsed: number) => {
  const cycle = Math.floor(elapsed / cycleDuration)
  const cycleAge = elapsed % cycleDuration
  const stage = stages.find((item) => cycleAge < item.end) ?? stages[0]
  const age = cycleAge - stage.start
  return {
    from: stage.index,
    to: (stage.index + 1) % morphTiming.forms,
    progress: Math.max(0, (age - stage.hold) / morphTiming.transition),
    holdProgress: Math.min(age / stage.hold, 1),
    motionTime: cycle * cycleFlowDuration + stage.flowStart + Math.min(age, stage.hold),
    fromAge: age + morphTiming.transition,
    toAge: Math.max(0, age - stage.hold),
  }
}

export const getParticleViewport = (width: number, height: number) => {
  const viewportHeight = 20 * Math.tan(24 * Math.PI / 180)
  return { width: viewportHeight * width / height, height: viewportHeight }
}

export const getParticleLayout = (viewportWidth: number, viewportHeight: number) => ({
  horizontal: -viewportWidth * 0.08,
  vertical: 0.15,
  scale: Math.min(viewportWidth / 9.8, viewportHeight / 6.5),
})

export const createMorphParticles = (count = 10_500) => {
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count * 4)
  const sizes = new Float32Array(count)
  let randomState = 20261116
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
    return randomState / 4294967296
  }
  Array.from({ length: count }).forEach((_, index) => {
    const radiusSeed = random()
    const angleSeed = random()
    const sideSeed = random()
    const partSeed = random()
    seeds.set([radiusSeed, angleSeed, sideSeed, partSeed], index * 4)
    positions.set(initialParticleForm.sampleInitialPosition([radiusSeed, angleSeed, sideSeed, partSeed]), index * 3)
    sizes[index] = 0.65 + random() * 0.6
  })
  return { positions, seeds, sizes }
}

export const projectInitialTornado = (particles: ReturnType<typeof createMorphParticles>, width: number, height: number) => {
  const paths = ['', '', '']
  const viewport = getParticleViewport(width, height)
  const viewportHeight = viewport.height
  const layout = getParticleLayout(viewport.width, viewport.height)
  Array.from({ length: particles.positions.length / 3 }).forEach((_, index) => {
    const offset = index * 3
    const worldX = particles.positions[offset] * layout.scale + layout.horizontal
    const worldY = particles.positions[offset + 1] * layout.scale + layout.vertical
    const worldZ = particles.positions[offset + 2] * layout.scale
    const perspective = 10 / (10 - worldZ)
    const horizontal = (width / 2 + worldX * perspective * height / viewportHeight).toFixed(1)
    const vertical = (height / 2 - worldY * perspective * height / viewportHeight).toFixed(1)
    const size = Math.max(0.6, 23 * particles.sizes[index] / (10 - worldZ) * 0.55).toFixed(1)
    const heightSeed = particles.seeds[index * 4]
    if (heightSeed < 0.025 || heightSeed > 0.975) return
    const group = particles.seeds[index * 4 + 3] > 0.975 ? 2 : worldZ > 0 ? 1 : 0
    paths[group] += `M${horizontal},${vertical}h${size}v${size}h-${size}z`
  })
  return paths
}
