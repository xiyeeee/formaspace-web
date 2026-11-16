import { useEffect, useRef, useState } from 'react'
import { uploadImage } from '../lib/generation-api'
import { generationErrorMessage } from '../lib/generation-errors'
import type { GenerationCapabilities } from '../lib/generation-settings'
import type { UploadedFile } from '../types'

type Selection = { file: File; preview: string; uploaded: UploadedFile | null; status: 'uploading' | 'failed' | 'ready'; error: string | null }
const validateImage = async (file: File, capabilities: GenerationCapabilities) => {
  const extensions = capabilities.accept[file.type]
  if (!extensions || !extensions.some((extension) => file.name.toLowerCase().endsWith(extension))) throw new Error('请选择当前支持的 JPEG / PNG 图片')
  if (file.size > capabilities.uploadConstraints.maximumBytes) throw new Error('图片大小超过当前上传限制')
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('图片无法解码，请选择有效图片') })
  const pixels = bitmap.width * bitmap.height
  bitmap.close()
  if (pixels > capabilities.uploadConstraints.maximumPixels) throw new Error('图片像素超过当前限制，请降低分辨率')
}
export const useImageUpload = () => {
  const [selection, setSelection] = useState<Selection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = useRef({ version: 0, controller: new AbortController(), url: '' })
  useEffect(() => () => {
    current.current.version++
    current.current.controller.abort()
    URL.revokeObjectURL(current.current.url)
  }, [])
  const remove = () => {
    const active = current.current
    active.version++
    active.controller.abort()
    URL.revokeObjectURL(active.url)
    active.url = ''
    setSelection(null)
    setError(null)
  }
  const select = async (file: File, capabilities: GenerationCapabilities) => {
    remove()
    const active = current.current
    const version = active.version
    active.controller = new AbortController()
    const signal = active.controller.signal
    try {
      await validateImage(file, capabilities)
      if (version !== active.version) return
      active.url = URL.createObjectURL(file)
      const next: Selection = { file, preview: active.url, uploaded: null, status: 'uploading', error: null }
      setSelection(next)
      try {
        const uploaded = await uploadImage(file, signal)
        if (version === active.version && !signal.aborted) setSelection({ ...next, uploaded, status: 'ready' })
      } catch (cause) {
        if (version === active.version && !signal.aborted) setSelection({ ...next, status: 'failed', error: generationErrorMessage(cause) })
      }
    } catch (cause) {
      if (version === active.version) setError(generationErrorMessage(cause))
    }
  }
  return { selection, error, select, remove }
}
