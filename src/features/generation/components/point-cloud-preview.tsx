import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, Points, PointsMaterial, Vector3 } from 'three'
import { PointCloudWorkers } from './point-cloud-workers'
import { matchPointCloud, POINT_CLOUD_MOVE_SECONDS } from '../lib/realtime/point-cloud-matching'
import type { CloudTransition } from '../lib/realtime/point-cloud-matching'
import type { PointCloud } from '../lib/realtime/generation-events'

type Layer = { taskId: string; version: number; points: Points<BufferGeometry, PointsMaterial>; cursor: number; received: number; total: number; notified: boolean; reportAt: number; reported: number; transition: (CloudTransition & { elapsed: number }) | null }
type Props = { cloud: PointCloud; visible: boolean; printing: boolean; reducedMotion: boolean; normalization: { center: Vector3; scale: number }; onApplied: (version: number) => void; onProgress?: (count: number) => void }
const disposeLayer = (layer: Layer | null) => {
  layer?.points.removeFromParent()
  layer?.points.geometry.dispose()
  layer?.points.material.dispose()
}
const createGeometry = (coordinates: Float32Array) => new BufferGeometry().setAttribute('position', new Float32BufferAttribute(coordinates, 3).setUsage(DynamicDrawUsage))

export const PointCloudPreview = ({ cloud, visible, printing, reducedMotion, normalization, onApplied, onProgress }: Props) => {
  const root = useRef<Group>(null)
  const layer = useRef<Layer | null>(null)
  const { invalidate } = useThree()
  useEffect(() => {
    if (!root.current) return
    if (layer.current && layer.current.taskId !== cloud.taskId) {
      disposeLayer(layer.current)
      layer.current = null
    }
    if (!layer.current) {
      const geometry = createGeometry(new Float32Array(cloud.totalPointCount * 3))
      geometry.setDrawRange(0, 0)
      const points = new Points(geometry, new PointsMaterial({ color: '#cdebc1', size: 0.02, sizeAttenuation: true, transparent: true, opacity: 0.92, depthWrite: false }))
      points.name = 'real-point-print-cloud'
      points.frustumCulled = false
      root.current.add(points)
      layer.current = { taskId: cloud.taskId, version: cloud.version, points, cursor: 0, received: 0, total: cloud.totalPointCount, notified: false, reportAt: 0, reported: -1, transition: null }
    }
    const current = layer.current
    current.points.position.copy(normalization.center).multiplyScalar(normalization.scale)
    current.points.scale.setScalar(normalization.scale)
    if (cloud.version < current.version) return
    if (cloud.version > current.version) {
      // Until all real targets arrive, keep the current cloud printing/visible without using zero-filled slots.
      if (cloud.pointCount !== cloud.totalPointCount) return
      const displayed = Math.min(Math.floor(current.cursor), current.received)
      const coordinates = current.points.geometry.getAttribute('position').array as Float32Array
      const transition = matchPointCloud(coordinates.slice(0, displayed * 3), cloud.positions.subarray(0, cloud.pointCount * 3))
      const previousGeometry = current.points.geometry
      current.points.geometry = createGeometry(transition.from.slice())
      previousGeometry.dispose()
      current.version = cloud.version
      current.total = cloud.totalPointCount
      current.received = cloud.pointCount
      current.cursor = transition.retainedCount
      current.notified = false
      current.reported = -1
      current.transition = transition.retainedCount ? { ...transition, elapsed: 0 } : null
      current.points.geometry.setDrawRange(0, transition.retainedCount)
    } else if (!current.transition) {
      const attribute = current.points.geometry.getAttribute('position')
      // Same-version retries must not replace the reordered target while it is being printed.
      if (cloud.pointCount > current.received) {
        attribute.array.set(cloud.positions.subarray(current.received * 3, cloud.pointCount * 3), current.received * 3)
        attribute.needsUpdate = true
        current.received = cloud.pointCount
      }
    }
    invalidate()
  }, [cloud, normalization, invalidate])
  useEffect(() => () => { disposeLayer(layer.current); layer.current = null }, [])
  useFrame(({ clock }, delta) => {
    const current = layer.current
    if (!current || !visible) return
    const transition = current.transition
    if (transition) {
      transition.elapsed += Math.min(delta, 0.05)
      const progress = !printing || reducedMotion ? 1 : Math.min(1, transition.elapsed / POINT_CLOUD_MOVE_SECONDS)
      const blend = progress * progress * (3 - 2 * progress)
      const attribute = current.points.geometry.getAttribute('position')
      for (let coordinate = 0; coordinate < transition.retainedCount * 3; coordinate++) {
        attribute.array[coordinate] = transition.from[coordinate] + (transition.target[coordinate] - transition.from[coordinate]) * blend
      }
      attribute.needsUpdate = true
      if (progress === 1) {
        attribute.array.set(transition.target)
        current.transition = null
      }
    }
    if (!current.transition) current.cursor = !printing || reducedMotion ? current.received : Math.min(current.received, current.cursor + Math.min(delta, 0.05) * 800)
    const drawn = Math.floor(current.cursor)
    current.points.geometry.setDrawRange(0, drawn)
    if (drawn === current.total && !current.transition && !current.notified) { current.notified = true; onApplied(current.version) }
    if (drawn !== current.reported && (clock.elapsedTime - current.reportAt > 0.1 || drawn === current.total)) {
      current.reported = drawn; current.reportAt = clock.elapsedTime; onProgress?.(drawn)
    }
    if (current.transition || current.cursor < current.received) invalidate()
  })
  return <group visible={visible}><group ref={root}/>{printing && !reducedMotion && <PointCloudWorkers layer={layer} visible={visible}/>}</group>
}
