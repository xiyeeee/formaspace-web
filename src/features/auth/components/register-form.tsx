import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { AuthField } from '@/features/auth/components/auth-field'
import { registerAccount, sendEmailCode } from '@/features/auth/lib/auth-api'
import { authErrorMessage, getRetrySeconds, isCancelled } from '@/features/auth/lib/auth-errors'
import { emailSchema, registerSchema } from '@/features/auth/lib/validation'
import { useRequestSignal } from '@/features/auth/lib/use-request-signal'
import { useDeadline } from '@/features/auth/lib/use-deadline'
import type { RegisterRequest } from '@/features/auth/types'

export const RegisterForm = () => {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const [sentTo, setSentTo] = useState('')
  const emailCooldown = useDeadline()
  const submitCooldown = useDeadline()
  const emailSignal = useRequestSignal()
  const submitSignal = useRequestSignal()
  const { register, handleSubmit, getValues, setValue, setError, clearErrors, setFocus, formState: { errors, isSubmitting } } = useForm<RegisterRequest>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', username: '', verificationCode: '', password: '', confirmPassword: '' },
  })

  const sendCode = async () => {
    if (sendingRef.current || emailCooldown.remaining || isSubmitting) return
    const parsed = emailSchema.safeParse(getValues('email'))
    if (!parsed.success) {
      setError('email', { message: parsed.error.issues[0].message })
      setFocus('email')
      return
    }
    clearErrors('email')
    setMessage('')
    setFailed(false)
    setSending(true)
    sendingRef.current = true
    const signal = emailSignal()
    const email = parsed.data
    try {
      const result = await sendEmailCode(email, signal, (text) => {
        if (!signal.aborted && getValues('email').trim() === email) setMessage(text)
      })
      if (signal.aborted) return
      setSentTo(email)
      emailCooldown.start(result.retryAfterSeconds)
    } catch (error) {
      if (signal.aborted || isCancelled(error)) return
      setMessage(authErrorMessage(error, 'email'))
      setFailed(true)
      const seconds = getRetrySeconds(error)
      if (seconds !== null) emailCooldown.start(seconds)
    } finally {
      sendingRef.current = false
      if (!signal.aborted) setSending(false)
    }
  }

  const submit = handleSubmit(async (values) => {
    if (submitCooldown.remaining || sending) return
    setMessage('')
    setFailed(false)
    const signal = submitSignal()
    try {
      await registerAccount(values, signal)
      if (!signal.aborted) navigate('/login', { replace: true, state: { account: values.email, registered: true } })
    } catch (error) {
      if (signal.aborted || isCancelled(error)) return
      setMessage(authErrorMessage(error, 'register'))
      setFailed(true)
      const seconds = getRetrySeconds(error)
      if (seconds !== null) submitCooldown.start(seconds)
    }
  })

  return (
    <>
      <form noValidate onSubmit={submit} className="auth-form auth-register-form" aria-label="注册表单" aria-busy={isSubmitting}>
        <AuthField label="邮箱" placeholder="输入邮箱地址" type="email" autoComplete="email" autoCapitalize="none" {...register('email', {
          onChange: () => { setValue('verificationCode', ''); setMessage(''); setFailed(false) },
        })} error={errors.email?.message} />
        <AuthField label="用户名" placeholder="3–32 位字母、数字或下划线" autoComplete="username" autoCapitalize="none" spellCheck={false} {...register('username')} error={errors.username?.message} />
        <div className="auth-code-row">
          <AuthField label="邮箱验证码" placeholder="6 位数字" inputMode="numeric" autoComplete="one-time-code" maxLength={6} {...register('verificationCode')} error={errors.verificationCode?.message} />
          <Button type="button" variant="outline" className="auth-code-button" disabled={sending || isSubmitting || emailCooldown.remaining > 0} onClick={() => void sendCode()}>
            {sending ? '发送中…' : emailCooldown.remaining ? `${emailCooldown.remaining} 秒后重发` : '获取验证码'}
          </Button>
        </div>
        {sentTo && emailCooldown.remaining > 0 && <p className="auth-code-hint">重发等待关联邮箱：{sentTo}。更换邮箱不代表新邮箱已验证。</p>}
        <AuthField label="密码" placeholder="8–64 个字符" password autoComplete="new-password" {...register('password')} error={errors.password?.message} />
        <AuthField label="确认密码" placeholder="再次输入密码" password autoComplete="new-password" {...register('confirmPassword')} error={errors.confirmPassword?.message} />
        <div className={`auth-message ${failed ? 'auth-message-error' : ''}`} aria-live="polite" aria-atomic="true">{message}</div>
        <Button type="submit" className="auth-submit" disabled={isSubmitting || sending || submitCooldown.remaining > 0}>
          {isSubmitting ? <><LoaderCircle className="animate-spin" aria-hidden="true" />正在注册</> : submitCooldown.remaining ? `${submitCooldown.remaining} 秒后重试` : <>创建账号<ArrowUpRight aria-hidden="true" /></>}
        </Button>
      </form>
      <p className="auth-switch">已有账号？ <Link to="/login">立即登录</Link></p>
    </>
  )
}
