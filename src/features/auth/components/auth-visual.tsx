import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createMorphParticles, projectInitialTornado } from '@/features/auth/lib/particle-morph'
import { useMediaQuery } from '@/features/auth/lib/use-media-query'

const ParticleScene = lazy(() => import('@/features/auth/components/particle-scene').then((module) => ({ default: module.ParticleScene })))

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError = () => ({ failed: true })
  componentDidCatch = () => this.props.onFailure()
  render = () => this.state.failed ? null : this.props.children
}

const StaticParticles = () => {
  const svg = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const particles = useMemo(() => createMorphParticles(), [])
  useEffect(() => {
    if (!svg.current) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height })
    })
    observer.observe(svg.current)
    return () => observer.disconnect()
  }, [])
  const paths = useMemo(() => projectInitialTornado(particles, size.width, size.height), [particles, size.width, size.height])
  return (
    <svg ref={svg} className="auth-static-particles" viewBox={`0 0 ${size.width} ${size.height}`} focusable="false">
      {paths.map((path, index) => <path key={index} d={path} fill={['#b9b5a5', '#e0dbca', '#b9d66f'][index]} opacity={[0.22, 0.46, 0.42][index]} />)}
    </svg>
  )
}

export const AuthVisual = () => {
  const mobile = useMediaQuery('(max-width: 767px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  const onFailure = useCallback(() => { setFailed(true); setReady(false) }, [])

  return (
    <div className="auth-visual" aria-hidden="true">
      {(!ready || failed || mobile) && <StaticParticles />}
      {!mobile && !failed && <SceneBoundary onFailure={onFailure}><Suspense fallback={null}>
        <ParticleScene reducedMotion={reducedMotion} onReady={onReady} onFailure={onFailure} />
      </Suspense></SceneBoundary>}
      <div className="auth-visual-shade" />
    </div>
  )
}
