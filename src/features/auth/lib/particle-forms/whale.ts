import type { ParticleFormDefinition } from './types'

const whaleShader = `
vec3 whaleTriangle(vec3 first, vec3 second, vec3 third, vec2 sampleSeed) {
  float root = sqrt(sampleSeed.x);
  return first * (1.0 - root) + second * root * (1.0 - sampleSeed.y) + third * root * sampleSeed.y;
}

ParticleForm whale(vec4 seed, float time, float age) {
  vec3 point;
  vec3 color;
  float visibility = 0.9;

  if (seed.w < 0.7) {
    float along = seed.x;
    float angle = seed.y * TAU;
    float profile = pow(max(sin(along * PI), 0.0), 0.38) * (0.22 + smoothstep(0.02, 0.55, along) * 0.75);
    float vertical = sin(angle);
    float bodyHeight = vertical > 0.0 ? 0.82 : 0.67;
    point = vec3(-2.55 + along * 4.85, vertical * profile * bodyHeight + sin(along * PI) * 0.065, cos(angle) * profile * 0.65);
    float belly = 1.0 - smoothstep(-0.65, -0.12, vertical);
    color = mix(vec3(0.5, 0.65, 0.74), vec3(0.8, 0.83, 0.79), belly);
    if (belly > 0.4 && along > 0.45) {
      float pleat = pow(abs(cos(angle * 18.0 + along * 1.2)), 18.0);
      color = mix(color, vec3(0.87, 0.86, 0.75), pleat * 0.4);
    }
    float outline = pow(abs(vertical), 10.0);
    visibility = 0.75 + outline * 0.4 + belly * 0.16;
    if (point.x > 0.75 && abs(point.y + 0.17 - (point.x - 0.8) * 0.04) < 0.022 && abs(point.z) > 0.25) {
      visibility *= 0.35;
    }
    float eyeDistance = length(vec2((point.x - 1.5) / 1.1, point.y - 0.16));
    if (abs(point.z) > 0.35 && eyeDistance < 0.048) {
      visibility *= 0.12;
    } else if (abs(point.z) > 0.35 && eyeDistance < 0.072) {
      color = vec3(0.78, 0.8, 0.72);
      visibility = 1.0;
    }
  } else if (seed.w < 0.84) {
    float side = seed.z < 0.5 ? -1.0 : 1.0;
    float along = sqrt(seed.x);
    float across = seed.y * 2.0 - 1.0;
    float width = pow(max(sin(along * PI), 0.0), 0.7) * 0.21;
    vec3 transverse = normalize(vec3(0.85, 0.0, side * 1.4));
    point = vec3(0.5 - along * 1.4, -0.22 - along * 0.6, side * (0.45 + along * 0.85));
    point += transverse * across * width;
    point.y += sin(time * 0.7 + side * 0.4) * along * 0.12 + (seed.w - 0.77) * 0.12;
    color = mix(vec3(0.38, 0.58, 0.68), vec3(0.8, 0.81, 0.73), smoothstep(-0.2, 0.7, across));
    visibility = side > 0.0 ? 1.0 : 0.52;
  } else if (seed.w < 0.96) {
    float side = seed.z < 0.5 ? -1.0 : 1.0;
    float span = seed.x;
    float chord = 0.08 + pow(max(sin(span * PI), 0.0), 0.75) * 0.42;
    float center = -2.55 - sin(span * PI) * 0.35 - span * 0.25;
    point = vec3(center + (seed.y * 2.0 - 1.0) * chord, sin(span * PI) * 0.04 + (seed.w - 0.9) * 0.12, side * span * 1.45);
    color = mix(vec3(0.35, 0.56, 0.67), vec3(0.78, 0.8, 0.73), smoothstep(0.75, 0.98, abs(seed.y * 2.0 - 1.0)));
    visibility = 0.9 + smoothstep(0.8, 0.98, span) * 0.3;
  } else {
    point = whaleTriangle(vec3(-1.2, 0.5, 0.0), vec3(-0.4, 0.64, 0.0), vec3(-0.93, 0.96, 0.0), seed.xy);
    point.z += (seed.z - 0.5) * 0.065;
    color = vec3(0.4, 0.61, 0.71);
    visibility = 1.05;
  }

  float tail = 1.0 - smoothstep(-2.55, -0.4, point.x);
  point.y += sin(time * 1.35 + point.x * 0.55) * tail * 0.32;
  float roll = sin(time * 0.3) * 0.03;
  point.yz = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * point.yz;
  point += vec3(-0.95 + max(age - 2.0, 0.0) * 0.16, sin(time * 0.5) * 0.06 + 0.25, 0.0);
  return ParticleForm(point, visibility, color);
}
`

export const whaleForm = {
  id: 'whale',
  label: '大鲸鱼',
  holdSeconds: 7.5,
  entryPoint: 'whale',
  shader: whaleShader,
  presentation: { scale: 1.16, offset: [0.6, 0.2], brightness: 1.45 },
  camera: {
    start: { position: [1.8, 4, 11.3], target: [0, 0.15, 0], fov: 49.5 },
    end: { position: [0.6, 3.6, 11.6], target: [0, 0.15, 0], fov: 49.5 },
  },
} as const satisfies ParticleFormDefinition
