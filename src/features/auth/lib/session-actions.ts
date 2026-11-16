import { getCurrentUser } from '@/features/auth/lib/auth-api'
import { authErrorMessage, isCancelled } from '@/features/auth/lib/auth-errors'
import { clearSession, getSession, updateRestoration } from '@/features/auth/lib/session-state'

let restoration: AbortController | null = null
export const cancelRestoration = () => {
  restoration?.abort()
  restoration = null
}

export const restoreSession = async () => {
  cancelRestoration()
  const { token, revision } = getSession()
  if (!token) return
  const controller = new AbortController()
  restoration = controller
  updateRestoration(revision, { status: 'checking', user: null, error: null })
  try {
    const user = await getCurrentUser(controller.signal)
    if (!controller.signal.aborted) updateRestoration(revision, { status: 'authenticated', user })
  } catch (error) {
    if (!controller.signal.aborted && !isCancelled(error)) {
      updateRestoration(revision, { status: 'error', error: authErrorMessage(error, 'restore') })
    }
  } finally {
    if (restoration === controller) restoration = null
  }
}

export const logout = () => {
  cancelRestoration()
  clearSession()
}
