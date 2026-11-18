import { useCallback, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/features/auth/lib/session-state'
import { usePageVisible } from '@/lib/use-media-query'
import { getTask } from '../lib/generation-api'
import { isTaskRunning } from '../lib/generation-errors'
import { estimateTaskDuration, taskElapsed } from '../lib/generation-timing'
import type { GenerationTask } from '../types'

export const useGenerationTiming = (task: GenerationTask | undefined, history: GenerationTask[], stage?: string | null, completed?: number | null, total?: number | null) => {
  const { user } = useSession()
  const visible = usePageVisible()
  const taskId = task?.id
  const terminal = !!task && !isTaskRunning(task.status)
  const historical = history.find((record) => record.id === task?.id)
  const readTimes = async (signal: AbortSignal) => {
    const record = await getTask(task!.id, signal)
    return { createdAt: record.createdAt, startedAt: record.startedAt, finishedAt: record.finishedAt }
  }
  const options = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false }
  // One metadata read at the WS start transition and one at termination; no status polling.
  const started = useQuery({ ...options, queryKey: ['generation', user?.id, 'timing', task?.id, 'started'], queryFn: ({ signal }) => readTimes(signal),
    enabled: !!user && !!task && !terminal && task.status !== 'PENDING' && !task.startedAt && !historical?.startedAt })
  const finished = useQuery({ ...options, queryKey: ['generation', user?.id, 'timing', task?.id, 'finished'], queryFn: ({ signal }) => readTimes(signal),
    enabled: !!user && !!task && terminal && !task.finishedAt && !historical?.finishedAt })
  const times = task ? {
    createdAt: task.createdAt,
    startedAt: task.startedAt ?? finished.data?.startedAt ?? started.data?.startedAt ?? historical?.startedAt ?? null,
    finishedAt: task.finishedAt ?? finished.data?.finishedAt ?? historical?.finishedAt ?? null,
  } : null
  const subscribe = useCallback((notify: () => void) => {
    if (!taskId || terminal || !visible) return () => {}
    const timer = window.setInterval(notify, 1000)
    return () => window.clearInterval(timer)
  }, [taskId, terminal, visible])
  const now = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000) * 1000)
  if (!task || !times) return null
  const elapsed = taskElapsed(times, terminal, now)
  const queued = !terminal && (task.status === 'PENDING' || stage === 'queued')
  return { ...elapsed, queueSeconds: elapsed.queued, terminal, queued, waitingSeconds: taskElapsed({ ...times, startedAt: null }, false, now).queued,
    estimate: !terminal && !queued && elapsed.elapsed !== null ? estimateTaskDuration(task, history, elapsed.elapsed, stage, completed, total) : null,
    metadataError: started.isError || finished.isError,
  }
}
