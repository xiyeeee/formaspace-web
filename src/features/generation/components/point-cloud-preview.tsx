import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, Points, PointsMaterial, Vector3 } from 'three'
import type { PointCloud } from '../lib/realtime/generation-events'

type Layer = { key: string; points: Points<BufferGeometry, PointsMaterial>; cursor: number; received: number; total: number; notified: boolean; reportAt: number; reported: number }
type Props = { cloud: PointCloud; visible: boolean; printing: boolean; reducedMotion: boolean; normalization: { center: Vector3; scale: number }; onApplied: (version: number) => void; onProgress?: (count: number) => void }
const PrinterRig = ({ head, gantry }: { head: RefObject<Group | null>; gantry: RefObject<Group | null> }) => <group>
  <mesh position={[0, -1.89, 0]}><boxGeometry args={[4.8, 0.16, 4.8]}/><meshStandardMaterial color="#182323" metalness={0.45} roughness={0.7}/></mesh>
  <gridHelper args={[4.5, 20, '#859e59', '#384a39']} position={[0, -1.8, 0]}/>
  {[-2.25, 2.25].flatMap((x) => [-2.25, 2.25].map((z) => <mesh key={`${x}:${z}`} position={[x, 0.25, z]}><boxGeometry args={[0.07, 4.2, 0.07]}/><meshStandardMaterial color="#53615a" metalness={0.7} roughness={0.4} transparent opacity={z > 0 ? 0.2 : 0.8} depthWrite={z <= 0}/></mesh>))}
  {[-2.25, 2.25].map((x) => <mesh key={x} position={[x, 2.35, 0]}><boxGeometry args={[0.14, 0.14, 4.6]}/><meshStandardMaterial color="#71806f" metalness={0.8} roughness={0.35}/></mesh>)}
  <group ref={gantry} name="point-print-gantry">
    <mesh><boxGeometry args={[4.5, 0.12, 0.12]}/><meshStandardMaterial color="#9ca998" metalness={0.8} roughness={0.3}/></mesh>
    <mesh position={[0, -0.065, 0.07]}><boxGeometry args={[4.4, 0.015, 0.015]}/><meshBasicMaterial color="#bff34b"/></mesh>
  </group>
  <group ref={head} name="point-print-head">
    <mesh position={[0, 0.29, 0]}><boxGeometry args={[0.27, 0.25, 0.25]}/><meshStandardMaterial color="#283934" metalness={0.75} roughness={0.3}/></mesh>
    <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.06, 0.06, 0.13, 12]}/><meshStandardMaterial color="#adb9a8" metalness={0.8} roughness={0.25}/></mesh>
    <mesh position={[0, 0.045, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.055, 0.09, 12]}/><meshStandardMaterial color="#d8a44a" metalness={0.65} roughness={0.25}/></mesh>
    <mesh><sphereGeometry args={[0.028, 12, 8]}/><meshBasicMaterial color="#dcff79"/></mesh>
    <pointLight color="#bdff60" intensity={0.65} distance={0.7}/>
  </group>
</group>

export const PointCloudPreview = ({ cloud, visible, printing, reducedMotion, normalization, onApplied, onProgress }: Props) => {
  const root = useRef<Group>(null)
  const head = useRef<Group>(null)
  const gantry = useRef<Group>(null)
  const layer = useRef<Layer | null>(null)
  const { invalidate } = useThree()
  useEffect(() => {
    if (!root.current) return
    const key = `${cloud.taskId}:${cloud.version}`
    if (layer.current?.key !== key) {
      if (layer.current) { layer.current.points.removeFromParent(); layer.current.points.geometry.dispose(); layer.current.points.material.dispose() }
      const positions = new Float32BufferAttribute(new Float32Array(cloud.totalPointCount * 3), 3).setUsage(DynamicDrawUsage)
      const geometry = new BufferGeometry().setAttribute('position', positions)
      geometry.setDrawRange(0, 0)
      const points = new Points(geometry, new PointsMaterial({ color: '#cdebc1', size: 0.02, sizeAttenuation: true, transparent: true, opacity: 0.92, depthWrite: false }))
      points.name = 'real-point-print-cloud'
      points.frustumCulled = false
      root.current.add(points)
      layer.current = { key, points, cursor: 0, received: 0, total: cloud.totalPointCount, notified: false, reportAt: 0, reported: -1 }
    }
    const current = layer.current
    const attribute = current.points.geometry.getAttribute('position')
    attribute.array.set(cloud.positions)
    attribute.needsUpdate = true
    current.received = cloud.pointCount
    current.points.position.copy(normalization.center).multiplyScalar(normalization.scale)
    current.points.scale.setScalar(normalization.scale)
    invalidate()
  }, [cloud, normalization, invalidate])
  useEffect(() => () => {
    if (layer.current) { layer.current.points.removeFromParent(); layer.current.points.geometry.dispose(); layer.current.points.material.dispose(); layer.current = null }
  }, [])
  useFrame(({ clock }, delta) => {
    const current = layer.current
    if (!current || !visible) return
    current.cursor = !printing || reducedMotion ? current.received : Math.min(current.received, current.cursor + Math.min(delta, 0.05) * 800)
    const drawn = Math.floor(current.cursor)
    current.points.geometry.setDrawRange(0, drawn)
    if (drawn === current.total && !current.notified) { current.notified = true; onApplied(cloud.version) }
    if (drawn > 0 && head.current && gantry.current) {
      const positions = current.points.geometry.getAttribute('position').array
      const previous = Math.max(0, drawn - 1)
      const next = Math.min(previous + 1, current.received - 1)
      const fraction = current.cursor >= current.received ? 0 : current.cursor - drawn
      const x = positions[previous * 3] + (positions[next * 3] - positions[previous * 3]) * fraction
      const y = positions[previous * 3 + 1] + (positions[next * 3 + 1] - positions[previous * 3 + 1]) * fraction
      const z = positions[previous * 3 + 2] + (positions[next * 3 + 2] - positions[previous * 3 + 2]) * fraction
      head.current.position.set(x, y, z).add(normalization.center).multiplyScalar(normalization.scale)
      gantry.current.position.set(0, head.current.position.y + 0.4, head.current.position.z)
    }
    if (drawn !== current.reported && (clock.elapsedTime - current.reportAt > 0.1 || drawn === current.total)) {
      current.reported = drawn; current.reportAt = clock.elapsedTime; onProgress?.(drawn)
    }
    if (current.cursor < current.received) invalidate()
  })
  return <group visible={visible}><group ref={root}/>{printing && !reducedMotion && <PrinterRig head={head} gantry={gantry}/>}</group>
}
