import type { InitialParticleFormDefinition, ParticlePosition, ParticleSeed } from './types'

// 首屏静态占位与 GPU 的 tornado(seed, 0, age) 采用相同采样。
const sampleInitialPosition = ([height, angleSeed, radiusSeed, partSeed]: ParticleSeed): ParticlePosition => {
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

const tornadoShader = `
ParticleForm tornado(vec4 seed, float time, float age) {
  float height = fract(seed.x + time * 0.075);
  float stream = floor(seed.y * 5.0) / 5.0 * TAU + fract(seed.y * 5.0) * 0.32;
  float angle = (seed.w < 0.82 ? stream : seed.y * TAU) + height * PI * 5.0 + time * (1.25 + (1.0 - height) * 1.5);
  float radius = (0.16 + pow(height, 1.65) * 1.95) * (0.78 + seed.z * 0.22);
  vec3 point = vec3(cos(angle) * radius, height * 4.6 - 2.3, sin(angle) * radius * 0.75);
  point.x += sin(height * 4.0 + time * 0.45) * height * 0.16;
  float visibility = smoothstep(0.0, 0.05, height) * (1.0 - smoothstep(0.92, 1.0, height));
  vec3 color = mix(vec3(0.73, 0.7, 0.59), vec3(0.61, 0.76, 0.22), step(0.975, seed.w));
  return ParticleForm(point, visibility, color);
}
`

export const tornadoForm = {
  id: 'tornado',
  label: '龙卷风',
  holdSeconds: 5.5,
  entryPoint: 'tornado',
  shader: tornadoShader,
  presentation: { scale: 0.9, offset: [0, -0.15], brightness: 1.12 },
  camera: {
    start: { position: [0, 0, 10], target: [0, 0, 0], fov: 48 },
    end: { position: [-2.2, -0.65, 10.1], target: [0, 0.1, 0], fov: 48 },
  },
  sampleInitialPosition,
} as const satisfies InitialParticleFormDefinition
