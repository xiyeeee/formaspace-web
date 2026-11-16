import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { AuthField } from '@/features/auth/components/auth-field'
import { login } from '@/features/auth/lib/auth-api'
import { authErrorMessage, getRetrySeconds, isCancelled } from '@/features/auth/lib/auth-errors'
import { acceptSession } from '@/features/auth/lib/session-state'
import { loginSchema } from '@/features/auth/lib/validation'
import { useRequestSignal } from '@/features/auth/lib/use-request-signal'
import { useDeadline } from '@/features/auth/lib/use-deadline'
import { safeDestination } from '@/features/auth/lib/safe-destination'
import type { LoginRequest } from '@/features/auth/types'

type LoginLocationState = { account?: string; registered?: boolean } | null

export const LoginForm = () => {
  const location = useLocation()
  const routeState = location.state as LoginLocationState
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [message, setMessage] = useState(routeState?.registered ? '注册成功，请登录' : '')
  const [failed, setFailed] = useState(false)
  const getSignal = useRequestSignal()
  const cooldown = useDeadline()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema), defaultValues: { account: routeState?.account || '', password: '' },
  })

  const submit = handleSubmit(async (values) => {
    if (cooldown.remaining) return
    setMessage('')
    setFailed(false)
    const signal = getSignal()
    try {
      const result = await login(values, signal)
      if (signal.aborted) return
      acceptSession(result.accessToken, result.user)
      navigate(safeDestination(params.get('redirect')), { replace: true })
    } catch (error) {
      if (signal.aborted || isCancelled(error)) return
      setMessage(authErrorMessage(error, 'login'))
      setFailed(true)
      const seconds = getRetrySeconds(error)
      if (seconds !== null) cooldown.start(seconds)
    }
  })

  return (
    <>
      <div className="auth-mode"><span>密码登录</span><span className="auth-mode-line" /></div>
      <form noValidate onSubmit={submit} className="auth-form" aria-label="登录表单" aria-busy={isSubmitting}>
        <AuthField label="用户名或邮箱" placeholder="输入用户名或邮箱" autoComplete="username" autoCapitalize="none" spellCheck={false} {...register('account')} error={errors.account?.message} />
        <AuthField label="密码" placeholder="输入你的密码" password autoComplete="current-password" {...register('password')} error={errors.password?.message} />
        <div className={`auth-message ${failed ? 'auth-message-error' : ''}`} aria-live="polite" aria-atomic="true">{message}</div>
        <Button type="submit" className="auth-submit" disabled={isSubmitting || cooldown.remaining > 0}>
          {isSubmitting ? <><LoaderCircle className="animate-spin" aria-hidden="true" />正在登录</> : cooldown.remaining ? `${cooldown.remaining} 秒后重试` : <>登录<ArrowUpRight aria-hidden="true" /></>}
        </Button>
      </form>
      <p className="auth-switch">还没有账号？ <Link to="/register">立即注册</Link></p>
      <p className="auth-panel-note">从一张图片开始，探索立体创作。</p>
    </>
  )
}
