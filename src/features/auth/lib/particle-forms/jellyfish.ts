import type { ParticleFormDefinition } from './types'

const jellyfishShader = `
vec3 jellyfishAnchor(float index) {
  if (index < 0.5) return vec3(-2.8, 1.55, 0.3);
  if (index < 1.5) return vec3(-0.4, 1.15, -0.5);
  if (index < 2.5) return vec3(1.85, 1.9, -0.35);
  if (index < 3.5) return vec3(-1.85, -0.6, 0.6);
  if (index < 4.5) return vec3(0.75, -1.0, 0.15);
  return vec3(2.6, 0.05, -0.8);
}

ParticleForm jellyfish(vec4 seed, float time, float age) {
  float index = floor(seed.w * 6.0);
  float part = fract(seed.w * 6.0);
  float variation = fract(sin(index * 127.1 + 2.3) * 43758.5453);
  float phase = time * (1.3 + index * 0.07) + variation * TAU;
  float contraction = pow(max(sin(phase), 0.0), 2.0);
  float bellRadius = 0.74 * (1.0 - contraction * 0.22);
  float bellHeight = 0.58 + contraction * 0.18;
  vec3 point;
  vec3 tint = mix(vec3(0.43, 0.66, 0.78), vec3(0.73, 0.46, 0.71), variation);
  vec3 color = tint;
  float visibility;

  if (part < 0.54) {
    float radius = sqrt(seed.x);
    float angle = seed.y * TAU;
    float edge = smoothstep(0.78, 0.99, radius);
    point = vec3(cos(angle) * radius * bellRadius, sqrt(max(1.0 - radius * radius, 0.0)) * bellHeight - 0.04, sin(angle) * radius * bellRadius);
    point.y += cos(angle * 12.0) * pow(radius, 6.0) * 0.025;
    float ribs = pow(abs(cos(angle * 6.0)), 16.0);
    visibility = 0.35 + ribs * 0.4 + edge * 0.45;
    color = mix(tint, vec3(0.8, 0.83, 0.8), edge * 0.4 + ribs * 0.25);
  } else if (part < 0.68) {
    float angle = seed.x * TAU;
    float radius = bellRadius + (seed.y - 0.5) * 0.025;
    point = vec3(cos(angle) * radius, -0.04 + cos(angle * 12.0) * 0.025 + (seed.z - 0.5) * 0.02, sin(angle) * radius);
    color = mix(tint, vec3(0.84, 0.85, 0.83), 0.7);
    visibility = 1.3;
  } else {
    float tentacle = floor(seed.y * 10.0);
    float angle = tentacle / 10.0 * TAU;
    float along = seed.x;
    float length = 1.25 + sin(tentacle * 1.7 + variation) * 0.27;
    float sway = along * (0.8 + along * 0.2);
    point = vec3(cos(angle) * bellRadius * 0.66, -0.065 - along * length * (0.92 + sin(phase) * 0.08), sin(angle) * bellRadius * 0.66);
    point.x += sin(along * 4.2 - phase * 0.85 + angle) * 0.14 * sway;
    point.z += cos(along * 3.4 - phase * 0.65 + angle) * 0.12 * sway;
    point.x += (fract(seed.y * 10.0) - 0.5) * 0.012;
    color = mix(tint, vec3(0.76, 0.68, 0.81), 0.3);
    visibility = (1.0 - along * 0.68) * 0.95;
  }

  float size = 0.47 + variation * 0.23;
  point *= size;
  float tilt = sin(phase * 0.45 + index) * 0.09;
  point.xy = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * point.xy;
  vec3 anchor = jellyfishAnchor(index);
  point += anchor + vec3(sin(age * 0.35 + index * 1.4) * 0.15, sin(phase - 0.45) * 0.2 + sin(phase * 2.0) * 0.06, cos(age * 0.3 + index) * 0.1);
  return ParticleForm(point, visibility, color);
}
`

export const jellyfishForm = {
  id: 'jellyfish',
  label: '水母群',
  holdSeconds: 8.5,
  entryPoint: 'jellyfish',
  shader: jellyfishShader,
  camera: {
    start: { position: [1.8, 1.5, 11.5], target: [0, 0.35, 0], fov: 50.5 },
    end: { position: [-0.6, 1.3, 11.7], target: [0, 0.35, 0], fov: 50.5 },
  },
} as const satisfies ParticleFormDefinition
