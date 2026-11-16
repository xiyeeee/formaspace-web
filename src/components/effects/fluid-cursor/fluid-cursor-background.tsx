import { Component, lazy, Suspense, useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { useMediaQuery } from '@/lib/use-media-query'
import type { FluidCursorBackgroundProps } from './types'

const FluidCanvas = lazy(() => import('./fluid-canvas').then((module) => ({ default: module.FluidCanvas })))

class FluidBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError = () => ({ failed: true })
  componentDidCatch = () => this.props.onFailure()
  render = () => this.state.failed ? null : this.props.children
}

export const FluidCursorBackground = ({ enabled = true, backgroundColor = '#f1f2fa', className, ...options }: FluidCursorBackgroundProps) => {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const finePointer = useMediaQuery('(pointer: fine) and (min-width: 768px)')
  const [failed, setFailed] = useState(false)
  const fail = useCallback(() => setFailed(true), [])
  return (
    <div className={className} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundColor }}>
      {enabled && finePointer && !reducedMotion && !failed && <FluidBoundary onFailure={fail}>
        <Suspense fallback={null}><FluidCanvas {...options} backgroundColor={backgroundColor} onFailure={fail} /></Suspense>
      </FluidBoundary>}
    </div>
  )
}
