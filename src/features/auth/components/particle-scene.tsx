import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Group, ShaderMaterial, Vector2 } from 'three'
import { sampleRibbon } from '@/features/auth/lib/particle-geometry'
import { FluidPass } from '@/components/effects/fluid-cursor/fluid-pass'
import { loginPalette } from '@/components/effects/fluid-cursor/types'
import { usePageVisible } from '@/features/auth/lib/use-media-query'

const vertexShader = `
  attribute vec3 aColor;
  attribute float aSize;
  uniform float uTime;
  uniform float uMotion;
  uniform float uDpr;
  uniform vec2 uPointer;
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    vec3 point = position;
    point.z += sin(position.x * 1.4 + uTime * 0.3) * 0.055 * uMotion;
    vec4 projected = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
    vec2 delta = projected.xy / projected.w - uPointer;
    float influence = exp(-dot(delta, delta) * 26.0) * uMotion;
    point.xy += delta * influence * 0.28;
    point.z += influence * 0.16;
    vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(16.0 * aSize * uDpr / -viewPosition.z, 0.7, 4.2);
    vColor = aColor;
    vDepth = clamp((viewPosition.z + 15.0) / 8.0, 0.25, 1.0);
  }
`
const fragmentShader = `
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float alpha = (1.0 - smoothstep(0.12, 0.5, distanceToCenter)) * vDepth;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(vColor, alpha * 0.86);
  }
`

type SceneProps = { reducedMotion: boolean; onReady: () => void; onFailure: () => void }

const Ribbon = ({ reducedMotion, onFailure }: Pick<SceneProps, 'reducedMotion' | 'onFailure'>) => {
  const group = useRef<Group>(null)
  const material = useRef<ShaderMaterial>(null)
  const pointer = useRef(new Vector2(5, 5))
  const { gl } = useThree()
  const data = useMemo(() => sampleRibbon(), [])
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uMotion: { value: 1 },
    uDpr: { value: 1 }, uPointer: { value: new Vector2(5, 5) },
  }), [])

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (reducedMotion || !(event.target instanceof Element) || event.target.closest('[data-auth-panel]')) {
        pointer.current.set(5, 5)
        return
      }
      pointer.current.set(event.clientX / innerWidth * 2 - 1, -event.clientY / innerHeight * 2 + 1)
    }
    const leave = () => pointer.current.set(5, 5)
    const lost = (event: Event) => { event.preventDefault(); onFailure() }
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
      gl.domElement.removeEventListener('webglcontextlost', lost)
    }
  }, [gl, reducedMotion, onFailure])

  useFrame((state, delta) => {
    if (!material.current || !group.current) return
    const shader = material.current.uniforms
    shader.uMotion.value = reducedMotion ? 0 : 1
    shader.uDpr.value = state.gl.getPixelRatio()
    shader.uTime.value += Math.min(delta, 0.05)
    shader.uPointer.value.lerp(pointer.current, 1 - Math.exp(-delta * 4))
    if (reducedMotion) return
    const targetX = pointer.current.x === 5 ? 0 : pointer.current.x * 0.025
    const targetY = pointer.current.y === 5 ? 0 : pointer.current.y * 0.025
    group.current.rotation.x = 0.65 + Math.sin(shader.uTime.value * 0.12) * 0.035 + targetY
    group.current.rotation.y = -0.35 + Math.sin(shader.uTime.value * 0.09) * 0.05 + targetX
  })

  return (
    <group ref={group} rotation={[0.65, -0.35, -0.45]} position={[-1.35, 0.55, 0]} scale={1.3}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[data.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[data.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
          transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
    </group>
  )
}

export const ParticleScene = ({ reducedMotion, onReady, onFailure }: SceneProps) => {
  const visible = usePageVisible()
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 48 }} dpr={[1, 1.5]}
      frameloop={!visible ? 'never' : reducedMotion ? 'demand' : 'always'}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      fallback={null} onCreated={onReady} style={{ pointerEvents: 'none' }}>
      <Ribbon reducedMotion={reducedMotion} onFailure={onFailure} />
      <FluidPass enabled={!reducedMotion} palette={loginPalette} intensity={1.1} />
    </Canvas>
  )
}
