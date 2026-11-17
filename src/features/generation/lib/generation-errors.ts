import { ApiError } from '@/lib/http'
import type { TaskStatus } from '../types'

export const taskLabels: Record<TaskStatus, string> = {
  PENDING: '等待处理', SUBMITTING: '正在提交生成', PROCESSING: '正在生成', SUCCEEDED: '已完成', FAILED: '生成失败',
}
export const isTaskRunning = (status: TaskStatus) => !['SUCCEEDED', 'FAILED'].includes(status)
const errors: Record<string, string> = {
  INVALID_ARGUMENT: '请求参数不正确，请检查输入后重试。',
  INVALID_GENERATION_PARAMETERS: '生成参数不符合当前限制，请检查高级设置。',
  UNSUPPORTED_CAPABILITY: '当前服务不支持所选参数，已重新获取能力配置。',
  IDEMPOTENCY_CONFLICT: '提交记录冲突，请先核对任务历史。不会自动重复创建任务。',
  GENERATION_LIMIT_REACHED: '已有任务正在处理中，请等待完成后再生成。',
  INFERENCE_UNAVAILABLE: '生成服务暂未启用或不可用，请稍后重试。',
  INFERENCE_FAILED: '模型生成未完成，请检查图片或稍后重试。',
  INFERENCE_PROTOCOL_ERROR: '模型服务没有返回有效结果，请稍后重试。',
  INFERENCE_REFERENCE_LOST: '模型服务已重启或任务记录失效，请核对历史后重新生成。',
  INFERENCE_TIMEOUT: '模型生成已超时，请核对任务记录后再重试。',
  SUBMISSION_UNCERTAIN: '模型提交结果尚不确定，请先核对任务记录，避免重复生成。',
  STORAGE_UNAVAILABLE: '文件服务暂不可用，请稍后重试。',
  SERVICE_UNAVAILABLE: '服务暂不可用，请稍后重试。',
  FILE_TOO_LARGE: '图片超过上传大小限制，请压缩后重试。',
  UNSUPPORTED_FILE_TYPE: '图片格式不支持，请选择 JPEG 或 PNG。',
  INVALID_IMAGE: '图片无法读取，请换一张图片。',
  IMAGE_PIXEL_LIMIT_EXCEEDED: '图片像素超出限制，请降低分辨率。',
  MOCK_RESULT_NOT_CONFIGURED: '演示模型尚未配置，需要后端配置演示 GLB。',
}
export const getRetryAfterSeconds = (error: unknown) => {
  if (!(error instanceof ApiError)) return null
  const raw = error.headers?.get('Retry-After')
  if (!raw || !/^\d+$/.test(raw.trim())) return null
  const value = Number(raw)
  return Number.isFinite(value) ? Math.min(value, 86_400) : null
}
export const generationErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    const known = errors[String(error.code)]
    if (error.status === 429) {
      const seconds = getRetryAfterSeconds(error)
      return `${known || errors.GENERATION_LIMIT_REACHED}${seconds ? ` 请等待 ${seconds} 秒后再试。` : ''}`
    }
    if (known) return known
    if (error.status === 404) return '文件、任务或作品不存在，或当前账号无法访问。'
    if (error.status === 413) return errors.FILE_TOO_LARGE
    if (error.status === 415) return errors.UNSUPPORTED_FILE_TYPE
    if (error.status === 503) return '服务暂不可用，请稍后重试。'
    if (error.status === 401) return '登录已失效，请重新登录。'
    return error.status === 0 || error.code === 'INVALID_RESPONSE' ? error.message : '请求未完成，请检查输入或稍后重试。'
  }
  return error instanceof Error ? error.message : '操作未完成，请重试。'
}
const publicTaskMessage = (message?: string | null) => {
  const text = message?.trim()
  if (!text || text.length > 240 || /[\r\n]|https?:|jdbc:|traceback|exception|authorization|bearer|password|\btoken\b|\bselect\b.+\bfrom\b|(?:\/Users\/|\/private\/|\/tmp\/|\/home\/|[A-Za-z]:\\)/i.test(text)) return null
  return text
}
export const taskFailureMessage = (code: string | null, message?: string | null) =>
  publicTaskMessage(message) ?? errors[code ?? ''] ?? '本次生成未完成，请核对任务记录后重试。'
export const isSubmissionUncertain = (error: unknown) => error instanceof ApiError && (
  error.status === 0 || error.status >= 500 || error.code === 'INVALID_RESPONSE' || error.code === 'INVALID_JSON'
)
export const isTaskQueryRetryable = (error: unknown) => error instanceof ApiError && error.code !== 'ABORTED' && (
  error.status === 0 || error.status >= 500 || error.status === 429
  || error.code === 'INVALID_RESPONSE' || error.code === 'INVALID_JSON'
)
export const getTaskRetryDelay = (error: unknown, failures: number) =>
  Math.max(Math.min(5000 * 2 ** Math.min(Math.max(failures - 1, 0), 3), 30_000), (getRetryAfterSeconds(error) ?? 0) * 1000)
