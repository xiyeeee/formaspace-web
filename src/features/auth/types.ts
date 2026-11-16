import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  status: z.enum(['ACTIVE', 'DISABLED']),
  createdAt: z.string(),
})

export const loginResultSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().positive(),
  user: userSchema,
})

export type User = z.infer<typeof userSchema>
export type LoginResult = z.infer<typeof loginResultSchema>
export type LoginRequest = { account: string; password: string }
export type RegisterRequest = {
  email: string
  username: string
  verificationCode: string
  password: string
  confirmPassword: string
}
