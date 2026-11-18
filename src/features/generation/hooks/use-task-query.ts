import { useQuery } from '@tanstack/react-query'
import { getAsset, getTask, getTasks } from '../lib/generation-api'
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
// 只读取初始化详情；实时状态由 WebSocket 提供，不定时刷新或断线轮询。
export const useTaskQuery = (taskId: string | null) => {
  const { user } = useSession()
  const query = useQuery({
    queryKey: ['generation', user?.id, 'task', taskId],
    queryFn: ({ signal }) => getTask(taskId!, signal), enabled: Boolean(taskId), retry: false,
    staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  return { ...query, reconnecting: false }
}
