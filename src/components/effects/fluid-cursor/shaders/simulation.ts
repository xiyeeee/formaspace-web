export const fullscreenVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const sampling = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uTexel;
  vec2 bounded(vec2 uv, vec2 texel) {
    return clamp(uv, texel * 0.5, 1.0 - texel * 0.5);
  }
  vec4 sampleAt(sampler2D field, vec2 uv) {
    return texture2D(field, bounded(uv, uTexel));
  }
  // 手动双线性采样，不依赖浮点纹理的线性过滤扩展。
  vec4 bilinear(sampler2D field, vec2 uv, vec2 texel) {
    vec2 pixel = bounded(uv, texel) / texel - 0.5;
    vec2 base = floor(pixel);
    vec2 fraction = fract(pixel);
    vec2 center = (base + 0.5) * texel;
    return mix(
      mix(texture2D(field, bounded(center, texel)), texture2D(field, bounded(center + vec2(texel.x, 0.0), texel)), fraction.x),
      mix(texture2D(field, bounded(center + vec2(0.0, texel.y), texel)), texture2D(field, bounded(center + texel, texel)), fraction.x),
      fraction.y
    );
  }
`

export const advectionShader = `${sampling}
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 uSourceTexel;
  uniform float uDt;
  uniform float uDecay;
  void main() {
    vec2 velocity = bilinear(uVelocity, vUv, uTexel).xy;
    vec2 previous = vUv - velocity * uDt;
    gl_FragColor = bilinear(uSource, previous, uSourceTexel) * exp(-uDecay * uDt);
  }
`

export const splatShader = `${sampling}
  uniform sampler2D uSource;
  uniform vec2 uFrom;
  uniform vec2 uTo;
  uniform vec2 uVelocity;
  uniform vec2 uAspect;
  uniform vec3 uColor;
  uniform float uRadius;
  uniform float uAmount;
  uniform float uMode;
  void main() {
    vec2 segment = (uTo - uFrom) * uAspect;
    vec2 relative = (vUv - uFrom) * uAspect;
    float along = clamp(dot(relative, segment) / max(dot(segment, segment), 0.0000001), 0.0, 1.0);
    vec2 distanceToPath = relative - segment * along;
    float influence = exp(-dot(distanceToPath, distanceToPath) / (uRadius * uRadius));
    vec3 previous = texture2D(uSource, vUv).rgb;
    vec3 result = uMode < 0.5
      ? vec3(clamp(previous.xy + uVelocity * influence, vec2(-2.0), vec2(2.0)), 0.0)
      : min(previous + uColor * influence * uAmount, vec3(2.5));
    gl_FragColor = vec4(result, 1.0);
  }
`

export const curlShader = `${sampling}
  uniform sampler2D uVelocity;
  void main() {
    float left = sampleAt(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
    float right = sampleAt(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
    float bottom = sampleAt(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
    float top = sampleAt(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
    gl_FragColor = vec4((right - left) / (2.0 * uTexel.x) - (top - bottom) / (2.0 * uTexel.y), 0.0, 0.0, 1.0);
  }
`

export const vorticityShader = `${sampling}
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float uDt;
  void main() {
    float left = abs(sampleAt(uCurl, vUv - vec2(uTexel.x, 0.0)).x);
    float right = abs(sampleAt(uCurl, vUv + vec2(uTexel.x, 0.0)).x);
    float bottom = abs(sampleAt(uCurl, vUv - vec2(0.0, uTexel.y)).x);
    float top = abs(sampleAt(uCurl, vUv + vec2(0.0, uTexel.y)).x);
    vec2 gradient = vec2((right - left) / uTexel.x, (top - bottom) / uTexel.y);
    gradient /= max(length(gradient), 0.0001);
    float curl = texture2D(uCurl, vUv).x;
    vec2 force = vec2(gradient.y, -gradient.x) * clamp(curl, -80.0, 80.0) * 0.018;
    vec2 velocity = texture2D(uVelocity, vUv).xy + force * uDt;
    gl_FragColor = vec4(clamp(velocity, vec2(-2.0), vec2(2.0)), 0.0, 1.0);
  }
`

export const divergenceShader = `${sampling}
  uniform sampler2D uVelocity;
  void main() {
    vec2 center = texture2D(uVelocity, vUv).xy;
    float left = sampleAt(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
    float right = sampleAt(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
    float bottom = sampleAt(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
    float top = sampleAt(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
    if (vUv.x < uTexel.x) left = -center.x;
    if (vUv.x > 1.0 - uTexel.x) right = -center.x;
    if (vUv.y < uTexel.y) bottom = -center.y;
    if (vUv.y > 1.0 - uTexel.y) top = -center.y;
    float divergence = (right - left) / (2.0 * uTexel.x) + (top - bottom) / (2.0 * uTexel.y);
    gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
  }
`

export const pressureShader = `${sampling}
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  void main() {
    float left = sampleAt(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
    float right = sampleAt(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
    float bottom = sampleAt(uPressure, vUv - vec2(0.0, uTexel.y)).x;
    float top = sampleAt(uPressure, vUv + vec2(0.0, uTexel.y)).x;
    vec2 squared = uTexel * uTexel;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = ((left + right) * squared.y + (bottom + top) * squared.x - divergence * squared.x * squared.y)
      / (2.0 * (squared.x + squared.y));
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`

export const projectionShader = `${sampling}
  uniform sampler2D uVelocity;
  uniform sampler2D uPressure;
  void main() {
    float left = sampleAt(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
    float right = sampleAt(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
    float bottom = sampleAt(uPressure, vUv - vec2(0.0, uTexel.y)).x;
    float top = sampleAt(uPressure, vUv + vec2(0.0, uTexel.y)).x;
    vec2 gradient = vec2((right - left) / (2.0 * uTexel.x), (top - bottom) / (2.0 * uTexel.y));
    vec2 velocity = texture2D(uVelocity, vUv).xy - gradient;
    if (vUv.x < uTexel.x || vUv.x > 1.0 - uTexel.x) velocity.x = 0.0;
    if (vUv.y < uTexel.y || vUv.y > 1.0 - uTexel.y) velocity.y = 0.0;
    gl_FragColor = vec4(clamp(velocity, vec2(-2.0), vec2(2.0)), 0.0, 1.0);
  }
`
