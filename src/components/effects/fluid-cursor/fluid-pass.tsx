import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { createFluidEngine } from './fluid-engine'
import type { FluidEngine } from './fluid-engine'
import type { FluidCursorOptions } from './types'

type PointerPosition = { x: number; y: number; time: number }

export const FluidPass = ({ enabled = true, backgroundColor, palette, intensity = 1 }: FluidCursorOptions) => {
  const { gl, size } = useThree()
  const engine = useRef<FluidEngine | null>(null)

  useEffect(() => {
    if (!enabled || size.width <= 0 || size.height <= 0) return
    const simulation = createFluidEngine(gl, { width: size.width, height: size.height, backgroundColor, palette, intensity })
    if (!simulation) return
    engine.current = simulation
    let previous: PointerPosition | null = null
    let disposed = false
    const resetPointer = () => { previous = null }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      if (document.hidden || (event.target instanceof Element && event.target.closest('[data-auth-panel], [data-fluid-controls], input, button, a'))) {
        resetPointer()
        return
      }
      const bounds = gl.domElement.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / bounds.width
      const y = 1 - (event.clientY - bounds.top) / bounds.height
      if (x < 0 || x > 1 || y < 0 || y > 1) { resetPointer(); return }
      const current = { x, y, time: event.timeStamp }
      if (!previous) { previous = current; return }
      const elapsed = Math.max(1 / 120, (current.time - previous.time) / 1000)
      // 长时间无事件后重新进入，仅记首位置，防止从旧坐标牵出飞线。
      if (elapsed > 0.2) { previous = current; return }
      const dx = x - previous.x
      const dy = y - previous.y
      if (Math.hypot(dx * bounds.width, dy * bounds.height) < 0.6) return
      const speed = Math.hypot(dx, dy) / elapsed
      const velocityScale = Math.min(1, 2 / Math.max(speed, 0.001))
      simulation.addSplat({
        from: [previous.x, previous.y], to: [x, y],
        velocity: [dx / elapsed * velocityScale, dy / elapsed * velocityScale], speed,
      })
      previous = current
    }
    const release = () => {
      if (disposed) return
      disposed = true
      if (engine.current === simulation) engine.current = null
      simulation.dispose()
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('blur', resetPointer)
    window.addEventListener('focus', resetPointer)
    document.documentElement.addEventListener('pointerenter', resetPointer)
    document.documentElement.addEventListener('pointerleave', resetPointer)
    document.addEventListener('visibilitychange', resetPointer)
    gl.domElement.addEventListener('webglcontextlost', release)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('blur', resetPointer)
      window.removeEventListener('focus', resetPointer)
      document.documentElement.removeEventListener('pointerenter', resetPointer)
      document.documentElement.removeEventListener('pointerleave', resetPointer)
      document.removeEventListener('visibilitychange', resetPointer)
      gl.domElement.removeEventListener('webglcontextlost', release)
      release()
    }
  }, [gl, size.width, size.height, enabled, backgroundColor, palette, intensity])

  // 接管同一个 R3F 循环：先推进模拟，再绘制原场景，最后叠加流体。
  useFrame((state, delta) => {
    engine.current?.step(delta)
    state.gl.setRenderTarget(null)
    state.gl.render(state.scene, state.camera)
    engine.current?.render()
  }, 1)
  return null
}
