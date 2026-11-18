import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, Points, PointsMaterial, Vector3 } from 'three'
import { PointCloudWorkers } from './point-cloud-workers'
import type { PointCloud } from '../lib/realtime/generation-events'

type Layer = { key: string; points: Points<BufferGeometry, PointsMaterial>; cursor: number; received: number; total: number; notified: boolean; reportAt: number; reported: number }
const disposeLayer = (layer: Layer | null) => {
  layer?.points.removeFromParent()
  layer?.points.geometry.dispose()
  layer?.points.material.dispose()
}
type Props = { cloud: PointCloud; visible: boolean; printing: boolean; reducedMotion: boolean; normalization: { center: Vector3; scale: number }; onApplied: (version: number) => void; onProgress?: (count: number) => void }

export const PointCloudPreview = ({ cloud, visible, printing, reducedMotion, normalization, onApplied, onProgress }: Props) => {
  const root = useRef<Group>(null)
  const layer = useRef<Layer | null>(null)
  const previousLayer = useRef<Layer | null>(null)
  const { invalidate } = useThree()
  useEffect(() => {
    if (!root.current) return
    const key = `${cloud.taskId}:${cloud.version}`
    if (layer.current?.key !== key) {
      disposeLayer(previousLayer.current)
      previousLayer.current = layer.current?.key.startsWith(`${cloud.taskId}:`) ? layer.current : null
      if (!previousLayer.current) disposeLayer(layer.current)
      if (previousLayer.current) previousLayer.current.points.material.opacity = 0.92
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
    ;[layer.current, previousLayer.current].forEach(disposeLayer)
    layer.current = null
    previousLayer.current = null
  }, [])
  useFrame(({ clock }, delta) => {
    const current = layer.current
    if (!current || !visible) return
    current.cursor = !printing || reducedMotion ? current.received : Math.min(current.received, current.cursor + Math.min(delta, 0.05) * 800)
    const drawn = Math.floor(current.cursor)
    current.points.geometry.setDrawRange(0, drawn)
    const previous = previousLayer.current
    if (previous) {
      // Retain the previous real cloud until the next version has visibly replaced it.
      const blend = reducedMotion || !printing ? 1 : Math.min(1, drawn / Math.min(current.total, 1000))
      previous.points.material.opacity = 0.92 * (1 - blend)
      current.points.material.opacity = 0.92 * (0.35 + blend * 0.65)
      if (blend === 1) {
        disposeLayer(previous)
        previousLayer.current = null
      }
    }
    if (drawn === current.total && !current.notified) { current.notified = true; onApplied(cloud.version) }
    if (drawn !== current.reported && (clock.elapsedTime - current.reportAt > 0.1 || drawn === current.total)) {
      current.reported = drawn; current.reportAt = clock.elapsedTime; onProgress?.(drawn)
    }
    if (current.cursor < current.received) invalidate()
  })
  return <group visible={visible}><group ref={root}/>{printing && !reducedMotion && <PointCloudWorkers layer={layer}/>}</group>
}
