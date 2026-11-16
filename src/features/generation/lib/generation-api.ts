import { apiBinaryRequest, apiRequest } from '@/lib/api-client'
import { assetSchema, capabilitiesSchema, fileSchema, taskPageSchema, taskSchema } from '../types'
import type { CreateTaskRequest, TaskStatus } from '../types'

const idPath = (id: string) => encodeURIComponent(id)
export const getCapabilities = (signal?: AbortSignal) => apiRequest('generation/capabilities', capabilitiesSchema, { auth: 'protected', signal })
export const uploadImage = (file: File, signal?: AbortSignal) => {
  const body = new FormData()
  body.append('file', file)
  return apiRequest('files/upload', fileSchema, { auth: 'protected', method: 'POST', body, signal, timeoutMs: 60_000 })
}
export const getSourceImage = (id: string, signal?: AbortSignal) => apiBinaryRequest(`files/${idPath(id)}/content`, signal)
export const createTask = (json: CreateTaskRequest, key: string, signal?: AbortSignal) =>
  apiRequest('generation/tasks', taskSchema, { auth: 'protected', method: 'POST', json, signal, headers: { 'Idempotency-Key': key } })
export const getTask = (id: string, signal?: AbortSignal) => apiRequest(`generation/tasks/${idPath(id)}`, taskSchema, { auth: 'protected', signal })
export const getTasks = (page: number, status?: TaskStatus, signal?: AbortSignal) => {
  const params = new URLSearchParams({ page: String(page), size: '20' })
  if (status) params.set('status', status)
  return apiRequest(`generation/tasks?${params}`, taskPageSchema, { auth: 'protected', signal })
}
export const getAsset = (id: string, signal?: AbortSignal) => apiRequest(`assets/${idPath(id)}`, assetSchema, { auth: 'protected', signal })
export const getAssetModel = (id: string, signal?: AbortSignal) => apiBinaryRequest(`assets/${idPath(id)}/model`, signal)
export const getAssetDownload = (id: string, signal?: AbortSignal) => apiBinaryRequest(`assets/${idPath(id)}/download`, signal)
