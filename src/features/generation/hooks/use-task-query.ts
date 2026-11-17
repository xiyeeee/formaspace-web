import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePageVisible } from '@/lib/use-media-query'
import { getAsset, getTask, getTasks } from '../lib/generation-api'
import { getTaskRetryDelay, isTaskQueryRetryable, isTaskRunning } from '../lib/generation-errors'
import { useSession } from '@/features/auth/lib/session-state'
import type { GenerationTask, TaskStatus } from '../types'

export const useTaskHistory = (page: number, status?: TaskStatus) => {
  const { user } = useSession()
  return useQuery({ queryKey: ['generation', user?.id, 'tasks', page, status], queryFn: ({ signal }) => getTasks(page, status, signal), retry: false })
}
export const useTaskAsset = (task?: Pick<GenerationTask, 'status' | 'assetId'>) => {
  const { user } = useSession()
  const assetId = task?.status === 'SUCCEEDED' ? task.assetId : null
  return useQuery({
    queryKey: ['generation', user?.id, 'asset', assetId],
    queryFn: ({ signal }) => getAsset(assetId!, signal), enabled: Boolean(assetId), retry: false,
  })
}
export const useTaskQuery = (taskId: string | null, realtimeStable = false) => {
  const { user } = useSession()
  const visible = usePageVisible()
  const failures = useRef({ taskId, lastError: 0, count: 0 })
  const query = useQuery({
    queryKey: ['generation', user?.id, 'task', taskId],
    queryFn: ({ signal }) => getTask(taskId!, signal), enabled: Boolean(taskId), retry: false, staleTime: 0,
    refetchOnWindowFocus: (current) => (!current.state.error || isTaskQueryRetryable(current.state.error))
      && (!current.state.data || isTaskRunning(current.state.data.status)),
  })
  const { refetch, data, error, isFetching, isError, dataUpdatedAt, errorUpdatedAt } = query
  useEffect(() => {
    if (failures.current.taskId !== taskId) failures.current = { taskId, lastError: 0, count: 0 }
    if (!taskId || !visible || (realtimeStable && data) || isFetching || (data && !isTaskRunning(data.status))) return
    if (isError && !isTaskQueryRetryable(error)) return
    if (!data && !isError) return
    if (isError) {
      if (failures.current.lastError !== errorUpdatedAt) {
        failures.current.count++
        failures.current.lastError = errorUpdatedAt
      }
    } else failures.current.count = 0
    // Request completion starts the next timeout. Errors keep the last task and back off, never fabricate FAILED.
    const delay = isError ? getTaskRetryDelay(error, failures.current.count) : 2500
    const timeout = window.setTimeout(() => { void refetch() }, delay)
    return () => window.clearTimeout(timeout)
  }, [taskId, visible, realtimeStable, isFetching, isError, error, data, dataUpdatedAt, errorUpdatedAt, refetch])
  return { ...query, reconnecting: isError && isTaskQueryRetryable(error) && (!data || isTaskRunning(data.status)) }
}
