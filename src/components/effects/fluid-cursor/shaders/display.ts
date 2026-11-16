export const displayShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uDye;
  uniform vec2 uTexel;
  uniform vec2 uPixel;
  uniform vec3 uBackground;
  uniform float uOpaque;
  float heightAt(vec2 uv) {
    vec3 dye = texture2D(uDye, clamp(uv, uTexel * 0.5, 1.0 - uTexel * 0.5)).rgb;
    return max(dye.r, max(dye.g, dye.b));
  }
  void main() {
    vec3 dye = texture2D(uDye, vUv).rgb;
    float height = max(dye.r, max(dye.g, dye.b));
    float left = heightAt(vUv - vec2(uTexel.x, 0.0));
    float right = heightAt(vUv + vec2(uTexel.x, 0.0));
    float bottom = heightAt(vUv - vec2(0.0, uTexel.y));
    float top = heightAt(vUv + vec2(0.0, uTexel.y));
    vec2 gradient = vec2(right - left, top - bottom);
    vec2 direction = gradient / max(length(gradient), 0.00001);
    vec2 dispersion = direction * uPixel * 1.2;
    vec3 dispersed = vec3(texture2D(uDye, vUv + dispersion).r, dye.g, texture2D(uDye, vUv - dispersion).b);
    vec3 tint = clamp(dispersed / max(height, 0.0001), 0.0, 1.0);
    float edge = smoothstep(0.008, 0.13, length(gradient));
    vec3 normal = normalize(vec3(gradient * 26.0, 1.0));
    float phase = dot(normal, normalize(vec3(-0.7, 0.5, 1.0))) * 12.0 + height * 4.0;
    vec3 iridescence = 0.78 + 0.18 * cos(phase + vec3(0.0, 2.0, 4.0));
    vec3 film = mix(tint, iridescence, edge * 0.7);
    film += vec3(0.08, 0.065, 0.035) * pow(max(normal.z, 0.0), 20.0) * edge;
    float alpha = clamp(height * 0.42, 0.0, 0.32) + edge * 0.2;
    alpha *= smoothstep(0.006, 0.04, height);
    gl_FragColor = uOpaque > 0.5
      ? vec4(mix(uBackground, film, alpha), 1.0)
      : vec4(film, alpha * 0.8);
    #include <colorspace_fragment>
  }
`
