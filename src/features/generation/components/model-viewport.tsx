import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Grid3X3, LoaderCircle, Maximize, MousePointer2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Vector3 } from 'three'
import type { GenerationRealtime } from '../hooks/use-generation-realtime'
import { GenerationRealtimeStatus } from './generation-realtime-status'
import { generationStageLabels } from '../lib/realtime/protocol-values'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useModelResource } from '../hooks/use-model-resource'
import { generationErrorMessage, isTaskQueryRetryable, isTaskRunning, taskFailureMessage, taskLabels } from '../lib/generation-errors'
import { isSimulatedResult, viewportModeLabel } from '../lib/generation-presentation'
import type { GenerationMode, GenerationTask, ModelAsset } from '../types'
const ViewportScene = lazy(() => import('./viewport-scene').then((module) => ({ default: module.ViewportScene })))

class ViewportBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError = () => ({ failed: true })
  componentDidCatch = () => this.props.onFailure()
  render = () => this.state.failed ? null : this.props.children
}
type Props = { realtime?: GenerationRealtime; mode?: GenerationMode; generationAvailable?: boolean; reconnecting?: boolean; task?: GenerationTask; asset?: ModelAsset; taskError: unknown; loading: boolean; onRetryTask: () => void }
export const ModelViewport = ({ realtime, mode, generationAvailable, reconnecting, task, asset, taskError, loading, onRetryTask }: Props) => {
  const container = useRef<HTMLDivElement>(null)
  const [grid, setGrid] = useState(true)
  const [reset, setReset] = useState(0)
  const [retry, setRetry] = useState(0)
  const [sceneFailed, setSceneFailed] = useState(false)
  const [longWaiting, setLongWaiting] = useState(false)
  const resource = useModelResource(asset?.id, retry)
  const coordinateFrame = realtime?.coordinateFrame
  const modelNormalization = resource?.normalization
  const normalization = useMemo(() => coordinateFrame
    ? { center: new Vector3(...coordinateFrame.center), scale: coordinateFrame.scale }
    : modelNormalization, [coordinateFrame, modelNormalization])
  const onFailure = useCallback(() => setSceneFailed(true), [])
  const liveTask = realtime?.task
  const displayedStatus = task?.status ?? liveTask?.status
  const running = displayedStatus && isTaskRunning(displayedStatus)
  const displayTaskError = taskError && (!liveTask || !isTaskQueryRetryable(taskError))
  const restoringTask = loading && !liveTask
  const previewLoading = Boolean(asset && !resource)
  const modeLabel = viewportModeLabel(mode, generationAvailable, task, asset)
  const simulated = task || asset ? isSimulatedResult(task, asset) : Boolean(liveTask?.simulated)
  const startedAt = task?.startedAt ?? task?.createdAt
  useEffect(() => {
    if (!running || !startedAt) return
    const start = Date.parse(startedAt)
    if (!Number.isFinite(start)) return
    const timer = window.setTimeout(() => setLongWaiting(true), Math.max(0, 5 * 60_000 - (Date.now() - start)))
    return () => window.clearTimeout(timer)
  }, [running, startedAt])
  const sampled = realtime?.completedSteps
  const totalSteps = realtime?.totalSteps
  const samplingProgress = sampled !== null && sampled !== undefined && totalSteps && sampled <= totalSteps ? sampled / totalSteps * 100 : null
  const stageLabel = realtime?.stage ? generationStageLabels[realtime.stage] : task ? taskLabels[task.status] : ''
  const progress = task?.progress
  const validProgress = typeof progress === 'number' && Number.isFinite(progress) && progress >= 0 && progress <= 100
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await container.current?.requestFullscreen()
    } catch { toast.error('当前浏览器无法进入全屏') }
  }
  return <section className={`model-viewport ${realtime?.cloud ? 'has-real-cloud' : ''}`} ref={container} aria-label="三维模型预览">
    <div className="viewport-topline"><div><Box size={15}/><span>{asset?.name || (task ? `创作 ${task.id.slice(-6)}` : '创作空间')}<small>/ {task ? taskLabels[task.status] : '等待灵感'}</small></span></div><div className="viewport-flags">{modeLabel && <span className="viewport-mode">{modeLabel}</span>}<span className="viewport-filetype">{asset ? 'GLB' : '3D VIEW'}</span></div></div>
    <div className="viewport-canvas">
      {!sceneFailed && <ViewportBoundary key={retry} onFailure={onFailure}><Suspense fallback={<div className="viewport-loader"><LoaderCircle className="animate-spin"/></div>}><ViewportScene model={resource?.gltf} normalization={normalization} cloud={realtime?.cloud ?? undefined} onPreviewApplied={realtime?.confirmPreview} grid={grid} reset={reset} onFailure={onFailure}/></Suspense></ViewportBoundary>}
    </div>
    {realtime && <GenerationRealtimeStatus realtime={realtime} status={displayedStatus} queryReconnecting={reconnecting}/>}
    <div className="viewport-axis" aria-hidden="true"><span>Y</span><i/><b>X</b><em>Z</em></div>
    {(!resource?.gltf || running || displayTaskError || restoringTask || sceneFailed) && <div className="viewport-message" role="status">
      {sceneFailed ? <><h2>三维视口暂不可用</h2><p>作品状态和下载不受影响。</p><Button variant="outline" onClick={() => { setSceneFailed(false); setRetry((value) => value + 1) }}>重试视口</Button></>
        : displayTaskError ? <><h2>暂时无法读取任务</h2><p>{generationErrorMessage(taskError)}</p>{reconnecting && <p>正在自动重试连接，保留上次状态；这不代表生成失败。</p>}<Button variant="outline" onClick={onRetryTask}>重试查询</Button></>
        : restoringTask ? <><h2>正在恢复创作</h2><p>读取任务记录…</p></>
        : resource?.error ? <><h2>模型预览未加载</h2><p>{resource.error}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>重新加载模型</Button></>
        : previewLoading ? <><h2>正在加载模型</h2><p>获取受保护的 GLB 文件…</p></>
        : running ? <><span className="viewport-kicker">{(task?.simulated ?? liveTask?.simulated) ? 'DEMO GENERATION' : 'GENERATION'}</span><h2>{stageLabel}<span className="status-dots">…</span></h2><p>{realtime?.cloud ? `${simulated ? '演示' : '真实'}中间点云 · 第 ${realtime.cloud.sourceStep} 步 · ${realtime.cloud.pointCount.toLocaleString()} 点` : '下方点云为等待示意，不代表实际模型。'}</p>{longWaiting && <p>等待时间较长，可稍后从历史记录查看；离开页面不会取消任务。</p>}{samplingProgress !== null ? <div className="sampling-progress"><p>形状采样 {sampled}/{totalSteps} · {Math.round(samplingProgress)}%</p><Progress aria-label="形状采样进度" value={samplingProgress}/>{sampled === totalSteps && <small>采样已结束，仍需生成最终网格并保存作品。</small>}</div> : validProgress ? <div className="task-progress"><Progress value={progress}/><span>{progress}%</span></div> : <div className="waiting-bar" aria-label="任务处理中，暂无进度数据"/>}</>
        : task?.status === 'FAILED' ? <><h2>这次灵感，尚未成形</h2><p>{taskFailureMessage(task.errorCode, task.errorMessage)}</p></>
        : task?.status === 'SUCCEEDED' ? <><h2>生成已完成</h2><p>请在右侧读取作品，或重试获取作品信息。</p></>
        : <><span className="viewport-kicker">A NEW DIMENSION OF CREATIVITY</span><h2>让灵感，立体呈现<span>。</span></h2><p>上传一张图片，探索想象的另一面。</p></>}
    </div>}
    <div className="viewport-bottom"><span className="viewport-help"><MousePointer2 size={13}/>拖拽旋转 · 滚轮缩放</span><div className="viewport-tools" role="group" aria-label="视口工具"><Button variant="ghost" onClick={() => setGrid((value) => !value)} aria-pressed={grid} title="切换地面网格"><Grid3X3 size={16}/><span>网格</span></Button><span className="tool-divider"/><Button variant="ghost" onClick={() => setReset((value) => value + 1)} title="重置镜头"><RotateCcw size={16}/><span>重置</span></Button></div><Button variant="ghost" size="icon" onClick={() => void fullscreen()} aria-label="切换全屏"><Maximize size={19}/></Button></div>
    <div className="viewport-caption"><span>{!resource?.gltf ? realtime?.cloud ? simulated ? '演示中间点云 · 非最终模型' : '真实中间点云 · 非最终模型' : '等待示意 · 非实际模型' : simulated ? '演示结果 · 非上传图片的真实重建' : '真实生成结果 · GLB 预览'}</span><span>让想象拥有形状</span></div>
  </section>
}
