import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useSession } from '@/features/auth/lib/session-state'
import { createGenerationRealtime } from '../lib/realtime/generation-realtime'

export const useGenerationRealtime = (taskId: string | null) => {
  const { user, revision } = useSession()
  const store = useMemo(() => createGenerationRealtime(taskId, user!.id, revision), [taskId, user, revision])
  useEffect(() => { store.start(); return store.dispose }, [store])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return { ...state, retry: store.retry, retryPreview: store.retryPreview, confirmPreview: store.confirmPreview, finish: store.finish, observeTask: store.observeTask }
}
export type GenerationRealtime = ReturnType<typeof useGenerationRealtime>
