import type { GenerationMode, GenerationTask, ModelAsset } from '../types'

export const isSimulatedResult = (task?: GenerationTask, asset?: ModelAsset) => asset?.simulated ?? task?.simulated ?? false
export const viewportModeLabel = (mode?: GenerationMode, available?: boolean, task?: GenerationTask, asset?: ModelAsset) => {
  if (task || asset) return isSimulatedResult(task, asset) ? '演示结果' : '真实生成'
  if (mode === 'MOCK') return '演示模式'
  if (mode === 'DISABLED') return '生成未启用'
  if (mode === 'PYTHON_REALTIME') return available ? '实时生成' : '等待服务就绪'
  if (mode === 'HUNYUAN_LOCAL') return available ? '本地生成' : '等待服务就绪'
  return null
}
