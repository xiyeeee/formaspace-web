import { env } from '@/lib/env'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string | number
  readonly payload?: unknown
  readonly headers?: Headers

  constructor(message: string, status: number, code?: string | number, payload?: unknown, headers?: Headers) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.payload = payload
    this.headers = headers
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | null
  json?: unknown
  timeoutMs?: number
}

type HttpClientOptions = {
  baseUrl?: string
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
}

const readResponse = async (response: Response): Promise<unknown> => {
  if (response.status === 204 || response.status === 205) return undefined
  const text = await response.text()
  if (!text.trim()) return undefined
  if (!response.headers.get('content-type')?.toLowerCase().includes('json')) return text

  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError('服务返回了无效的 JSON', response.status, 'INVALID_JSON', text)
  }
}

export const createHttpClient = ({
  baseUrl = env.apiBaseUrl,
  getAccessToken,
}: HttpClientOptions = {}) => {
  const request = async <T = unknown>(path: string, options: RequestOptions = {}): Promise<T> => {
    const { json, body, timeoutMs = 15_000, signal, headers: suppliedHeaders, ...init } = options
    if (json !== undefined && body != null) {
      throw new ApiError('json 和 body 不能同时传入', 0, 'INVALID_OPTIONS')
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new ApiError('timeoutMs 必须为正数', 0, 'INVALID_OPTIONS')
    }

    const controller = new AbortController()
    const abort = () => controller.abort(signal?.reason)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      const headers = new Headers(suppliedHeaders)
      const token = await getAccessToken?.()
      if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
      if (json !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${path.replace(/^\/+/, '')}`, {
        ...init,
        headers,
        body: json !== undefined ? JSON.stringify(json) : body,
        signal: controller.signal,
      })
      const payload = await readResponse(response)
      if (!response.ok) {
        throw new ApiError(`请求失败（${response.status}）`, response.status, undefined, payload, response.headers)
      }
      // 不假定业务响应结构；调用方按正式接口契约指定 T。
      return payload as T
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (controller.signal.aborted) {
        throw new ApiError(timedOut ? '请求超时，请稍后重试' : '请求已取消', 0, timedOut ? 'TIMEOUT' : 'ABORTED')
      }
      throw new ApiError('网络请求失败，请检查连接', 0, 'NETWORK_ERROR')
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }

  return { request }
}

export const http = createHttpClient()
