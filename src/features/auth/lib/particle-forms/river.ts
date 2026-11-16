import type { ParticleFormDefinition } from './types'

const riverShader = `
ParticleForm river(vec4 seed, float time, float age) {
  float along = fract(seed.x + time * 0.065);
  float across = seed.y * 2.0 - 1.0;
  float width = 0.9 + sin(along * PI) * 0.65;
  float horizontal = (along - 0.5) * 8.6;
  float bend = along * TAU - 0.4;
  float depth = sin(bend) * 1.15;
  vec2 bankNormal = normalize(vec2(-cos(bend) * TAU * 1.15, 8.6));
  vec2 channel = vec2(horizontal, depth) + bankNormal * across * width;
  vec3 point = vec3(channel.x, cos(along * TAU) * 0.22 + 0.15, channel.y);
  point.y += sin(along * 35.0 - time * 1.8 + seed.z) * 0.085 + (seed.z - 0.5) * 0.1;
  float visibility = smoothstep(0.0, 0.045, along) * (1.0 - smoothstep(0.955, 1.0, along));
  float glint = pow(max(cos(across * 18.0 + along * 12.0 - time * 0.8), 0.0), 10.0);
  vec3 color = mix(vec3(0.4, 0.59, 0.66), vec3(0.76, 0.79, 0.68), glint);
  return ParticleForm(point, visibility, color);
}
`

export const riverForm = {
  id: 'river',
  label: '河流',
  holdSeconds: 5.5,
  entryPoint: 'river',
  shader: riverShader,
  camera: {
    start: { position: [5.5, 3, 8.2], target: [0, 0.1, 0], fov: 44.5 },
    end: { position: [4.7, 2.7, 8.7], target: [0.2, 0.1, 0], fov: 44.5 },
  },
} as const satisfies ParticleFormDefinition
