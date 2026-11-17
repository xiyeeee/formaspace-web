import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AnimationMixer, BufferGeometry, Float32BufferAttribute, PerspectiveCamera, Points } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useMediaQuery, usePageVisible } from '@/lib/use-media-query'
import { PointCloudPreview } from './point-cloud-preview'
import type { PointCloud } from '../lib/realtime/generation-events'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import type { centerModel } from '../lib/model-resources'

type Props = { cloud?: PointCloud; onPreviewApplied?: (version: number) => void; model?: GLTF; normalization?: ReturnType<typeof centerModel>; grid: boolean; reset: number; onFailure: () => void }
const SceneControls = ({ reset, onFailure }: Pick<Props, 'reset' | 'onFailure'>) => {
  const { camera, gl, invalidate } = useThree()
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    camera.position.set(5, 3, 6.5)
    const controls = new OrbitControls(camera, gl.domElement)
    controls.target.set(0, 0.1, 0)
    controls.minDistance = 2.5
    controls.maxDistance = 18
    controls.enablePan = false
    controls.update()
    controls.addEventListener('change', () => invalidate())
    invalidate()
    const lost = (event: Event) => { event.preventDefault(); onFailure() }
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => { controls.dispose(); gl.domElement.removeEventListener('webglcontextlost', lost) }
  }, [camera, gl, invalidate, reset, onFailure])
  return null
}
const WaitingCloud = ({ reducedMotion }: { reducedMotion: boolean }) => {
  const points = useRef<Points>(null)
  const geometry = useMemo(() => {
    const coordinates = new Float32Array(3800 * 3)
    // 固定低预算曲面，明确作为等待示意，不映射到任务进度。
    for (let index = 0; index < 3800; index++) {
      const angle = index * 2.39996323
      const cross = index / 3800 * Math.PI * 2 * 17
      const radius = 1.45 + Math.cos(cross) * 0.4
      coordinates.set([Math.cos(angle) * radius, Math.sin(cross) * 0.48, Math.sin(angle) * radius], index * 3)
    }
    return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(coordinates, 3))
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(({ clock }) => {
    if (!points.current || reducedMotion) return
    const time = clock.elapsedTime
    points.current.rotation.set(0.22 + Math.sin(time * 0.25) * 0.06, time * 0.055, -0.2)
    points.current.scale.setScalar(1 + Math.sin(time * 0.7) * 0.025)
  })
  return <points ref={points} geometry={geometry} position={[0, 0.5, 0]}><pointsMaterial color="#cde880" size={0.018} transparent opacity={0.62} depthWrite={false}/></points>
}
const LoadedModel = ({ model, normalization, reducedMotion }: Required<Pick<Props, 'model' | 'normalization'>> & { reducedMotion: boolean }) => {
  const mixer = useMemo(() => new AnimationMixer(model.scene), [model])
  useEffect(() => {
    if (!reducedMotion) model.animations.forEach((clip) => mixer.clipAction(clip).play())
    return () => { mixer.stopAllAction(); mixer.uncacheRoot(model.scene) }
  }, [model, mixer, reducedMotion])
  useFrame((_, delta) => { if (!reducedMotion) mixer.update(Math.min(delta, 0.05)) })
  return <group scale={normalization.scale} dispose={null}><group position={normalization.center}><primitive object={model.scene} dispose={null}/></group></group>
}
export const ViewportScene = ({ model, normalization, cloud, onPreviewApplied, grid, reset, onFailure }: Props) => {
  const visible = usePageVisible()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  return <Canvas camera={{ position: [5, 3, 6.5], fov: 40, near: 0.05, far: 100 }} dpr={[1, 1.5]} frameloop={!visible ? 'never' : reducedMotion ? 'demand' : 'always'} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} fallback={null}>
    <ambientLight intensity={1.6}/><hemisphereLight args={['#f4f6e6', '#35393c', 2]}/><directionalLight position={[3, 5, 4]} intensity={3}/><directionalLight position={[-4, 2, -2]} intensity={1.5} color="#dce8ff"/>
    {model && normalization && <LoadedModel model={model} normalization={normalization} reducedMotion={reducedMotion}/>}
    {cloud && normalization && onPreviewApplied && <group scale={normalization.scale}><group position={normalization.center}><PointCloudPreview cloud={cloud} visible={!model} reducedMotion={reducedMotion} onApplied={onPreviewApplied}/></group></group>}
    {!model && !cloud && <WaitingCloud reducedMotion={reducedMotion}/>}
    {grid && <gridHelper args={[30, 60, '#575b55', '#454943']} material-transparent material-opacity={0.35} position={[0, -1.78, 0]}/>}
    <SceneControls reset={reset} onFailure={onFailure}/>
  </Canvas>
}
