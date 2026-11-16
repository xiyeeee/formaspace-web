export const particleFormsShader = `
  const float PI = 3.14159265359;
  const float TAU = 6.28318530718;
  struct ParticleForm {
    vec3 point;
    float visibility;
    vec3 color;
  };

  ParticleForm tornado(vec4 seed, float time) {
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

  ParticleForm flower(vec4 seed, float time, float age) {
    float opening = mix(0.18, 1.0, smoothstep(0.8, 5.2, age));
    vec3 point;
    vec3 color;
    if (seed.w < 0.04) {
      float height = seed.x;
      point = vec3(sin(height * 2.5) * 0.12 + (seed.y - 0.5) * 0.055, 0.65 - height * 3.0, -0.25);
      color = vec3(0.39, 0.53, 0.17);
    } else if (seed.w < 0.075) {
      float angle = seed.y * TAU;
      float radius = sqrt(seed.x) * 0.27;
      point = vec3(cos(angle) * radius, 0.65 + sin(angle) * radius * 0.75, 0.3 + seed.z * 0.12);
      color = vec3(0.72, 0.65, 0.27);
    } else {
      float layer = floor(seed.z * 3.0);
      float petals = 8.0 - layer;
      float petal = floor(seed.y * petals);
      float across = fract(seed.y * petals) * 2.0 - 1.0;
      float along = sqrt(seed.x);
      float angle = petal / petals * TAU + layer * 0.34;
      float length = 2.5 - layer * 0.5;
      float width = pow(max(sin(along * PI), 0.0), 0.75) * across * (0.66 - layer * 0.1) * opening;
      float radius = 0.13 + along * length * (0.2 + opening * 0.8);
      float cup = pow(along, 1.6) * (1.0 - opening) * 2.0 + sin(along * PI) * 0.3 + pow(along, 5.0) * 0.22;
      vec2 petalPoint = vec2(cos(angle), sin(angle)) * radius + vec2(-sin(angle), cos(angle)) * width;
      point = vec3(petalPoint.x, petalPoint.y * 0.8 - cup * 0.36 + 0.65, cup + petalPoint.y * 0.25 + layer * 0.1);
      color = mix(vec3(0.8, 0.68, 0.6), vec3(0.61, 0.47, 0.5), layer / 4.0);
    }
    point.z += sin(time * 0.6 + seed.x * 3.0) * 0.025;
    float layer = floor(seed.z * 3.0);
    float petalEdge = smoothstep(0.72, 0.97, abs(fract(seed.y * (8.0 - layer)) * 2.0 - 1.0));
    float tip = smoothstep(0.85, 0.99, seed.x);
    float visibility = seed.w < 0.075 ? 0.75 : 0.6 + max(petalEdge, tip) * 0.8;
    return ParticleForm(point, visibility, color);
  }

  ParticleForm river(vec4 seed, float time) {
    float along = fract(seed.x + time * 0.065);
    float across = seed.y * 2.0 - 1.0;
    float width = 0.4 + sin(along * PI) * 0.35;
    float horizontal = (along - 0.5) * 8.6;
    float vertical = sin(along * TAU * 1.2 - 0.4) * 0.85;
    vec3 point = vec3(horizontal, vertical + across * width * 0.8 + 0.15, cos(along * TAU) * 0.6 + across * width);
    point.y += sin(along * 35.0 - time * 1.8 + seed.z) * 0.06 + (seed.z - 0.5) * 0.065;
    float visibility = smoothstep(0.0, 0.045, along) * (1.0 - smoothstep(0.955, 1.0, along));
    float glint = pow(max(cos(across * 18.0 + along * 12.0 - time * 0.8), 0.0), 10.0);
    vec3 color = mix(vec3(0.4, 0.59, 0.66), vec3(0.76, 0.79, 0.68), glint);
    return ParticleForm(point, visibility, color);
  }

  ParticleForm butterfly(vec4 seed, float time) {
    float side = seed.z < 0.5 ? -1.0 : 1.0;
    vec3 point;
    vec3 color = vec3(0.74, 0.69, 0.62);
    if (seed.w < 0.012) {
      point = vec3(side * (0.08 + seed.x * 0.3), 1.35 + seed.x * 0.65, 0.0);
    } else if (seed.w < 0.055) {
      point = vec3((seed.y - 0.5) * 0.12, seed.x * 3.0 - 1.5, (seed.z - 0.5) * 0.1);
    } else {
      float angle = seed.y * TAU;
      float radius = sqrt(seed.x);
      bool upper = seed.w < 0.72;
      float horizontal = upper
        ? 1.05 + radius * (cos(angle) * 1.03 + max(sin(angle), 0.0) * 0.25)
        : 0.83 + radius * cos(angle) * 0.8;
      float vertical = upper ? 0.7 + radius * sin(angle) * 1.2 : -0.72 + radius * sin(angle) * 0.93;
      float flap = sin(time * 2.0) * 0.42 + 0.12;
      point = vec3(side * horizontal * cos(flap), vertical, horizontal * sin(flap) + sin(vertical * 2.0) * 0.1);
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

  ParticleForm getForm(float kind, vec4 seed, float time, float age) {
    if (kind < 0.5) return tornado(seed, time);
    if (kind < 1.5) return flower(seed, time, age);
    if (kind < 2.5) return river(seed, time);
    return butterfly(seed, time);
  }
`
