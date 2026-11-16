import { ApiError } from '@/lib/http'

export const isCancelled = (error: unknown) => error instanceof ApiError && error.code === 'ABORTED'

export const getRetrySeconds = (error: unknown): number | null => {
  if (!(error instanceof ApiError) || error.status !== 429) return null
  const value = error.headers?.get('Retry-After')
  if (!value || !/^\d+$/.test(value.trim())) return null
  const seconds = Number(value)
  return Number.isSafeInteger(seconds) ? seconds : null
}

export const authErrorMessage = (error: unknown, action: 'login' | 'register' | 'email' | 'restore'): string => {
  if (!(error instanceof ApiError)) return '暂时无法完成操作，请稍后重试。'
  if (error.code === 'INVALID_CREDENTIALS' && action === 'login') return '账号或密码错误'
  if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') {
    if (action === 'register') return '未能确认注册结果，请稍后尝试登录确认，或重新提交。'
    if (action === 'email') return '未能确认发送结果，请稍后查看邮箱或重试。'
    return action === 'restore' ? '无法连接服务，暂时无法验证登录状态。请重试。' : '暂时无法连接服务，请检查网络后重试。'
  }
  if (error.status === 429) {
    const seconds = getRetrySeconds(error)
    return seconds ? `操作过于频繁，请在 ${seconds} 秒后重试。` : '操作过于频繁，请稍后重试。'
  }
  if (error.code === 'CONFLICT') return '邮箱或用户名已被使用，请修改后重试。'
  if (error.code === 'INVALID_ARGUMENT') return '提交的信息不符合要求，请检查后重试。'
  if (error.status === 403) return '没有访问权限，请联系管理员。'
  if (error.status >= 500 && error.code !== 'MAIL_UNAVAILABLE') return '服务暂时不可用，请稍后重试。'
  return error.message
}
