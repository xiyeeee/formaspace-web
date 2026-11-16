import { Box3, BufferGeometry, Material, Mesh, Line, Points, Texture, Vector3 } from 'three'
import type { Object3D } from 'three'

export const disposeModel = (scene: Object3D) => {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  scene.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return
    geometries.add(object.geometry)
    const list = Array.isArray(object.material) ? object.material : [object.material]
    list.forEach((material) => {
      materials.add(material)
      Object.values(material).forEach((value) => { if (value instanceof Texture) textures.add(value) })
    })
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => { texture.dispose(); if (texture.image instanceof ImageBitmap) texture.image.close() })
}
export const centerModel = (scene: Object3D) => {
  scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(scene)
  const size = bounds.getSize(new Vector3())
  const extent = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(extent) || extent <= 0) throw new Error('模型不包含可预览的几何体')
  return { center: bounds.getCenter(new Vector3()).multiplyScalar(-1), scale: 3.4 / extent }
}
