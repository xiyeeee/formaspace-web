import { Box, ChevronLeft, ChevronRight, History, LoaderCircle, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTaskAsset } from '../hooks/use-task-query'
import { isSimulatedResult } from '../lib/generation-presentation'
import { useProtectedImage } from '../hooks/use-protected-image'
import { generationErrorMessage, isTaskRunning, taskLabels } from '../lib/generation-errors'
import type { useTaskHistory } from '../hooks/use-task-query'
import type { GenerationTask, TaskStatus } from '../types'

const TaskCard = ({ task, selected, onSelect }: { task: GenerationTask; selected: boolean; onSelect: () => void }) => {
  const image = useProtectedImage(task.sourceFileId)
  const { data: asset } = useTaskAsset(task)
  return <button className={`task-card ${selected ? 'selected' : ''}`} onClick={onSelect} aria-pressed={selected}>
    <div className="task-thumbnail">{image ? <img src={image} alt="任务源图片" loading="lazy"/> : <Box size={29}/>}<span className="source-thumbnail-label">源图</span><span className={`task-state ${task.status.toLowerCase()}`}>{isTaskRunning(task.status) && <LoaderCircle className="animate-spin" size={11}/>} {taskLabels[task.status]}</span></div>
    <strong>{asset?.name || `创作 ${task.id.slice(-6)}`}</strong><small>{isSimulatedResult(task, asset) ? '演示任务 · ' : ''}{new Date(task.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</small>
  </button>
}
export type TaskHistoryProps = {
  history: ReturnType<typeof useTaskHistory>; currentTask?: GenerationTask; selectedId: string | null; onSelect: (task: GenerationTask) => void
  page: number; onPageChange: (page: number) => void; status?: TaskStatus; onStatusChange: (status?: TaskStatus) => void; onNew: () => void
}
export const TaskHistory = ({ history, currentTask, selectedId, onSelect, page, onPageChange, status, onStatusChange, onNew }: TaskHistoryProps) => (
  <section className="task-history" aria-label="历史任务">
    <div className="history-heading"><h2>我的创作 <small>{history.data?.total ?? '—'}</small></h2><div><Button variant="ghost" size="icon-sm" onClick={() => void history.refetch()} disabled={history.isFetching} aria-label="刷新历史任务"><RefreshCw size={14} className={history.isFetching ? 'animate-spin' : ''}/></Button><Button variant="ghost" size="icon-sm" aria-label="开始新创作" onClick={onNew}><Plus size={16}/></Button></div></div>
    <label className="history-filter"><span>任务状态</span><select value={status ?? ''} onChange={(event) => onStatusChange(event.target.value ? event.target.value as TaskStatus : undefined)}><option value="">全部任务</option>{Object.entries(taskLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    {history.isPending && <div className="history-empty"><LoaderCircle className="animate-spin" size={22}/><p>读取创作记录…</p></div>}
    {history.isError && <div className="panel-error" role="alert"><p>{generationErrorMessage(history.error)}</p><Button size="sm" variant="outline" onClick={() => void history.refetch()}>重试</Button></div>}
    {history.data?.records.length === 0 && <div className="history-empty"><History size={25}/><p>{status ? '没有此状态的任务' : '你的灵感，等待成形'}</p><small>{status ? '试试其他筛选条件' : '从左侧上传第一张图片'}</small></div>}
    <div className="task-grid">{history.data?.records.map((record) => {
      const task = currentTask?.id === record.id ? currentTask : record
      return <TaskCard key={task.id} task={task} selected={selectedId === task.id} onSelect={() => onSelect(task)}/>
    })}</div>
    {history.data && (page > 1 || history.data.total > history.data.size) && <div className="history-pagination"><Button variant="ghost" size="icon-sm" disabled={page === 1 || history.isFetching} aria-label="上一页" onClick={() => onPageChange(page - 1)}><ChevronLeft/></Button><span>{page} / {Math.max(1, Math.ceil(history.data.total / history.data.size))}</span><Button variant="ghost" size="icon-sm" disabled={page * history.data.size >= history.data.total || history.isFetching} aria-label="下一页" onClick={() => onPageChange(page + 1)}><ChevronRight/></Button></div>}
  </section>
)
