import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { useSession } from '@/features/auth/lib/session-state'
import { UploadPanel } from '../components/upload-panel'
import { ModelViewport } from '../components/model-viewport'
import { TaskHistory } from '../components/task-history'
import { AssetDetails } from '../components/asset-details'
import { useImageUpload } from '../hooks/use-image-upload'
import { useTaskHistory, useTaskQuery } from '../hooks/use-task-query'
import { useTaskSubmission } from '../hooks/use-task-submission'
import { getAsset, getCapabilities } from '../lib/generation-api'
import { adaptCapabilities, buildTaskRequest, initialDraft } from '../lib/generation-settings'
import { generationErrorMessage, isTaskRunning } from '../lib/generation-errors'
import { queryClient } from '@/lib/query-client'
import type { GenerationDraft, GenerationTask, TaskStatus } from '../types'

export const StudioPage = () => {
  const session = useSession()
  return <StudioWorkspace key={session.user!.id} userId={session.user!.id}/>
}
const StudioWorkspace = ({ userId }: { userId: string }) => {
  const [params, setParams] = useSearchParams()
  const taskId = params.get('taskId')
  const [draft, setDraft] = useState<GenerationDraft>(initialDraft)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<TaskStatus>()
  const [newDraft, setNewDraft] = useState(false)
  const upload = useImageUpload()
  const capabilities = useQuery({ queryKey: ['generation', userId, 'capabilities'], queryFn: ({ signal }) => getCapabilities(signal), select: adaptCapabilities, retry: false })
  const history = useTaskHistory(page, status)
  const taskQuery = useTaskQuery(taskId)
  const task = taskQuery.data
  const assetQuery = useQuery({
    queryKey: ['generation', userId, 'asset', task?.assetId],
    queryFn: ({ signal }) => getAsset(task!.assetId!, signal),
    enabled: task?.status === 'SUCCEEDED' && Boolean(task.assetId), retry: false,
  })
  const selectTask = (selected: GenerationTask) => {
    queryClient.setQueryData(['generation', userId, 'task', selected.id], selected)
    setParams({ taskId: selected.id })
  }
  const submission = useTaskSubmission(selectTask)
  useEffect(() => {
    if (taskId || newDraft || page !== 1 || status || submission.pending) return
    const active = history.data?.records.find((record) => isTaskRunning(record.status))
    if (active) setParams({ taskId: active.id }, { replace: true })
  }, [taskId, newDraft, page, status, history.data, submission.pending, setParams])
  useEffect(() => {
    if (task && !isTaskRunning(task.status)) void queryClient.invalidateQueries({ queryKey: ['generation', userId, 'tasks'] })
  }, [task, userId])
  const startNew = () => { setNewDraft(true); setParams({}); setDraftError(null) }
  const generate = () => {
    if (!capabilities.data?.canGenerate || !upload.selection?.uploaded || submission.pending) return
    try {
      const request = buildTaskRequest(capabilities.data, draft, upload.selection.uploaded.id)
      setDraftError(null)
      submission.submit(request)
    } catch (cause) { setDraftError(generationErrorMessage(cause)) }
  }
  return <div className="studio-workbench">
    <UploadPanel upload={upload} submission={submission} capabilities={capabilities.data} capabilityError={capabilities.error} capabilityLoading={capabilities.isPending}
      onRetryCapabilities={() => void capabilities.refetch()} draft={draft} onDraftChange={(next) => { setDraft(next); setDraftError(null) }}
      onSelectFile={(file) => { if (capabilities.data) { setNewDraft(true); void upload.select(file, capabilities.data) } }} onGenerate={generate} draftError={draftError} running={Boolean(task && isTaskRunning(task.status))}/>
    <ModelViewport mode={capabilities.data?.mode} key={taskId || 'draft'} task={task} asset={assetQuery.data} taskError={taskQuery.error} loading={Boolean(taskId && taskQuery.isPending)} onRetryTask={() => void taskQuery.refetch()}/>
    <aside className="history-panel"><div className="right-panel-tabs"><span className="active">创作记录</span><span>HISTORY & DETAILS</span></div><div className="right-panel-scroll"><TaskHistory history={history} selectedId={taskId} onSelect={selectTask} page={page} onPageChange={setPage} status={status} onStatusChange={(next) => { setStatus(next); setPage(1) }} onNew={startNew}/><AssetDetails key={taskId} task={task} asset={assetQuery.data} error={assetQuery.error} loading={assetQuery.isFetching} onRetry={() => { if (task?.assetId) void assetQuery.refetch(); else void taskQuery.refetch() }}/></div></aside>
  </div>
}
