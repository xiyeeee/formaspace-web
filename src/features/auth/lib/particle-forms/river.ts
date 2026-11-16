import type { ParticleFormDefinition } from './types'

const riverShader = `
vec3 riverChannelPoint(float along, float across) {
  float width = 0.9 + sin(along * PI) * 0.65;
  float bend = along * TAU - 0.4;
  vec2 bankNormal = normalize(vec2(-cos(bend) * TAU * 1.15, 8.6));
  vec2 channel = vec2((along - 0.5) * 8.6, sin(bend) * 1.15) + bankNormal * across * width;
  return vec3(channel.x, cos(along * TAU) * 0.22 + 0.15, channel.y);
}

float riverSurfaceRipple(float along, float time, float variation) {
  return sin(along * 35.0 - time * 1.8 + variation) * 0.085 + (variation - 0.5) * 0.1;
}

float riverBoatAlong(float index, float time) {
  return fract(0.08 + index * 0.28 + time * 0.03);
}

vec3 riverBoatCenter(float index, float time) {
  float along = riverBoatAlong(index, time);
  vec3 center = riverChannelPoint(along, sin(index * 2.4 + 0.4) * 0.32);
  center.y += riverSurfaceRipple(along, time, 0.5);
  return center;
}

vec3 riverBoatForward(float along) {
  return normalize(vec3(8.6, 0.0, cos(along * TAU - 0.4) * TAU * 1.15));
}

float riverBoatPresence(float along) {
  return smoothstep(0.015, 0.07, along) * (1.0 - smoothstep(0.94, 0.99, along));
}

float riverWaterAroundBoats(vec3 point, float time) {
  float visibility = 1.0;
  for (int boat = 0; boat < 3; boat++) {
    float along = riverBoatAlong(float(boat), time);
    vec3 offset = point - riverBoatCenter(float(boat), time);
    vec3 forward = riverBoatForward(along);
    vec3 beam = cross(forward, vec3(0.0, 1.0, 0.0));
    float footprint = length(vec2(dot(offset, forward) / 0.56, dot(offset, beam) / 0.27));
    float clearance = mix(0.25, 1.0, smoothstep(0.75, 1.25, footprint));
    visibility *= mix(1.0, clearance, riverBoatPresence(along));
  }
  return visibility;
}

ParticleForm riverBoat(vec4 seed, float time) {
  float assignment = (seed.w - 0.76) / 0.24 * 3.0;
  float index = min(floor(assignment), 2.0);
  float part = fract(assignment);
  float along = riverBoatAlong(index, time);
  vec3 center = riverBoatCenter(index, time);
  vec3 forward = riverBoatForward(along);
  vec3 beam = cross(forward, vec3(0.0, 1.0, 0.0));
  vec3 local;
  vec3 color;
  float visibility = 1.2;

  if (part < 0.48) {
    float length = seed.x * 2.0 - 1.0;
    float section = seed.y * PI;
    float width = sqrt(max(1.0 - length * length, 0.0)) * 0.2;
    local = vec3(length * 0.46, 0.08 - sin(section) * 0.18 + pow(abs(length), 3.0) * 0.055, cos(section) * width);
    color = mix(vec3(0.52, 0.3, 0.13), vec3(0.78, 0.59, 0.31), seed.z);
  } else if (part < 0.56) {
    float angle = seed.x * TAU;
    local = vec3(cos(angle) * 0.46, 0.08 + pow(abs(cos(angle)), 3.0) * 0.055, sin(angle) * 0.2);
    color = vec3(0.88, 0.75, 0.5);
  } else if (part < 0.64) {
    local = vec3(-0.035 + (seed.y - 0.5) * 0.014, 0.09 + seed.x * 0.7, 0.0);
    color = vec3(0.72, 0.61, 0.42);
  } else if (part < 0.94) {
    float root = sqrt(seed.x);
    vec3 barycentric = vec3(1.0 - root, root * (1.0 - seed.y), root * seed.y);
    float side = seed.z < 0.6 ? 1.0 : -1.0;
    float width = side > 0.0 ? 0.36 : -0.25;
    local = vec3(-0.035, 0.79, 0.0) * barycentric.x + vec3(-0.035, 0.18, 0.0) * barycentric.y + vec3(width, 0.2, 0.0) * barycentric.z;
    local.z = sin(barycentric.y * PI) * sin(barycentric.z * PI) * 0.08;
    color = mix(vec3(0.88, 0.85, 0.73), vec3(0.77, 0.72, 0.83), index * 0.1);
    visibility = 1.3;
  } else {
    float side = seed.z < 0.5 ? -1.0 : 1.0;
    local = vec3(-0.46 - seed.x * 0.8, 0.015, side * (0.12 + seed.x * 0.24) + (seed.y - 0.5) * 0.03);
    color = vec3(0.61, 0.77, 0.8);
    visibility = (1.0 - seed.x) * 0.55;
  }

  float pitch = cos(along * 35.0 - time * 1.8 + 0.5) * 0.025;
  float roll = sin(time * 1.1 + index) * 0.045;
  local.xy = mat2(cos(pitch), -sin(pitch), sin(pitch), cos(pitch)) * local.xy;
  local.yz = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * local.yz;
  // 抬高船体和帆，船尾水纹仍留在原水面。
  if (part < 0.94) local.y += 0.1;
  vec3 point = center + forward * local.x + vec3(0.0, 1.0, 0.0) * local.y + beam * local.z;
  visibility *= riverBoatPresence(along);
  return ParticleForm(point, visibility, color);
}

ParticleForm river(vec4 seed, float time, float age) {
  if (seed.w >= 0.76) return riverBoat(seed, time);
  float along = fract(seed.x + time * 0.065);
  float across = seed.y * 2.0 - 1.0;
  vec3 point = riverChannelPoint(along, across);
  point.y += riverSurfaceRipple(along, time, seed.z);
  float visibility = smoothstep(0.0, 0.045, along) * (1.0 - smoothstep(0.955, 1.0, along));
  visibility *= riverWaterAroundBoats(point, time);
  float glint = pow(max(cos(across * 18.0 + along * 12.0 - time * 0.8), 0.0), 10.0);
  vec3 color = mix(vec3(0.4, 0.59, 0.66), vec3(0.76, 0.79, 0.68), glint);
  return ParticleForm(point, visibility, color);
}
`

export const riverForm = {
  id: 'river',
  label: '河流与小船',
  holdSeconds: 5.5,
  entryPoint: 'river',
  shader: riverShader,
  presentation: { scale: 1.08, offset: [0, 0.15], brightness: 1.22 },
  camera: {
    start: { position: [5.5, 4.5, 8.2], target: [0, 0.1, 0], fov: 44.5 },
    end: { position: [4.7, 4.1, 8.7], target: [0.2, 0.1, 0], fov: 44.5 },
  },
} as const satisfies ParticleFormDefinition
