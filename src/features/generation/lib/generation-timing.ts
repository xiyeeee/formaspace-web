import type { GenerationTask } from '../types'

export type TaskTimes = Pick<GenerationTask, 'createdAt' | 'startedAt' | 'finishedAt'>
export const timestamp = (value: string | null | undefined) => {
  const parsed = value ? Date.parse(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}
export const formatTaskDuration = (seconds: number) => {
  const rounded = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor(rounded % 3600 / 60)
  const remainder = rounded % 60
  return hours ? `${hours}时${minutes}分${remainder}秒` : minutes ? `${minutes}分${remainder}秒` : `${remainder}秒`
}
export const taskElapsed = (times: TaskTimes, terminal: boolean, now: number) => {
  const created = timestamp(times.createdAt)
  const started = timestamp(times.startedAt)
  const finished = timestamp(times.finishedAt)
  const end = terminal ? finished : now
  return {
    elapsed: started !== null && end !== null && end >= started ? (end - started) / 1000 : null,
    queued: created !== null && (started ?? end) !== null ? Math.max(0, ((started ?? end)! - created) / 1000) : null,
    started, finished,
  }
}
const similar = (current: GenerationTask, history: GenerationTask) => {
  const parameters = current.resolvedParameters
  const previous = history.resolvedParameters
  if (!parameters || !previous || history.id === current.id || history.status !== 'SUCCEEDED' || current.simulated !== history.simulated) return false
  return parameters.profileId === previous.profileId && parameters.quality === previous.quality
    && parameters.octreeResolution === previous.octreeResolution && parameters.numChunks === previous.numChunks
    && parameters.generateTexture === previous.generateTexture && parameters.removeBackground === previous.removeBackground
    && parameters.guidanceScale === previous.guidanceScale
    && previous.inferenceSteps > 0 && parameters.inferenceSteps / previous.inferenceSteps >= 0.8
    && parameters.inferenceSteps / previous.inferenceSteps <= 1.25
}
export const estimateTaskDuration = (task: GenerationTask, history: GenerationTask[], elapsed: number, stage?: string | null, completed?: number | null, total?: number | null) => {
  const durations = history.filter((previous) => similar(task, previous)).map((previous) => {
    const start = timestamp(previous.startedAt)
    const end = timestamp(previous.finishedAt)
    return start !== null && end !== null && end > start ? (end - start) / 1000 : null
  }).filter((duration): duration is number => duration !== null).sort((first, second) => first - second)
  if (durations.length < 2) return null
  const quantile = (fraction: number) => {
    const position = (durations.length - 1) * fraction
    const lower = Math.floor(position)
    return durations[lower] + (durations[Math.ceil(position)] - durations[lower]) * (position - lower)
  }
  let lower = quantile(0.25) * 0.8
  let upper = quantile(0.75) * 1.25
  // Sampling speed is only a lower bound: previews, final mesh decode and Java saving still cost time.
  if (stage === 'sampling' && completed && total && completed < total && elapsed > 0) {
    const projectedSampling = elapsed * total / completed
    lower = Math.max(lower, projectedSampling)
    upper = Math.max(upper, projectedSampling + (quantile(0.75) - quantile(0.25)) + quantile(0.25) * 0.25)
  }
  return { lower, upper, samples: durations.length, exceeded: elapsed > upper }
}
