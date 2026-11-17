import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute, Group, Points, PointsMaterial } from 'three'
import type { PointCloud } from '../lib/realtime/generation-events'

type Layer = { points: Points<BufferGeometry, PointsMaterial>; target: number }
type Props = { cloud: PointCloud; visible: boolean; reducedMotion: boolean; onApplied: (version: number) => void }
export const PointCloudPreview = ({ cloud, visible, reducedMotion, onApplied }: Props) => {
  const group = useRef<Group>(null)
  const layers = useRef<Layer[]>([])
  const { invalidate } = useThree()
  useEffect(() => {
    const root = group.current
    if (!root) return
    layers.current.forEach((layer) => { layer.target = 0 })
    while (layers.current.length > 1) {
      const oldest = layers.current.shift()!
      oldest.points.removeFromParent(); oldest.points.geometry.dispose(); oldest.points.material.dispose()
    }
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(cloud.positions, 3))
    const material = new PointsMaterial({ color: '#d5e9d3', size: 0.014, sizeAttenuation: true, transparent: true, opacity: reducedMotion ? 0.88 : 0, depthWrite: false })
    const points = new Points(geometry, material)
    let notified = false
    points.onAfterRender = () => {
      if (!notified && material.opacity > 0) { notified = true; onApplied(cloud.version) }
    }
    root.add(points)
    layers.current.push({ points, target: 0.88 })
    invalidate()
    return () => { const layer = layers.current.find((item) => item.points === points); if (layer) layer.target = 0 }
  }, [cloud, reducedMotion, onApplied, invalidate])
  useEffect(() => {
    const latest = layers.current.at(-1)
    if (latest) latest.target = visible ? 0.88 : 0
    invalidate()
  }, [visible, cloud, invalidate])
  useEffect(() => () => {
    layers.current.forEach(({ points }) => { points.removeFromParent(); points.geometry.dispose(); points.material.dispose() })
    layers.current = []
  }, [])
  useFrame((_, delta) => {
    let animating = false
    layers.current = layers.current.filter((layer) => {
      const material = layer.points.material
      material.opacity = reducedMotion ? layer.target : material.opacity + (layer.target - material.opacity) * (1 - Math.exp(-Math.min(delta, 0.05) * 8))
      if (layer.target === 0 && material.opacity < 0.005) {
        layer.points.removeFromParent(); layer.points.geometry.dispose(); material.dispose()
        return false
      }
      if (Math.abs(material.opacity - layer.target) > 0.005) animating = true
      return true
    })
    if (animating) invalidate()
  })
  return <group ref={group}/>
}
