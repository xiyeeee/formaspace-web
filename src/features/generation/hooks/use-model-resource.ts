import { useEffect, useState } from 'react'
import { LoadingManager } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { getAssetModel } from '../lib/generation-api'
import { assertGlbHeader, centerModel, disposeModel } from '../lib/model-resources'
import { generationErrorMessage } from '../lib/generation-errors'

export const useModelResource = (assetId: string | undefined, revision: number) => {
  const [resource, setResource] = useState<{ id: string; revision: number; gltf?: GLTF; normalization?: ReturnType<typeof centerModel>; error?: string } | null>(null)
  useEffect(() => {
    if (!assetId) return
    const controller = new AbortController()
    let model: GLTF | undefined
    const release = () => {
      if (!model) return
      disposeModel([...new Set([model.scene, ...model.scenes])])
      model = undefined
    }
    const load = async () => {
      try {
        const { blob } = await getAssetModel(assetId, controller.signal)
        const buffer = await blob.arrayBuffer()
        if (controller.signal.aborted) return
        assertGlbHeader(buffer)
        const manager = new LoadingManager()
        manager.setURLModifier((url) => {
          if (!url.startsWith('blob:') && !url.startsWith('data:')) throw new Error('模型包含外部资源，当前仅支持自包含 GLB')
          return url
        })
        model = await new GLTFLoader(manager).parseAsync(buffer, '')
        if (controller.signal.aborted) { release(); return }
        const normalization = centerModel(model.scene)
        setResource({ id: assetId, revision, gltf: model, normalization })
      } catch (cause) {
        release()
        if (!controller.signal.aborted) setResource({ id: assetId, revision, error: generationErrorMessage(cause) })
      }
    }
    void load()
    return () => { controller.abort(); release() }
  }, [assetId, revision])
  return resource && resource.id === assetId && resource.revision === revision ? resource : null
}
