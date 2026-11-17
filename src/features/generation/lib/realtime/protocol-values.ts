import { z } from 'zod'

export const stageSchema = z.enum(['queued', 'preprocessing', 'sampling', 'preview_decoding', 'final_decoding', 'result_saving', 'completed', 'failed'])
export const httpStageSchema = z.string().transform((value) => {
  const parsed = stageSchema.safeParse(value === 'saving_result' ? 'result_saving' : value)
  return parsed.success ? parsed.data : null
})
export const httpInferenceConnectionSchema = z.enum(['CONNECTED', 'RECONNECTING', 'DISCONNECTED', 'RECONCILING', 'CONNECTING', 'SERVICE_CHANGED', 'CLOSED'])
export const inferenceConnectionSchema = z.enum(['CONNECTED', 'RECONNECTING', 'DISCONNECTED'])
export const previewMetadataSchema = z.object({
  version: z.number().int().positive().safe(), sourceStep: z.number().int().nonnegative().safe(),
  pointCount: z.number().int().min(1).max(5000), positionsPath: z.string().max(512),
})
export const generationStageLabels: Record<z.infer<typeof stageSchema>, string> = {
  queued: '等待处理', preprocessing: '图片预处理', sampling: '形状采样', preview_decoding: '正在提取中间预览',
  final_decoding: '生成最终网格', result_saving: '保存模型', completed: '已完成', failed: '生成失败',
}
