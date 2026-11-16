import type { ParticleFormDefinition } from './types'

const lotusShader = `
ParticleForm lotus(vec4 seed, float time, float age) {
  vec3 point;
  vec3 color;
  float visibility = 1.0;
  if (seed.w < 0.04) {
    float angle = seed.y * TAU;
    point = vec3(sin(seed.x * 2.4) * 0.08 + cos(angle) * 0.035, 0.5 - seed.x * 2.9, sin(angle) * 0.035);
    color = vec3(0.32, 0.48, 0.17);
    visibility = 0.72;
  } else if (seed.w < 0.085) {
    float angle = mix(0.17, TAU - 0.17, seed.y);
    float radius = sqrt(seed.x);
    point = vec3(0.95 + cos(angle) * radius * 1.25, -1.65 + sin(radius * PI) * 0.15 - radius * 0.05, sin(angle) * radius * 0.95);
    color = mix(vec3(0.27, 0.48, 0.23), vec3(0.53, 0.65, 0.3), pow(abs(cos(angle * 7.0)), 12.0));
    visibility = 0.72;
  } else if (seed.w < 0.115) {
    float angle = seed.y * TAU;
    float radius = sqrt(seed.x) * 0.28;
    point = vec3(cos(angle) * radius, 0.64 + seed.z * 0.11, sin(angle) * radius);
    color = vec3(0.87, 0.68, 0.24);
    visibility = mix(0.15, 1.0, smoothstep(4.4, 7.5, age));
  } else {
    float layer = floor(seed.z * 4.0);
    float petals = 9.0 - layer;
    float petal = floor(seed.y * petals);
    float across = fract(seed.y * petals) * 2.0 - 1.0;
    float along = sqrt(seed.x);
    float angle = petal / petals * TAU + layer * 0.38;
    float length = 2.25 - layer * 0.31;
    float opening = smoothstep(2.8 + layer * 0.55, 7.3 + layer * 0.55, age);
    float profile = pow(max(sin(along * PI), 0.0), 0.8);
    float closedRadius = 0.075 + profile * (0.44 - layer * 0.045);
    float closedHeight = along * length;
    float tilt = 1.4 - layer * 0.22;
    float openRadius = 0.12 + sin(along * tilt) * length;
    float openHeight = along * length * cos(tilt) + sin(along * PI) * 0.3 - pow(along, 3.0) * (0.2 - layer * 0.04);
    float radius = mix(closedRadius, openRadius, opening);
    float height = mix(closedHeight, openHeight, opening);
    float width = profile * across * mix(0.16, 0.72 - layer * 0.09, opening);
    height += across * across * profile * opening * 0.18;
    vec2 petalPoint = vec2(cos(angle), sin(angle)) * radius + vec2(-sin(angle), cos(angle)) * width;
    point = vec3(petalPoint.x, height + 0.5, petalPoint.y + (seed.w - 0.5) * 0.035);
    color = mix(vec3(0.67, 0.36, 0.46), vec3(0.91, 0.72, 0.72), along * 0.65 + layer * 0.08);
    float edge = max(smoothstep(0.73, 0.98, abs(across)), smoothstep(0.9, 0.99, along));
    visibility = 0.55 + edge * 0.75;
  }
  point.x += sin(time * 0.55) * 0.025;
  return ParticleForm(point, visibility, color);
}
`

export const lotusForm = {
  id: 'lotus',
  label: '荷花',
  holdSeconds: 8.5,
  entryPoint: 'lotus',
  shader: lotusShader,
  camera: {
    start: { position: [2, 2.4, 10], target: [0, 0.3, 0], fov: 46.5 },
    end: { position: [0.8, 6.4, 8.4], target: [0, 0.3, 0], fov: 46.5 },
  },
} as const satisfies ParticleFormDefinition
