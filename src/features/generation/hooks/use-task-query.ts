import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePageVisible } from '@/lib/use-media-query'
import { getTask, getTasks } from '../lib/generation-api'
import { isTaskRunning } from '../lib/generation-errors'
import { useSession } from '@/features/auth/lib/session-state'
import type { TaskStatus } from '../types'

export const useTaskHistory = (page: number, status?: TaskStatus) => {
  const { user } = useSession()
  return useQuery({ queryKey: ['generation', user?.id, 'tasks', page, status], queryFn: ({ signal }) => getTasks(page, status, signal), retry: false })
}
export const useTaskQuery = (taskId: string | null) => {
  const { user } = useSession()
  const visible = usePageVisible()
  const query = useQuery({
    queryKey: ['generation', user?.id, 'task', taskId],
    queryFn: ({ signal }) => getTask(taskId!, signal), enabled: Boolean(taskId), retry: false, staleTime: 0,
  })
  const { refetch, data, isFetching, isError, dataUpdatedAt } = query
  useEffect(() => {
    if (!taskId || !visible || isFetching || isError || !data || !isTaskRunning(data.status)) return
    // 上次请求结束后才安排下一次，避免慢请求与轮询重叠。
    const timeout = window.setTimeout(() => { void refetch() }, 2500)
    return () => window.clearTimeout(timeout)
  }, [taskId, visible, isFetching, isError, data, dataUpdatedAt, refetch])
  useEffect(() => {
    if (visible && taskId) void refetch()
  }, [visible, taskId, refetch])
  return query
}
