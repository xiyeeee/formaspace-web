import { particleFormsShader } from './particle-forms'

export const morphVertexShader = `
  attribute vec4 aSeed;
  attribute float aSize;
  uniform vec2 uFormTimes;
  uniform vec4 uFromFraming;
  uniform vec4 uToFraming;
  uniform float uFrom;
  uniform float uTo;
  uniform float uMorph;
  uniform vec2 uAges;
  uniform float uMotion;
  uniform float uDpr;
  uniform vec2 uPointer;
  varying vec3 vColor;
  varying float vOpacity;
  ${particleFormsShader}
  void main() {
    ParticleForm from = getForm(uFrom, aSeed, uFormTimes.x, uAges.x);
    ParticleForm to = getForm(uTo, aSeed, uFormTimes.y, uAges.y);
    from.point = from.point * uFromFraming.z + vec3(uFromFraming.xy, 0.0);
    to.point = to.point * uToFraming.z + vec3(uToFraming.xy, 0.0);
    from.visibility *= uFromFraming.w;
    to.visibility *= uToFraming.w;
    float progress = smoothstep(aSeed.w * 0.12, 0.88 + aSeed.w * 0.12, uMorph);
    vec3 arc = vec3(sin(aSeed.w * TAU), cos(aSeed.w * TAU), sin(aSeed.y * TAU));
    vec3 point = mix(from.point, to.point, progress) + arc * sin(progress * PI) * 0.36;
    vec4 projected = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
    vec2 delta = projected.xy / projected.w - uPointer;
    float influence = exp(-dot(delta, delta) * 24.0) * uMotion;
    point.xy += delta * influence * 0.1;
    point.z += influence * 0.06;
    vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    vec2 screen = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
    float panelFade = mix(1.0, 0.32, smoothstep(0.65, 0.86, screen.x));
    float depth = clamp((viewPosition.z + 14.0) / 6.0, 0.3, 1.0);
    vOpacity = mix(from.visibility, to.visibility, progress) * depth * (0.45 + aSeed.z * 0.55) * panelFade;
    vColor = mix(from.color, to.color, progress);
    gl_PointSize = clamp(23.0 * aSize * uDpr / -viewPosition.z, 1.0, 3.8);
  }
`

export const morphFragmentShader = `
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    float coverage = 1.0 - smoothstep(0.08, 0.5, length(gl_PointCoord - 0.5));
    float alpha = coverage * vOpacity * 0.92;
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vColor, alpha);
    #include <colorspace_fragment>
  }
`
