import { z } from 'zod'
import { taskStatusSchema } from '../../types'
import { stageSchema, inferenceConnectionSchema as connectionSchema, previewMetadataSchema as metadataSchema } from './protocol-values'

export const MAX_REALTIME_BYTES = 2 * 1024 * 1024
const count = z.number().int().nonnegative().safe()
const taskId = z.string().min(1).max(128)
const timestamp = z.string().datetime({ offset: true })
const positionsSchema = z.array(z.tuple([z.number().finite().min(-3.4028234e38).max(3.4028234e38), z.number().finite().min(-3.4028234e38).max(3.4028234e38), z.number().finite().min(-3.4028234e38).max(3.4028234e38)])).min(1).max(5000)
const cloudPayloadSchema = z.object({ sourceStep: count, pointCount: count.min(1).max(5000), positions: positionsSchema, positionsPath: z.string().max(512), decodeSeconds: z.number().finite().nonnegative().optional() }).refine((cloud) => cloud.pointCount === cloud.positions.length)
export const previewResponseSchema = z.object({ taskId, previewVersion: count.min(1), sourceStep: count, pointCount: count.min(1).max(5000), positions: positionsSchema }).refine((cloud) => cloud.pointCount === cloud.positions.length)
const base = {
  protocolVersion: z.literal(1), taskId, sequence: count, stage: stageSchema,
  completedSteps: count.nullish().transform((value) => value ?? null),
  totalSteps: count.min(1).nullish().transform((value) => value ?? null),
  previewVersion: count, timestamp,
}
const plainPayload = z.object({}).passthrough()
const eventSchemas = [
  z.object({ ...base, type: z.literal('task_snapshot'), payload: z.object({ status: taskStatusSchema, simulated: z.boolean(), connectionState: connectionSchema, latestPreview: metadataSchema.nullable(), assetId: z.string().min(1).nullable(), error: z.object({ code: z.string(), message: z.string() }).nullable() }) }),
  z.object({ ...base, type: z.literal('task_queued'), payload: plainPayload }),
  z.object({ ...base, type: z.literal('task_started'), payload: plainPayload }),
  z.object({ ...base, type: z.literal('sampling_step'), payload: plainPayload }),
  z.object({ ...base, type: z.literal('preview_started'), payload: plainPayload }),
  z.object({ ...base, type: z.literal('preview_ready'), payload: cloudPayloadSchema }),
  z.object({ ...base, type: z.literal('preview_failed'), payload: z.object({ fatal: z.boolean(), code: z.string().optional(), message: z.string().optional() }) }),
  z.object({ ...base, type: z.literal('finalizing'), payload: plainPayload }),
  z.object({ ...base, type: z.literal('result_saving'), payload: plainPayload }),
  z.object({ ...base, type: z.literal('task_completed'), payload: z.object({ status: z.literal('SUCCEEDED'), assetId: z.string().min(1) }) }),
  z.object({ ...base, type: z.literal('task_failed'), payload: z.object({ status: z.literal('FAILED'), code: z.string(), message: z.string() }) }),
  z.object({ protocolVersion: z.literal(1), type: z.literal('pong'), requestId: z.string().min(1).max(128) }),
  z.object({ protocolVersion: z.literal(1), type: z.literal('error'), code: z.string().max(128), message: z.string().max(1000), taskId: taskId.optional() }),
  z.object({ protocolVersion: z.literal(1), type: z.literal('connection_status'), taskId, payload: z.object({ connectionState: connectionSchema }) }),
] as const
const messageSchema = z.discriminatedUnion('type', eventSchemas)
export type GenerationMessage = z.infer<typeof messageSchema>
export type GenerationEvent = Extract<GenerationMessage, { sequence: number }>
export type PreviewMetadata = z.infer<typeof metadataSchema>
export type PreviewResponse = z.infer<typeof previewResponseSchema>
export type GenerationStage = z.infer<typeof stageSchema>
export type InferenceConnection = z.infer<typeof connectionSchema>
export type PointCloud = { taskId: string; version: number; sourceStep: number; positions: Float32Array; pointCount: number }
export type CoordinateFrame = { center: [number, number, number]; scale: number }
export class RealtimeProtocolError extends Error {
  readonly closeCode: number
  constructor(message: string, closeCode = 1002) { super(message); this.name = 'RealtimeProtocolError'; this.closeCode = closeCode }
}
const eventStages: Partial<Record<GenerationEvent['type'], GenerationStage>> = {
  task_queued: 'queued', task_started: 'preprocessing', sampling_step: 'sampling', preview_started: 'preview_decoding',
  preview_ready: 'sampling', preview_failed: 'sampling', finalizing: 'final_decoding', result_saving: 'result_saving', task_completed: 'completed', task_failed: 'failed',
}
export const previewPath = (id: string, version: number) => `/api/generation/tasks/${encodeURIComponent(id)}/previews/${version}`
export const assertPreviewPath = (path: string, id: string, version: number) => {
  if (path !== previewPath(id, version)) throw new RealtimeProtocolError('中间预览地址与当前任务不一致')
}
export const parseGenerationMessage = (raw: unknown): GenerationMessage => {
  if (typeof raw !== 'string') throw new RealtimeProtocolError('实时服务返回了不支持的消息格式')
  if (raw.length > MAX_REALTIME_BYTES || new TextEncoder().encode(raw).byteLength > MAX_REALTIME_BYTES) throw new RealtimeProtocolError('实时消息超过大小限制，已切换任务查询', 1009)
  let payload: unknown
  try { payload = JSON.parse(raw) } catch { throw new RealtimeProtocolError('实时服务返回了无效 JSON') }
  const parsed = messageSchema.safeParse(payload)
  if (!parsed.success) throw new RealtimeProtocolError('实时消息协议或点云数据无效，请检查服务版本')
  const message = parsed.data
  if (!('sequence' in message)) return message
  if (message.completedSteps !== null && message.totalSteps !== null && message.completedSteps > message.totalSteps) throw new RealtimeProtocolError('实时采样步数超出总步数')
  if (eventStages[message.type] && eventStages[message.type] !== message.stage) throw new RealtimeProtocolError('实时事件与生成阶段不一致')
  if (message.type === 'preview_ready') {
    if (message.previewVersion < 1 || (message.completedSteps !== null && message.payload.sourceStep > message.completedSteps)) throw new RealtimeProtocolError('中间点云版本或采样步数无效')
    assertPreviewPath(message.payload.positionsPath, message.taskId, message.previewVersion)
  }
  if (message.type === 'task_snapshot') {
    const preview = message.payload.latestPreview
    if (preview) {
      if (preview.version > message.previewVersion) throw new RealtimeProtocolError('快照点云版本无效')
      assertPreviewPath(preview.positionsPath, message.taskId, preview.version)
    }
    if ((message.payload.status === 'SUCCEEDED') !== (message.stage === 'completed') || (message.payload.status === 'FAILED') !== (message.stage === 'failed')) throw new RealtimeProtocolError('任务快照的终态不一致')
  }
  return message
}

// 控制帧不参与序号；同序号快照仍能补回预览和终态数据。
export const createEventSequence = () => {
  let lastSequence = -1
  let awaitingSnapshot = true
  return {
    beginSnapshot: () => { awaitingSnapshot = true },
    accept: (event: GenerationEvent): 'accept' | 'ignore' | 'resubscribe' => {
      if (event.type === 'task_snapshot') {
        if (!awaitingSnapshot && event.sequence < lastSequence) return 'ignore'
        awaitingSnapshot = false
        lastSequence = event.sequence
        return 'accept'
      }
      if (awaitingSnapshot || event.sequence <= lastSequence) return 'ignore'
      if (event.sequence > lastSequence + 1) { awaitingSnapshot = true; return 'resubscribe' }
      lastSequence = event.sequence
      return 'accept'
    },
  }
}
export const toPointCloud = (preview: PreviewResponse): PointCloud => ({
  taskId: preview.taskId, version: preview.previewVersion, sourceStep: preview.sourceStep,
  pointCount: preview.pointCount, positions: new Float32Array(preview.positions.flat()),
})
export const createCoordinateFrame = (cloud: PointCloud): CoordinateFrame => {
  const minimum = [Infinity, Infinity, Infinity]
  const maximum = [-Infinity, -Infinity, -Infinity]
  // 热路径按坐标遍历，首份真实点云只计算一次；后续预览和 GLB 共用此变换。
  for (let index = 0; index < cloud.positions.length; index++) {
    const axis = index % 3
    minimum[axis] = Math.min(minimum[axis], cloud.positions[index])
    maximum[axis] = Math.max(maximum[axis], cloud.positions[index])
  }
  const extent = Math.max(...maximum.map((value, axis) => value - minimum[axis]))
  return { center: minimum.map((value, axis) => -(value + maximum[axis]) / 2) as CoordinateFrame['center'], scale: extent > 0 && Number.isFinite(extent) ? 3.4 / extent : 1 }
}
