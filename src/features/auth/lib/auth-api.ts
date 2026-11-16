import { z } from 'zod'
import { apiRequest } from '@/lib/api-client'
import { loginResultSchema, userSchema } from '@/features/auth/types'
import type { LoginRequest, RegisterRequest } from '@/features/auth/types'

export const login = (json: LoginRequest, signal?: AbortSignal) =>
  apiRequest('auth/login', loginResultSchema, { method: 'POST', json, signal, auth: 'public' })

export const registerAccount = (json: RegisterRequest, signal?: AbortSignal) =>
  apiRequest('auth/register', userSchema, { method: 'POST', json, signal, auth: 'public' })

export const sendEmailCode = (email: string, signal?: AbortSignal, onSuccessMessage?: (message: string) => void) =>
  apiRequest('auth/email-codes', z.object({ retryAfterSeconds: z.number().nonnegative() }), {
    method: 'POST', json: { email, purpose: 'REGISTER' }, signal, auth: 'public', onSuccessMessage,
  })

export const getCurrentUser = (signal?: AbortSignal) =>
  apiRequest('auth/me', userSchema, { signal, auth: 'protected' })
