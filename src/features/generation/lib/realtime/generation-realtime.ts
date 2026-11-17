import { getSession } from '@/features/auth/lib/session-state'
import { env } from '@/lib/env'
import { queryClient } from '@/lib/query-client'
import { generationErrorMessage, isTaskRunning } from '../generation-errors'
import type { GenerationTask, TaskStatus } from '../../types'
import { assertPreviewPath, createCoordinateFrame, createEventSequence, toPointCloud } from './generation-events'
import type { CoordinateFrame, GenerationEvent, PointCloud, PreviewMetadata } from './generation-events'
import type { z } from 'zod'
import type { httpInferenceConnectionSchema } from './protocol-values'
import { getTaskPreview } from './realtime-api'
import { createGenerationSocket, isBusinessEvent } from './websocket-client'
import type { SocketConnection } from './websocket-client'

export type RealtimeTask = { status: TaskStatus; assetId: string | null; simulated?: boolean; errorCode: string | null; errorMessage: string | null }
export type RealtimeState = {
  taskId: string | null; socketEnabled: boolean; connection: SocketConnection; connectionMessage: string | null
  inferenceConnection: z.infer<typeof httpInferenceConnectionSchema> | null; stage: GenerationEvent['stage'] | null
  completedSteps: number | null; totalSteps: number | null; task: RealtimeTask | null
  cloud: PointCloud | null; coordinateFrame: CoordinateFrame | null
  notifiedPreviewVersion: number; appliedPreviewVersion: number; previewMessage: string | null
}
export const createGenerationRealtime = (taskId: string | null, userId: string, sessionRevision: number) => {
  let state: RealtimeState = {
    taskId, socketEnabled: env.generationWebsocketEnabled, connection: 'closed', connectionMessage: null, inferenceConnection: null, stage: null,
    completedSteps: null, totalSteps: null, task: null, cloud: null, coordinateFrame: null,
    notifiedPreviewVersion: 0, appliedPreviewVersion: 0, previewMessage: null,
  }
  const isCurrent = () => getSession().revision === sessionRevision && getSession().user?.id === userId
  const listeners = new Set<() => void>()
  const sequence = createEventSequence()
  let active = false
  let settled = false
  let epoch = 0
  let previewRequest: AbortController | null = null
  let loadingVersion = 0
  let latestPreview: PreviewMetadata | null = null
  let terminalKey = ''
  let client: ReturnType<typeof createGenerationSocket> | null = null
  const publish = (patch: Partial<RealtimeState>) => {
    if (!active || !isCurrent()) return
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }
  const previewClosed = () => settled && state.task?.status !== 'FAILED'
  const acceptCloud = (cloud: PointCloud) => {
    if (!active || previewClosed() || cloud.taskId !== taskId || cloud.version <= state.appliedPreviewVersion || cloud.version <= (state.cloud?.version ?? 0)) return
    publish({ cloud, coordinateFrame: state.coordinateFrame ?? createCoordinateFrame(cloud), previewMessage: null })
  }
  const downloadPreview = async (preview: PreviewMetadata, force = false) => {
    if (!taskId || previewClosed() || !active || !isCurrent() || preview.version <= state.appliedPreviewVersion) return
    if (!force && (preview.version === loadingVersion || preview.version <= (state.cloud?.version ?? 0))) return
    previewRequest?.abort()
    const controller = new AbortController()
    const current = epoch
    previewRequest = controller
    loadingVersion = preview.version
    try {
      assertPreviewPath(preview.positionsPath, taskId, preview.version)
      const payload = await getTaskPreview(taskId, preview.version, controller.signal)
      if (controller.signal.aborted || current !== epoch || !active || previewClosed()) return
      if (payload.taskId !== taskId || payload.previewVersion !== preview.version || payload.pointCount !== preview.pointCount || payload.sourceStep !== preview.sourceStep) throw new Error('中间点云与任务预览记录不一致')
      acceptCloud(toPointCloud(payload))
    } catch (error) {
      if (!controller.signal.aborted && current === epoch && active) publish({ previewMessage: `中间预览读取失败，生成继续。${generationErrorMessage(error)}` })
    } finally {
      if (previewRequest === controller) { previewRequest = null; loadingVersion = 0 }
    }
  }
  const notifyPreview = (preview: PreviewMetadata) => {
    if (preview.version < state.notifiedPreviewVersion) return
    latestPreview = preview
    publish({ notifiedPreviewVersion: preview.version })
    void downloadPreview(preview)
  }
  const coordinateTerminal = (task: RealtimeTask) => {
    if (isTaskRunning(task.status)) return
    const key = `${task.status}:${task.assetId ?? ''}`
    if (key === terminalKey) return
    terminalKey = key
    // 只协调已有业务任务；断线和重复事件均不会 POST 新任务。
    void queryClient.invalidateQueries({ queryKey: ['generation', userId, 'task', taskId], exact: true })
    void queryClient.invalidateQueries({ queryKey: ['generation', userId, 'tasks'] })
  }
  const receive = (event: GenerationEvent) => {
    const decision = sequence.accept(event)
    if (decision !== 'accept') return decision === 'resubscribe' ? 'resubscribe' as const : undefined
    const previous = state.task
    if (previous && !isTaskRunning(previous.status)) {
      if (event.type !== 'task_snapshot' || event.payload.status !== previous.status) return
    }
    const patch: Partial<RealtimeState> = { stage: event.stage, completedSteps: event.completedSteps, totalSteps: event.totalSteps }
    let task: RealtimeTask
    if (event.type === 'task_snapshot') {
      const payload = event.payload
      task = { status: payload.status, assetId: payload.assetId ?? previous?.assetId ?? null, simulated: payload.simulated, errorCode: payload.error?.code ?? null, errorMessage: payload.error?.message ?? null }
      patch.inferenceConnection = payload.connectionState
    } else if (event.type === 'task_completed') {
      task = { ...previous, status: 'SUCCEEDED', assetId: event.payload.assetId, errorCode: null, errorMessage: null }
    } else if (event.type === 'task_failed') {
      task = { ...previous, status: 'FAILED', assetId: null, errorCode: event.payload.code, errorMessage: event.payload.message }
    } else {
      task = { ...previous, status: event.type === 'task_queued' ? 'PENDING' : event.type === 'task_started' ? 'SUBMITTING' : 'PROCESSING', assetId: null, errorCode: null, errorMessage: null }
    }
    publish({ ...patch, task })
    if (event.type === 'task_snapshot' && event.payload.latestPreview) notifyPreview(event.payload.latestPreview)
    if (event.type === 'preview_ready') {
      const payload = event.payload
      if (event.previewVersion < state.notifiedPreviewVersion) return
      latestPreview = { version: event.previewVersion, sourceStep: payload.sourceStep, pointCount: payload.pointCount, positionsPath: payload.positionsPath }
      publish({ notifiedPreviewVersion: event.previewVersion })
      previewRequest?.abort()
      acceptCloud(toPointCloud({ ...payload, taskId: event.taskId, previewVersion: event.previewVersion }))
    }
    if (event.type === 'preview_failed') publish({ previewMessage: event.payload.fatal ? '中间预览失败，正在等待任务最终状态。' : '本次中间预览未提取成功，生成继续。' })
    coordinateTerminal(task)
  }
  const start = () => {
    if (!taskId || !isCurrent()) return
    active = true
    settled = false
    const current = ++epoch
    client?.dispose()
    if (!env.generationWebsocketEnabled) {
      publish({ connection: 'closed', connectionMessage: '实时通知尚未部署，使用任务查询更新进度' })
      return
    }
    client = createGenerationSocket({
      taskId, isCurrent,
      onSubscribe: sequence.beginSnapshot,
      onConnection: (connection, connectionMessage) => { if (current === epoch) publish({ connection, connectionMessage }) },
      onEvent: (message) => {
        if (!active || !isCurrent() || current !== epoch || settled) return
        if (isBusinessEvent(message)) return receive(message)
        if (message.type === 'connection_status') publish({ inferenceConnection: message.payload.connectionState })
      },
    })
    client.start()
  }
  return {
    observeTask: (task: GenerationTask | undefined) => {
      if (!task || task.id !== taskId || settled || !active) return
      if (state.task && !isTaskRunning(state.task.status) && isTaskRunning(task.status)) return
      if (state.connection === 'connected' && isTaskRunning(task.status)) return
      const completedSteps = task.completedSteps ?? state.completedSteps
      const stageOrder = { queued: 0, preprocessing: 1, sampling: 2, preview_decoding: 2, final_decoding: 3, result_saving: 4, completed: 5, failed: 5 }
      const olderStage = task.stage && state.stage && stageOrder[task.stage] < stageOrder[state.stage] && (completedSteps ?? 0) <= (state.completedSteps ?? 0)
      const regressed = Boolean(olderStage) || (completedSteps !== null && state.completedSteps !== null && completedSteps < state.completedSteps)
      if (!regressed) publish({
        stage: task.stage ?? state.stage,
        completedSteps, totalSteps: task.totalSteps ?? state.totalSteps,
        inferenceConnection: task.connectionState ?? state.inferenceConnection,
        task: { status: task.status, assetId: task.assetId, simulated: task.simulated, errorCode: task.errorCode, errorMessage: task.errorMessage },
      })
      if (task.latestPreview) notifyPreview(task.latestPreview)
    },
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    start,
    retry: () => { if (active && !settled) client?.retry() },
    retryPreview: () => { if (latestPreview) void downloadPreview(latestPreview, true) },
    confirmPreview: (version: number) => {
      if (version === state.cloud?.version && version > state.appliedPreviewVersion) publish({ appliedPreviewVersion: version })
    },
    finish: () => {
      if (settled) return
      settled = true
      if (state.task?.status !== 'FAILED') previewRequest?.abort()
      client?.finish()
    },
    dispose: () => { active = false; epoch++; previewRequest?.abort(); client?.dispose(); client = null; loadingVersion = 0 },
  }
}

export const reconcileRealtimeTask = (task: GenerationTask | undefined, live: RealtimeTask | null): GenerationTask | undefined => {
  if (!task || !live || !isTaskRunning(task.status)) return task
  const rank: Record<TaskStatus, number> = { PENDING: 0, SUBMITTING: 1, PROCESSING: 2, SUCCEEDED: 3, FAILED: 3 }
  if (rank[live.status] < rank[task.status]) return task
  return { ...task, status: live.status, assetId: live.assetId ?? task.assetId, simulated: live.simulated ?? task.simulated, errorCode: live.errorCode, errorMessage: live.errorMessage }
}
