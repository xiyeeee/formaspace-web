import { useGenerationTiming } from '../hooks/use-generation-timing'
import { formatTaskDuration } from '../lib/generation-timing'
import type { GenerationTask } from '../types'

type Props = { task?: GenerationTask; history: GenerationTask[]; stage?: string | null; completed?: number | null; total?: number | null }
type Timing = NonNullable<ReturnType<typeof useGenerationTiming>>
const elapsedLabel = (timing: Timing) => {
  if (timing.terminal) {
    if (timing.elapsed !== null) return `实际耗时 ${formatTaskDuration(timing.elapsed)}`
    if (timing.started === null && timing.finished !== null && timing.queueSeconds !== null) return `未开始运行 · 排队 ${formatTaskDuration(timing.queueSeconds)}`
    return '正在核对实际耗时…'
  }
  if (timing.queued) return timing.waitingSeconds !== null ? `排队已等 ${formatTaskDuration(timing.waitingSeconds)}` : '排队中'
  return timing.elapsed !== null ? `已用 ${formatTaskDuration(timing.elapsed)}` : '正在同步计时…'
}
export const GenerationTiming = ({ task, history, stage, completed, total }: Props) => {
  const timing = useGenerationTiming(task, history, stage, completed, total)
  if (!timing) return null
  const { elapsed, estimate, queued, terminal } = timing
  const finalizing = stage === 'final_decoding' || stage === 'result_saving' || Boolean(completed !== null && completed !== undefined && total && completed >= total)
  const range = estimate ? `${formatTaskDuration(Math.max(1, Math.round(estimate.lower / 10) * 10))}～${formatTaskDuration(Math.ceil(estimate.upper / 10) * 10)}` : ''
  const title = estimate ? `参考 ${estimate.samples} 个相近参数成功任务的 Java 起止时间，含预览、最终网格和保存，耗时会随设备和服务负载变化` : '需要至少两个相近参数的成功任务，不将采样进度当作整体进度'
  return <div className="generation-task-timing" data-terminal={terminal} title={title} aria-label="生成耗时">
    <span>{elapsedLabel(timing)}</span>
    {!terminal && !queued && <small>{estimate ? estimate.exceeded ? '已超出历史耗时范围，仍在处理中' : `预计总时长约 ${range}` : '正在估算'}</small>}
    {!terminal && queued && <small>开始运行后估算耗时</small>}
    {!terminal && finalizing && <small>{stage === 'result_saving' ? '正在保存作品' : '采样已结束，正在生成最终网格'}</small>}
    {terminal && timing.metadataError && elapsed === null && <small>暂时无法读取任务时间</small>}
  </div>
}
