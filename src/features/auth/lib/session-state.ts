import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { User } from '@/features/auth/types'
import { readToken, writeToken } from '@/features/auth/lib/token-storage'
import { queryClient } from '@/lib/query-client'

type SessionState = {
  status: 'checking' | 'authenticated' | 'anonymous' | 'error'
  token: string | null
  user: User | null
  revision: number
  error: string | null
}

const initialToken = readToken()
let session: SessionState = {
  status: initialToken ? 'checking' : 'anonymous',
  token: initialToken,
  user: null,
  revision: 0,
  error: null,
}
const listeners = new Set<() => void>()
export const getSession = () => session

const publish = (next: SessionState) => {
  session = next
  listeners.forEach((listener) => listener())
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const useSession = () => useSyncExternalStore(subscribe, getSession)

export const updateRestoration = (revision: number, patch: Partial<Pick<SessionState, 'status' | 'user' | 'error'>>) => {
  if (session.revision === revision) publish({ ...session, ...patch })
}

export const acceptSession = (token: string, user: User) => {
  void queryClient.cancelQueries()
  queryClient.clear()
  if (!writeToken(token)) toast.info('登录仅在当前页面有效，浏览器未允许保存会话。')
  publish({ status: 'authenticated', token, user, revision: session.revision + 1, error: null })
}

export const clearSession = () => {
  writeToken(null)
  void queryClient.cancelQueries()
  queryClient.clear()
  publish({ status: 'anonymous', token: null, user: null, revision: session.revision + 1, error: null })
}

export const expireSession = (revision: number) => {
  if (session.revision !== revision || !session.token) return
  clearSession()
  if (window.location.pathname !== '/login') toast.info('登录已失效，请重新登录。', { id: 'session-expired' })
}
