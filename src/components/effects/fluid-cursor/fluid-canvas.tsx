import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { FluidPass } from './fluid-pass'
import type { FluidCursorOptions } from './types'
import { usePageVisible } from '@/lib/use-media-query'

const ContextGuard = ({ onFailure }: { onFailure: () => void }) => {
  const { gl } = useThree()
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onFailure() }
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => gl.domElement.removeEventListener('webglcontextlost', lost)
  }, [gl, onFailure])
  return null
}

export const FluidCanvas = ({ onFailure, ...options }: FluidCursorOptions & { onFailure: () => void }) => {
  const visible = usePageVisible()
  return (
    <Canvas dpr={[1, 1.5]} gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
      frameloop={visible ? 'always' : 'never'} fallback={null} style={{ pointerEvents: 'none' }}>
      <ContextGuard onFailure={onFailure} />
      <FluidPass {...options} />
    </Canvas>
  )
}
