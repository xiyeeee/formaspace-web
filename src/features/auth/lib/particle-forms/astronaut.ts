import type { ParticleFormDefinition } from './types'

const astronautShader = `
struct AstronautArmPose {
  vec3 shoulder;
  vec3 elbow;
  vec3 wrist;
  float gloveAngle;
};

vec3 astronautSphereDirection(vec2 sampleSeed) {
  float vertical = sampleSeed.x * 2.0 - 1.0;
  float radius = sqrt(max(1.0 - vertical * vertical, 0.0));
  float angle = sampleSeed.y * TAU;
  return vec3(cos(angle) * radius, vertical, sin(angle) * radius);
}

vec3 astronautEllipsoid(vec3 center, vec3 radii, vec2 sampleSeed) {
  return center + astronautSphereDirection(sampleSeed) * radii;
}

vec3 astronautSleeve(vec3 start, vec3 end, float startRadius, float endRadius, vec2 sampleSeed) {
  vec3 axis = normalize(end - start);
  vec3 reference = abs(axis.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 normal = normalize(cross(axis, reference));
  vec3 tangent = cross(axis, normal);
  float angle = sampleSeed.y * TAU;
  float radius = mix(startRadius, endRadius, sampleSeed.x) * (1.0 + sin(sampleSeed.x * PI) * 0.08);
  return mix(start, end, sampleSeed.x) + (normal * cos(angle) + tangent * sin(angle)) * radius;
}

AstronautArmPose astronautArm(float side, float age) {
  if (side > 0.0) {
    float wave = -0.13 + sin(age * 2.8) * 0.32;
    vec3 shoulder = vec3(0.5, 0.72, 0.0);
    vec3 elbow = vec3(0.98, 1.02, 0.015);
    vec3 wrist = elbow + vec3(sin(wave) * 0.62, cos(wave) * 0.62, 0.06);
    return AstronautArmPose(shoulder, elbow, wrist, wave);
  }
  float drift = sin(age * 0.65) * 0.04;
  return AstronautArmPose(vec3(-0.5, 0.72, 0.0), vec3(-0.84, 0.18, drift), vec3(-0.92, -0.32, 0.08 + drift), PI - 0.1);
}

vec3 astronautGlove(AstronautArmPose arm, vec4 seed) {
  vec3 local;
  if (seed.x < 0.7) {
    local = astronautEllipsoid(vec3(0.0, 0.11, 0.015), vec3(0.17, 0.19, 0.11), vec2(seed.x / 0.7, seed.y));
  } else {
    float finger = floor(seed.y * 4.0);
    float along = (seed.x - 0.7) / 0.3;
    float angle = fract(seed.y * 4.0) * TAU;
    local = vec3((finger - 1.5) * 0.072 + cos(angle) * 0.033, 0.18 + along * (0.19 - abs(finger - 1.5) * 0.025), sin(angle) * 0.04 + 0.02);
  }
  local.xy = mat2(cos(arm.gloveAngle), -sin(arm.gloveAngle), sin(arm.gloveAngle), cos(arm.gloveAngle)) * local.xy;
  return arm.wrist + local;
}

ParticleForm astronautWave(vec4 seed, float time, float age) {
  vec2 surfaceSeed = seed.xy;
  float side = seed.z < 0.5 ? -1.0 : 1.0;
  vec3 point;
  vec3 color = vec3(0.74, 0.78, 0.78);
  float visibility = 1.02;

  if (seed.w >= 0.975) {
    point = vec3((seed.x - 0.5) * 9.0, (seed.y - 0.5) * 5.0, (seed.z - 0.5) * 3.0 - 1.5);
    return ParticleForm(point, 0.13 + sin(age * 0.6 + seed.x * TAU) * 0.035, vec3(0.52, 0.62, 0.73));
  }

  if (seed.w < 0.21) {
    vec3 normal = astronautSphereDirection(surfaceSeed);
    point = vec3(0.0, 1.65, 0.0) + normal * vec3(0.62, 0.61, 0.55);
    float visor = pow(normal.x / 0.86, 2.0) + pow((normal.y - 0.05) / 0.68, 2.0);
    if (normal.z > 0.0 && visor < 1.0) {
      float reflection = pow(max(dot(normal, normalize(vec3(-0.5, 0.7, 1.0))), 0.0), 8.0);
      color = mix(vec3(0.62, 0.35, 0.08), vec3(1.0, 0.82, 0.43), reflection * 0.65 + 0.25);
      visibility = 1.18;
    }
    if (normal.z > 0.0 && abs(visor - 1.0) < 0.13) color = vec3(0.87, 0.87, 0.77);
    if (abs(normal.x) > 0.92) { point.x += sign(normal.x) * 0.045; color = vec3(0.43, 0.56, 0.59); }
  } else if (seed.w < 0.245) {
    float around = seed.x * TAU;
    float section = seed.y * TAU;
    float radius = 0.4 + cos(section) * 0.085;
    point = vec3(cos(around) * radius, 1.05 + sin(section) * 0.085, sin(around) * radius);
    color = vec3(0.45, 0.59, 0.62);
  } else if (seed.w < 0.49) {
    point = astronautEllipsoid(vec3(0.0, 0.2, 0.0), vec3(0.61, 0.86, 0.4), surfaceSeed);
    if (point.z > 0.25 && abs(point.x) < 0.27 && point.y > -0.05 && point.y < 0.48) {
      float border = min(0.27 - abs(point.x), min(point.y + 0.05, 0.48 - point.y));
      color = border < 0.035 ? vec3(0.65, 0.74, 0.71) : vec3(0.12, 0.3, 0.4);
      float light = min(length(point.xy - vec2(-0.12, 0.16)), length(point.xy - vec2(0.1, 0.16)));
      if (light < 0.045) color = vec3(0.69, 0.83, 0.35);
    }
    visibility = 0.96;
  } else if (seed.w < 0.56) {
    vec3 normal = astronautSphereDirection(surfaceSeed);
    vec3 roundedBox = sign(normal) * pow(abs(normal), vec3(0.35));
    point = vec3(0.0, 0.23, -0.48) + roundedBox * vec3(0.5, 0.72, 0.27);
    float rib = pow(abs(sin(point.y * 18.0)), 12.0);
    color = mix(vec3(0.34, 0.45, 0.5), vec3(0.71, 0.75, 0.72), rib * 0.65);
    visibility = 0.83;
  } else if (seed.w < 0.72) {
    AstronautArmPose arm = astronautArm(side, age);
    bool upper = seed.w < 0.64;
    point = upper
      ? astronautSleeve(arm.shoulder, arm.elbow, 0.215, 0.185, surfaceSeed)
      : astronautSleeve(arm.elbow, arm.wrist, 0.185, 0.14, surfaceSeed);
    if (seed.x > 0.84) color = vec3(0.36, 0.56, 0.64);
  } else if (seed.w < 0.78) {
    AstronautArmPose arm = astronautArm(side, age);
    point = astronautGlove(arm, seed);
    color = vec3(0.86, 0.81, 0.7);
    visibility = 1.1;
  } else {
    float drift = sin(age * 0.6 + (side < 0.0 ? PI : 0.0));
    vec3 hip = vec3(side * 0.27, -0.52, 0.0);
    vec3 knee = vec3(side * (0.36 + drift * 0.035), -1.15 + drift * 0.045, 0.18);
    vec3 ankle = vec3(side * 0.45, -1.72 + drift * 0.06, 0.34 + drift * 0.06);
    if (seed.w < 0.855) point = astronautSleeve(hip, knee, 0.215, 0.18, surfaceSeed);
    else if (seed.w < 0.93) point = astronautSleeve(knee, ankle, 0.18, 0.14, surfaceSeed);
    else {
      point = astronautEllipsoid(ankle + vec3(0.0, -0.08, 0.17), vec3(0.23, 0.19, 0.35), surfaceSeed);
      color = point.y < ankle.y - 0.13 ? vec3(0.39, 0.49, 0.53) : vec3(0.76, 0.78, 0.72);
    }
  }

  float tilt = sin(age * 0.45) * 0.045;
  point.xy = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * point.xy;
  float turn = sin(age * 0.3) * 0.09;
  point.xz = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * point.xz;
  point += vec3(-0.3 + sin(age * 0.3) * 0.12, sin(age * 0.8) * 0.09, 0.0);
  return ParticleForm(point, visibility, color);
}
`

export const astronautForm = {
  id: 'astronaut',
  label: '宇航员挥手',
  holdSeconds: 7.5,
  entryPoint: 'astronautWave',
  shader: astronautShader,
  camera: {
    start: { position: [2.5, 1.2, 10.8], target: [0, 0.4, 0], fov: 48.5 },
    end: { position: [3.8, 1.6, 10.4], target: [0, 0.4, 0], fov: 48.5 },
  },
} as const satisfies ParticleFormDefinition
