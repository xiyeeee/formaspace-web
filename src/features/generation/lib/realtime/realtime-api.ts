import { z } from 'zod'
import { apiRequest } from '@/lib/api-client'
import { env } from '@/lib/env'
import { previewResponseSchema } from './generation-events'

const ticketSchema = z.object({ ticket: z.string().min(1).max(4096), expiresIn: z.number().int().positive(), webSocketPath: z.literal('/ws/generation') })
export const getSocketTicket = (signal: AbortSignal) => apiRequest('ws/tickets', ticketSchema, { auth: 'protected', method: 'POST', signal })
export const getTaskPreview = (taskId: string, version: number, signal: AbortSignal) =>
  apiRequest(`generation/tasks/${encodeURIComponent(taskId)}/previews/${version}`, previewResponseSchema, { auth: 'protected', signal })
export const createSocketUrl = (ticket: z.infer<typeof ticketSchema>) => {
  const api = new URL(env.apiBaseUrl, window.location.href)
  const socket = new URL(ticket.webSocketPath, api.origin)
  socket.protocol = window.location.protocol === 'https:' || api.protocol === 'https:' ? 'wss:' : 'ws:'
  socket.searchParams.set('ticket', ticket.ticket)
  return socket.href
}
