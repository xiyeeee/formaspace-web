import { RealtimeProtocolError } from './generation-events'
import type { GenerationMessage, PointCloud } from './generation-events'

type PointBatch = Extract<GenerationMessage, { type: 'point_batch' }>
export const createPointBatchBuffer = (taskId: string, version: number, baseSequence: number, sourceStep: number, totalPointCount: number) => {
  const positions = new Float32Array(totalPointCount * 3)
  let received = 0
  return {
    append: (message: PointBatch): PointCloud | null => {
      const batch = message.payload
      if (message.taskId !== taskId || message.previewVersion !== version || message.baseSequence !== baseSequence || batch.sourceStep !== sourceStep || batch.totalPointCount !== totalPointCount) throw new RealtimeProtocolError('点云分片与当前预览不一致')
      if (batch.offset < received) {
        if (batch.offset + batch.pointCount > received || batch.positions.some((point, index) => point.some((value, axis) => Math.fround(value) !== positions[(batch.offset + index) * 3 + axis]))) throw new RealtimeProtocolError('重复点云分片的坐标不一致')
        return null
      }
      if (batch.offset !== received) throw new RealtimeProtocolError('点云分片不连续，需要恢复完整预览')
      positions.set(batch.positions.flat(), received * 3)
      received += batch.pointCount
      return { taskId, version, sourceStep, pointCount: received, totalPointCount, batchSize: 50, positions: positions.slice(0, received * 3) }
    },
  }
}
