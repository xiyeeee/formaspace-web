import { Button } from '@/components/ui/button'
import type { GenerationRealtime } from '../hooks/use-generation-realtime'
import { isTaskRunning } from '../lib/generation-errors'
import type { TaskStatus } from '../types'

const browserLabels = { connecting: '连接中', subscribing: '订阅任务中', connected: '已连接', reconnecting: '恢复中', closed: '未连接' }
const inferenceLabels = { CONNECTED: '正常', RECONNECTING: '恢复中', DISCONNECTED: '已断开', RECONCILING: '协调状态中', CONNECTING: '连接中', SERVICE_CHANGED: '服务配置已变化', CLOSED: '已关闭' }
export const GenerationRealtimeStatus = ({ realtime, status, queryReconnecting }: { realtime: GenerationRealtime; status?: TaskStatus; queryReconnecting?: boolean }) => {
  if (!realtime.taskId) return null
  const terminal = status && !isTaskRunning(status)
  return <div className="generation-realtime-status" role="status">
    <div className="realtime-connections"><span data-connected={realtime.connection === 'connected'}>实时通知 · {terminal ? '任务已结束' : browserLabels[realtime.connection]}</span>{realtime.inferenceConnection && !terminal && <span data-connected={realtime.inferenceConnection === 'CONNECTED'}>推理连接 · {inferenceLabels[realtime.inferenceConnection]}</span>}</div>
    {!terminal && queryReconnecting && <p>任务查询暂不可用，正在重试，保留上次进度。</p>}
    {!terminal && realtime.connectionMessage && <p>{realtime.connectionMessage}</p>}
    {!terminal && realtime.inferenceConnection && realtime.inferenceConnection !== 'CONNECTED' && <p>{realtime.inferenceConnection === 'SERVICE_CHANGED' ? '推理服务配置已变化，任务暂停处理，请核对服务配置。' : '保留当前预览，等待推理服务同步任务状态。'}</p>}
    {!terminal && realtime.socketEnabled && realtime.connection === 'closed' && <Button variant="ghost" size="xs" onClick={realtime.retry}>重试实时连接</Button>}
    {realtime.previewMessage && !terminal && <div className="realtime-preview-notice"><p>{realtime.previewMessage}</p>{realtime.notifiedPreviewVersion > realtime.appliedPreviewVersion && <Button variant="ghost" size="xs" onClick={realtime.retryPreview}>重试中间预览</Button>}</div>}
  </div>
}
