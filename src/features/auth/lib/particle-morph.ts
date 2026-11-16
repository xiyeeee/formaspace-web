export const morphTiming = { hold: 5.5, transition: 3, forms: 4 } as const

export const getMorphFrame = (elapsed: number) => {
  const duration = morphTiming.hold + morphTiming.transition
  const segment = Math.floor(elapsed / duration)
  const age = elapsed % duration
  return {
    from: segment % morphTiming.forms,
    to: (segment + 1) % morphTiming.forms,
    progress: Math.max(0, (age - morphTiming.hold) / morphTiming.transition),
    motionTime: segment * morphTiming.hold + Math.min(age, morphTiming.hold),
    fromAge: age + morphTiming.transition,
    toAge: Math.max(0, age - morphTiming.hold),
  }
}

// 与 GPU 的 tornado(seed, 0) 保持一致，加载占位与动画使用同一批初始粒子。
const getInitialTornadoPoint = (height: number, angleSeed: number, radiusSeed: number, partSeed: number) => {
  const streamPosition = angleSeed * 5
  const stream = Math.floor(streamPosition) / 5 * Math.PI * 2 + (streamPosition % 1) * 0.32
  const angle = (partSeed < 0.82 ? stream : angleSeed * Math.PI * 2) + height * Math.PI * 5
  const radius = (0.16 + height ** 1.65 * 1.95) * (0.78 + radiusSeed * 0.22)
  return [
    Math.cos(angle) * radius + Math.sin(height * 4) * height * 0.16,
    height * 4.6 - 2.3,
    Math.sin(angle) * radius * 0.75,
  ]
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
    positions.set(getInitialTornadoPoint(radiusSeed, angleSeed, sideSeed, partSeed), index * 3)
    sizes[index] = 0.65 + random() * 0.6
  })
  return { positions, seeds, sizes }
}

export const projectInitialTornado = (particles: ReturnType<typeof createMorphParticles>, width: number, height: number) => {
  const paths = ['', '', '']
  const viewportHeight = 20 * Math.tan(24 * Math.PI / 180)
  const viewportWidth = viewportHeight * width / height
  const layout = getParticleLayout(viewportWidth, viewportHeight)
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
