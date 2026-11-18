import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute, Group, Points, PointsMaterial, Vector3 } from 'three'

type WorkerLayer = { points: Points<BufferGeometry, PointsMaterial>; cursor: number; received: number }
type Props = { layer: RefObject<WorkerLayer | null> }
const WORKER_COUNT = 3
const UP = new Vector3(0, 1, 0)

const createRobotGeometry = () => {
  const positions: number[] = []
  const colors: number[] = []
  const parts = [
    { center: [0, 0.16, 0], size: [0.24, 0.19, 0.18] },
    { center: [0, -0.06, 0], size: [0.18, 0.18, 0.14] },
    { center: [-0.15, -0.05, 0], size: [0.06, 0.17, 0.07] },
    { center: [0.15, -0.05, 0], size: [0.06, 0.17, 0.07] },
    { center: [-0.055, -0.21, 0], size: [0.065, 0.1, 0.075] },
    { center: [0.055, -0.21, 0], size: [0.065, 0.1, 0.075] },
  ]
  parts.forEach(({ center, size }) => {
    // 固定表面采样，避免每次挂载随机闪变。
    Array.from({ length: 240 }, (_, index) => {
      const face = index % 6
      const coordinates = size.map((length, axis) => center[axis] + length * (axis === Math.floor(face / 2) ? (face % 2 ? 0.5 : -0.5) : ((index * (axis + 3) * 0.61803398875) % 1) - 0.5))
      positions.push(...coordinates)
      colors.push(0.68, 0.84, 0.76)
    })
  })
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3)).setAttribute('color', new Float32BufferAttribute(colors, 3))
}

export const PointCloudWorkers = ({ layer }: Props) => {
  const root = useRef<Group>(null)
  const geometry = useMemo(() => createRobotGeometry(), [])
  const vectors = useMemo(() => ({ target: new Vector3(), direction: new Vector3(), destination: new Vector3() }), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(({ clock }, delta) => {
    const current = layer.current
    if (!root.current || !current) return
    const drawn = Math.floor(current.cursor)
    const coordinates = current.points.geometry.getAttribute('position')
    root.current.visible = drawn > 0 && drawn < current.points.geometry.getAttribute('position').count
    root.current.children.forEach((worker, index) => {
      const time = clock.elapsedTime
      const angle = index / WORKER_COUNT * Math.PI * 2 + time * 0.12
      const body = worker.children[0]
      const beam = worker.children[1]
      const pointIndex = Math.max(0, drawn - 1 - index * 9)
      vectors.target.fromBufferAttribute(coordinates, pointIndex).multiplyScalar(current.points.scale.x).add(current.points.position)
      // 工作位置随落点高度缓慢移动，保持机器人在主体外侧。
      const radius = 2.3 + Math.sin(time * 0.7 + index) * 0.12
      body.position.lerp(vectors.destination.set(Math.cos(angle) * radius, vectors.target.y * 0.6 + 0.25 + Math.sin(time * 1.5 + index) * 0.1, Math.sin(angle) * radius), Math.min(1, delta * 5))
      body.lookAt(vectors.target)
      vectors.direction.copy(vectors.target).sub(body.position)
      beam.position.copy(body.position).add(vectors.target).multiplyScalar(0.5)
      const distance = vectors.direction.length()
      beam.quaternion.setFromUnitVectors(UP, vectors.direction.normalize())
      beam.scale.set(1, distance, 1)
      beam.visible = Math.sin(time * 25 + index * 2) > -0.35
    })
  })
  return <group ref={root} name="point-cloud-workers" visible={false}>
    {Array.from({ length: WORKER_COUNT }, (_, index) => <group key={index}>
      <group position={[Math.cos(index * Math.PI * 2 / WORKER_COUNT) * 2.3, 0.4, Math.sin(index * Math.PI * 2 / WORKER_COUNT) * 2.3]}>
        <points geometry={geometry}><pointsMaterial vertexColors size={0.016} transparent opacity={0.85} depthWrite={false}/></points>
        {[-0.055, 0.055].map((x) => <mesh key={x} position={[x, 0.17, 0.096]}><sphereGeometry args={[0.018, 8, 6]}/><meshBasicMaterial color="#d1ff68"/></mesh>)}
      </group>
      <mesh><cylinderGeometry args={[0.003, 0.006, 1, 5]}/><meshBasicMaterial color="#c7fb78" transparent opacity={0.35} depthWrite={false}/></mesh>
    </group>)}
  </group>
}
