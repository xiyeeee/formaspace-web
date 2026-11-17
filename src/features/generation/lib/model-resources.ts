import { Box3, BufferGeometry, Material, Mesh, Line, Points, Texture, Vector3 } from 'three'
import type { Object3D } from 'three'

export const disposeModel = (scene: Object3D | Object3D[]) => {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  const scenes = Array.isArray(scene) ? scene : [scene]
  scenes.forEach((root) => root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return
    geometries.add(object.geometry)
    const list = Array.isArray(object.material) ? object.material : [object.material]
    list.forEach((material) => {
      materials.add(material)
      Object.values(material).forEach((value) => { if (value instanceof Texture) textures.add(value) })
    })
  }))
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => { texture.dispose(); if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close() })
}
export const centerModel = (scene: Object3D) => {
  scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(scene)
  const size = bounds.getSize(new Vector3())
  const extent = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(extent) || extent <= 0) throw new Error('模型不包含可预览的几何体')
  return { center: bounds.getCenter(new Vector3()).multiplyScalar(-1), scale: 3.4 / extent }
}

export const assertGlbHeader = (buffer: ArrayBuffer, totalBytes = buffer.byteLength) => {
  if (buffer.byteLength < 12 || totalBytes < 20) throw new Error('服务未返回有效的 GLB 2 模型文件')
  const header = new DataView(buffer)
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== totalBytes) {
    throw new Error('服务未返回有效的 GLB 2 模型文件')
  }
}
