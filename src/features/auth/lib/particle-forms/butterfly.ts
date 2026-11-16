import type { ParticleFormDefinition } from './types'

const butterflyShader = `
ParticleForm butterflyShape(vec4 seed, float time) {
  float side = seed.z < 0.5 ? -1.0 : 1.0;
  vec3 point;
  vec3 color = vec3(0.74, 0.69, 0.62);
  if (seed.w < 0.012) {
    point = vec3(side * (0.08 + seed.x * 0.3), 1.35 + seed.x * 0.65, 0.0);
  } else if (seed.w < 0.055) {
    point = vec3((seed.y - 0.5) * 0.12, seed.x * 3.0 - 1.5, (seed.z - 0.5) * 0.16);
  } else {
    float angle = seed.y * TAU;
    float radius = sqrt(seed.x);
    bool upper = seed.w < 0.72;
    float horizontal = upper
      ? 1.05 + radius * (cos(angle) * 1.03 + max(sin(angle), 0.0) * 0.25)
      : 0.83 + radius * cos(angle) * 0.8;
    float vertical = upper ? 0.7 + radius * sin(angle) * 1.2 : -0.72 + radius * sin(angle) * 0.93;
    float flap = sin(time * 2.6) * 0.85 + 0.18;
    point = vec3(side * horizontal * cos(flap), vertical, horizontal * sin(flap) + sin(vertical * 2.0) * 0.1 + cos(angle) * sin(radius * PI) * 0.22 + (seed.w - 0.5) * 0.045);
    float vein = pow(abs(cos(angle * 5.0 + radius * 2.0)), 18.0);
    color = mix(vec3(0.59, 0.51, 0.68), vec3(0.83, 0.78, 0.63), vein * 0.8);
    if (radius > 0.94) color = mix(color, vec3(0.57, 0.74, 0.25), 0.5);
  }
  point.y += sin(time * 0.8) * 0.035;
  float edge = smoothstep(0.82, 0.98, sqrt(seed.x));
  float veins = pow(abs(cos(seed.y * TAU * 5.0 + sqrt(seed.x) * 2.0)), 18.0);
  float visibility = seed.w < 0.055 ? 1.0 : 0.55 + max(edge, veins) * 0.85;
  return ParticleForm(point, visibility, color);
}

ParticleForm butterfly(vec4 seed, float time, float age) {
  float index = floor(seed.w * 5.0);
  vec4 localSeed = vec4(seed.xyz, fract(seed.w * 5.0));
  float flapTime = time * (1.25 + index * 0.075) + index * 0.87;
  ParticleForm form = butterflyShape(localSeed, flapTime);
  float size = 0.33 + (0.5 + 0.5 * sin(index * 2.3 + 1.0)) * 0.19;
  // 原形体蝶身沿 Y、双翼沿 X；转为蝶头沿飞行方向、双翼在水平面展开。
  vec3 point = vec3(form.point.y, form.point.z, form.point.x) * size;
  float bank = sin(age * 0.8 + index * 1.4) * 0.12;
  point.yz = mat2(cos(bank), -sin(bank), sin(bank), cos(bank)) * point.yz;
  vec3 forward = normalize(vec3(1.05, cos(age * 0.75 + index * 1.6) * 0.18, cos(age * 0.6 + index) * 0.09));
  vec3 wingAxis = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 upAxis = cross(wingAxis, forward);
  point = forward * point.x + upAxis * point.y + wingAxis * point.z;
  float horizontal = -4.5 + (age - 1.0) * 1.05 - index * 1.0;
  float vertical = 0.8 + sin(index * 2.4) * 1.25 + sin(age * 0.75 + index * 1.6) * 0.24;
  float depth = sin(index * 1.9) * 0.85 + sin(age * 0.6 + index) * 0.15;
  point += vec3(horizontal, vertical, depth);
  float visibility = form.visibility * smoothstep(-6.1, -4.3, horizontal) * (1.0 - smoothstep(5.5, 7.0, horizontal));
  vec3 color = mix(form.color, vec3(0.73, 0.56, 0.77), (0.5 + sin(index * 1.7) * 0.5) * 0.2);
  return ParticleForm(point, visibility, color);
}
`

export const butterflyForm = {
  id: 'butterfly',
  label: '蝴蝶群',
  holdSeconds: 7.5,
  entryPoint: 'butterfly',
  shader: butterflyShader,
  camera: {
    start: { position: [-1.8, 1.35, 11.4], target: [0.2, 1.1, 0], fov: 49.5 },
    end: { position: [-0.6, 1.45, 11.3], target: [0.5, 1.1, 0], fov: 49.5 },
  },
} as const satisfies ParticleFormDefinition
