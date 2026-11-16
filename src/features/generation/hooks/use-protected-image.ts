import { useEffect, useState } from 'react'
import { getSourceImage } from '../lib/generation-api'

export const useProtectedImage = (fileId: string | undefined) => {
  const [image, setImage] = useState<{ id: string; url: string } | null>(null)
  useEffect(() => {
    if (!fileId) return
    const controller = new AbortController()
    let url = ''
    void getSourceImage(fileId, controller.signal).then(({ blob }) => {
      if (controller.signal.aborted) return
      url = URL.createObjectURL(blob)
      setImage({ id: fileId, url })
    }).catch(() => { /* 历史源图不可用时显示明确占位，任务仍可选择。 */ })
    return () => { controller.abort(); URL.revokeObjectURL(url) }
  }, [fileId])
  return image && image.id === fileId ? image.url : undefined
}
