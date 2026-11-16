import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { createTaskSchema } from '../types'
import type { CreateTaskRequest, GenerationTask, PendingSubmission } from '../types'
import { createTask } from '../lib/generation-api'
import { generationErrorMessage, isSubmissionUncertain } from '../lib/generation-errors'
import { getSession, useSession } from '@/features/auth/lib/session-state'
import { readSessionDraft, writeSessionDraft } from '@/lib/session-drafts'
import { ApiError } from '@/lib/http'
import { queryClient } from '@/lib/query-client'

const pendingSchema = z.object({ key: z.uuid(), request: createTaskSchema })
export const useTaskSubmission = (onCreated: (task: GenerationTask) => void) => {
  const session = useSession()
  const userId = session.user!.id
  const [pending, setPending] = useState<PendingSubmission | null>(() => pendingSchema.safeParse(readSessionDraft(userId)).data ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useRef<{ controller: AbortController; revision: number } | null>(null)
  useEffect(() => () => { active.current?.controller.abort() }, [])
  const save = (next: PendingSubmission | null) => {
    setPending(next)
    if (!writeSessionDraft(userId, next) && next) toast.info('浏览器未允许保存待确认提交，请在当前页面完成确认。')
  }
  const send = async (submission: PendingSubmission) => {
    if (active.current) return
    const request = { controller: new AbortController(), revision: session.revision }
    active.current = request
    setSubmitting(true)
    setError(null)
    save(submission)
    try {
      const task = await createTask(submission.request, submission.key, request.controller.signal)
      if (request.controller.signal.aborted || getSession().revision !== request.revision) return
      save(null)
      onCreated(task)
      void queryClient.invalidateQueries({ queryKey: ['generation', userId] })
    } catch (cause) {
      if (request.controller.signal.aborted || getSession().revision !== request.revision) return
      const uncertain = isSubmissionUncertain(cause) || (cause instanceof ApiError && cause.status === 409)
      if (!uncertain) save(null)
      setError(uncertain ? `${generationErrorMessage(cause)} 请使用同一提交记录重试确认，或先核对历史任务。` : generationErrorMessage(cause))
      void queryClient.invalidateQueries({ queryKey: ['generation', userId] })
    } finally {
      if (!request.controller.signal.aborted && getSession().revision === request.revision) setSubmitting(false)
      if (active.current === request) active.current = null
    }
  }
  const submit = (request: CreateTaskRequest) => {
    if (pending || active.current) return
    void send({ key: crypto.randomUUID(), request: structuredClone(request) })
  }
  const retry = () => { if (pending) void send(pending) }
  const discard = () => { if (!active.current) { save(null); setError(null) } }
  return { pending, submitting, error, submit, retry, discard }
}
