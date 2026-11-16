import { Component, lazy, Suspense, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { projectRibbon, sampleRibbon } from '@/features/auth/lib/particle-geometry'
import { useMediaQuery } from '@/features/auth/lib/use-media-query'

const ParticleScene = lazy(() => import('@/features/auth/components/particle-scene').then((module) => ({ default: module.ParticleScene })))

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError = () => ({ failed: true })
  componentDidCatch = () => this.props.onFailure()
  render = () => this.state.failed ? null : this.props.children
}

const StaticRibbon = () => {
  const paths = useMemo(() => projectRibbon(sampleRibbon(180, 30).positions), [])
  return (
    <svg className="auth-static-ribbon" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" focusable="false">
      {paths.map((path, index) => <path key={index} d={path} fill={['#897e66', '#e6dcc6', '#cbf53a'][index]} opacity={[0.45, 0.8, 0.85][index]} />)}
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
      {(!ready || failed || mobile) && <StaticRibbon />}
      {!mobile && !failed && <SceneBoundary onFailure={onFailure}><Suspense fallback={null}>
        <ParticleScene reducedMotion={reducedMotion} onReady={onReady} onFailure={onFailure} />
      </Suspense></SceneBoundary>}
      <div className="auth-visual-shade" />
      <div className="auth-visual-annotation"><span className="auth-cross">+</span><span>POINT CLOUD<span className="auth-annotation-line" /><small>FORM / LIGHT / POSSIBILITY</small></span></div>
      <span className="auth-material-label">IMAGINATION, IN DIMENSION</span>
    </div>
  )
}
