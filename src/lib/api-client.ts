import { z } from 'zod'
import { ApiError, http } from '@/lib/http'
import type { BinaryResponse } from '@/lib/http'
import { expireSession, getSession } from '@/features/auth/lib/session-state'

const envelopeSchema = z.object({ code: z.string(), message: z.string(), data: z.unknown() })
type ApiOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  json?: unknown
  body?: BodyInit
  headers?: HeadersInit
  timeoutMs?: number
  signal?: AbortSignal
  auth: 'public' | 'protected'
  onSuccessMessage?: (message: string) => void
}

// 只有此适配层解包后端契约；底层 http 仍支持普通 JSON / 文本 / FormData。
const withSession = async <T>(auth: ApiOptions['auth'], action: (headers: Headers) => Promise<T>) => {
  const session = getSession()
  const headers = new Headers({ Accept: 'application/json' })
  if (auth === 'protected') {
    if (!session.token) throw new ApiError('请先登录', 401, 'UNAUTHORIZED')
    headers.set('Authorization', `Bearer ${session.token}`)
  }

  try {
    return await action(headers)
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.status === 401 && auth === 'protected') expireSession(session.revision)
    const envelope = envelopeSchema.safeParse(error.payload)
    if (envelope.success) {
      throw new ApiError(envelope.data.message || error.message, error.status, envelope.data.code, error.payload, error.headers)
    }
    throw error
  }
}

export const apiRequest = async <T>(path: string, schema: z.ZodType<T>, options: ApiOptions): Promise<T> => {
  const { auth, onSuccessMessage, headers: suppliedHeaders, ...init } = options
  return withSession(auth, async (headers) => {
    new Headers(suppliedHeaders).forEach((value, key) => headers.set(key, value))
    const payload = await http.request(path, { ...init, headers, credentials: 'omit', cache: 'no-store' })
    const envelope = envelopeSchema.safeParse(payload)
    if (!envelope.success) throw new ApiError('服务响应格式与接口约定不一致', 200, 'INVALID_RESPONSE')
    if (envelope.data.code !== 'OK') {
      throw new ApiError(envelope.data.message || '请求未成功，请稍后重试', 200, envelope.data.code)
    }
    const data = schema.safeParse(envelope.data.data)
    if (!data.success) throw new ApiError('服务响应数据与接口约定不一致', 200, 'INVALID_RESPONSE')
    onSuccessMessage?.(envelope.data.message)
    return data.data
  })
}

export const apiBinaryRequest = (path: string, signal?: AbortSignal) => withSession('protected', async (headers) => {
  headers.set('Accept', 'application/octet-stream, model/gltf-binary, image/*')
  const result = await http.request<BinaryResponse>(path, {
    headers, signal, responseType: 'binary', timeoutMs: 60_000, credentials: 'omit', cache: 'no-store',
  })
  if (result.blob.type.includes('json') || result.blob.type.startsWith('text/')) {
    throw new ApiError('文件响应格式异常，请重试', 200, 'INVALID_RESPONSE')
  }
  return result
})
