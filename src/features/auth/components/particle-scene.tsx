import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, ShaderMaterial, Vector2 } from 'three'
import { createMorphParticles, getMorphFrame, getParticleLayout } from '@/features/auth/lib/particle-morph'
import { morphFragmentShader, morphVertexShader } from '@/features/auth/lib/shaders/particle-morph'
import { FluidPass } from '@/components/effects/fluid-cursor/fluid-pass'
import { loginPalette } from '@/components/effects/fluid-cursor/types'
import { usePageVisible } from '@/lib/use-media-query'

type SceneProps = { reducedMotion: boolean; onReady: () => void; onFailure: () => void }

const MorphingParticles = ({ reducedMotion, onFailure }: Pick<SceneProps, 'reducedMotion' | 'onFailure'>) => {
  const material = useRef<ShaderMaterial>(null)
  const pointer = useRef(new Vector2(5, 5))
  const { gl, viewport } = useThree()
  const data = useMemo(() => createMorphParticles(), [])
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uFlowTime: { value: 0 }, uMotion: { value: 1 }, uDpr: { value: 1 },
    uPointer: { value: new Vector2(5, 5) }, uFrom: { value: 0 }, uTo: { value: 1 },
    uMorph: { value: 0 }, uAges: { value: new Vector2(3, 0) },
  }), [])

  useEffect(() => {
    const leave = () => pointer.current.set(5, 5)
    const move = (event: PointerEvent) => {
      if (reducedMotion || !(event.target instanceof Element) || event.target.closest('[data-auth-panel]')) { leave(); return }
      const bounds = gl.domElement.getBoundingClientRect()
      pointer.current.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1)
    }
    const lost = (event: Event) => { event.preventDefault(); onFailure() }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('blur', leave)
    document.documentElement.addEventListener('pointerleave', leave)
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('blur', leave)
      document.documentElement.removeEventListener('pointerleave', leave)
      gl.domElement.removeEventListener('webglcontextlost', lost)
    }
  }, [gl, reducedMotion, onFailure])

  useFrame((state, delta) => {
    if (!material.current) return
    const shader = material.current.uniforms
    shader.uMotion.value = reducedMotion ? 0 : 1
    shader.uDpr.value = state.gl.getPixelRatio()
    if (!reducedMotion) shader.uTime.value += Math.min(delta, 0.05)
    const frame = getMorphFrame(shader.uTime.value)
    shader.uFlowTime.value = frame.motionTime
    shader.uFrom.value = frame.from
    shader.uTo.value = frame.to
    shader.uMorph.value = frame.progress
    shader.uAges.value.set(frame.fromAge, frame.toAge)
    shader.uPointer.value.lerp(pointer.current, 1 - Math.exp(-delta * 4))
  })

  const layout = getParticleLayout(viewport.width, viewport.height)
  return (
    <group position={[layout.horizontal, layout.vertical, 0]} scale={layout.scale}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[data.seeds, 4]} />
          <bufferAttribute attach="attributes-aSize" args={[data.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial ref={material} uniforms={uniforms} vertexShader={morphVertexShader} fragmentShader={morphFragmentShader}
          transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
    </group>
  )
}

const FirstFrameReady = ({ onReady }: { onReady: () => void }) => {
  const notified = useRef(false)
  useFrame(() => {
    if (notified.current) return
    notified.current = true
    onReady()
  }, 2)
  return null
}

export const ParticleScene = ({ reducedMotion, onReady, onFailure }: SceneProps) => {
  const visible = usePageVisible()
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 48 }} dpr={[1, 1.5]}
      frameloop={!visible ? 'never' : reducedMotion ? 'demand' : 'always'}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      fallback={null} style={{ pointerEvents: 'none' }}>
      <MorphingParticles reducedMotion={reducedMotion} onFailure={onFailure} />
      <FluidPass enabled={!reducedMotion} palette={loginPalette} intensity={0.3} />
      <FirstFrameReady onReady={onReady} />
    </Canvas>
  )
}
