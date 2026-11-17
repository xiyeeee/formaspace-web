import { ApiError } from '@/lib/http'
import { createSocketUrl, getSocketTicket } from './realtime-api'
import { parseGenerationMessage, RealtimeProtocolError } from './generation-events'
import type { GenerationEvent, GenerationMessage } from './generation-events'

export type SocketConnection = 'connecting' | 'subscribing' | 'connected' | 'reconnecting' | 'closed'
type Options = {
  taskId: string
  isCurrent?: () => boolean
  onConnection: (state: SocketConnection, message: string | null) => void
  onSubscribe: () => void
  onEvent: (event: GenerationMessage) => 'resubscribe' | void
}
export const createGenerationSocket = ({ taskId, onConnection, onSubscribe, onEvent, isCurrent = () => true }: Options) => {
  let active = false
  let stopped = false
  let generation = 0
  let socket: WebSocket | null = null
  let ticketRequest: AbortController | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeatTimer: ReturnType<typeof setTimeout> | undefined
  let pongTimer: ReturnType<typeof setTimeout> | undefined
  let subscribeTimer: ReturnType<typeof setTimeout> | undefined
  let resubscribeTimer: ReturnType<typeof setTimeout> | undefined
  let waitingPong: string | null = null
  let attempts = 0
  let gapRecoveries: number[] = []
  const clearTimers = () => {
    clearTimeout(reconnectTimer); clearTimeout(heartbeatTimer); clearTimeout(pongTimer)
    clearTimeout(subscribeTimer); clearTimeout(resubscribeTimer)
    reconnectTimer = heartbeatTimer = pongTimer = subscribeTimer = resubscribeTimer = undefined
    waitingPong = null
  }
  const send = (message: object) => {
    if (socket?.readyState !== WebSocket.OPEN) return false
    try { socket.send(JSON.stringify({ protocolVersion: 1, ...message })); return true } catch { return false }
  }
  const detach = (code = 1000) => {
    generation++
    ticketRequest?.abort()
    ticketRequest = null
    clearTimers()
    const previous = socket
    socket = null
    if (previous) {
      previous.onopen = previous.onmessage = previous.onerror = previous.onclose = null
      if (previous.readyState === WebSocket.OPEN) {
        try { previous.send(JSON.stringify({ protocolVersion: 1, type: 'unsubscribe', taskId })) } catch { /* 断线时不需要重试退订。 */ }
      }
      if (previous.readyState < WebSocket.CLOSING) previous.close(code)
    }
  }
  const stop = (message: string | null, code = 1000) => {
    stopped = true
    detach(code)
    if (active) onConnection('closed', message)
  }
  const scheduleReconnect = (message: string) => {
    detach()
    if (!active || stopped || !isCurrent()) return
    if (attempts >= 8) { stop('实时连接多次失败，已保留任务查询；可手动重试'); return }
    onConnection('reconnecting', message)
    if (document.hidden) return
    const delay = Math.min(1000 * 2 ** Math.min(attempts++, 5), 30_000) * (0.8 + Math.random() * 0.2)
    reconnectTimer = setTimeout(() => { reconnectTimer = undefined; void connect() }, delay)
  }
  const ping = () => {
    if (!active || stopped || !isCurrent() || document.hidden || socket?.readyState !== WebSocket.OPEN) return
    waitingPong = crypto.randomUUID()
    if (!send({ type: 'ping', requestId: waitingPong })) { scheduleReconnect('实时连接已断开，正在恢复'); return }
    pongTimer = setTimeout(() => scheduleReconnect('实时心跳超时，正在恢复连接'), 10_000)
  }
  const armHeartbeat = () => {
    clearTimeout(heartbeatTimer)
    if (!document.hidden) heartbeatTimer = setTimeout(ping, 25_000)
  }
  const subscribe = () => {
    clearTimeout(subscribeTimer)
    onSubscribe()
    onConnection('subscribing', null)
    if (!send({ type: 'subscribe', taskId })) { scheduleReconnect('任务订阅失败，正在恢复'); return }
    subscribeTimer = setTimeout(() => scheduleReconnect('未收到任务快照，正在恢复连接'), 10_000)
  }
  const resubscribe = () => {
    if (resubscribeTimer || stopped || !active) return
    resubscribeTimer = setTimeout(() => {
      resubscribeTimer = undefined
      const now = Date.now()
      gapRecoveries = gapRecoveries.filter((time) => now - time < 30_000)
      gapRecoveries.push(now)
      if (gapRecoveries.length > 6) { stop('实时消息持续缺失，已切换任务查询，请稍后重试'); return }
      if (gapRecoveries.length > 3) { scheduleReconnect('实时消息缺号，正在重新连接'); return }
      send({ type: 'unsubscribe', taskId })
      subscribe()
    }, 600)
  }
  const handleMessage = (message: GenerationMessage) => {
    if ('taskId' in message && message.taskId && message.taskId !== taskId) return
    if (message.type === 'pong') {
      if (message.requestId !== waitingPong) return
      clearTimeout(pongTimer)
      waitingPong = null
      attempts = 0
      armHeartbeat()
      return
    }
    if (message.type === 'error') {
      if (message.code === 'UNAUTHORIZED') { scheduleReconnect('正在重新验证实时连接'); return }
      stop(message.code === 'NOT_FOUND' || message.code === 'TASK_NOT_FOUND' || message.code === 'FORBIDDEN' ? '当前任务不可订阅，已保留任务查询' : '实时订阅被服务拒绝，已保留任务查询')
      return
    }
    const result = onEvent(message)
    if (!active || stopped || !isCurrent()) return
    if (result === 'resubscribe') { resubscribe(); return }
    if (message.type === 'task_snapshot') {
      clearTimeout(subscribeTimer)
      onConnection('connected', null)
      armHeartbeat()
    }
  }
  const connect = async () => {
    if (!active || stopped || !isCurrent() || document.hidden) return
    detach()
    const current = generation
    const controller = new AbortController()
    ticketRequest = controller
    onConnection(attempts ? 'reconnecting' : 'connecting', null)
    try {
      const ticket = await getSocketTicket(controller.signal)
      if (!active || stopped || !isCurrent() || current !== generation || controller.signal.aborted) return
      const connection = new WebSocket(createSocketUrl(ticket))
      socket = connection
      // ticket 只在本次握手闭包中使用，不缓存或记录。
      subscribeTimer = setTimeout(() => scheduleReconnect('实时握手超时，正在恢复连接'), 10_000)
      const valid = () => active && !stopped && isCurrent() && current === generation && socket === connection
      connection.onopen = () => { if (valid()) subscribe() }
      connection.onmessage = (event) => {
        if (!valid()) return
        try { handleMessage(parseGenerationMessage(event.data)) }
        catch (error) {
          stop(error instanceof RealtimeProtocolError ? error.message : '实时消息处理失败，已保留任务查询', error instanceof RealtimeProtocolError ? error.closeCode : 1002)
        }
      }
      connection.onerror = () => { /* 等待 close 获取关闭码，不能把网络错误当作 JWT 失效。 */ }
      connection.onclose = (event) => {
        if (!valid()) return
        if (event.code === 1008) { stop('实时连接被策略拒绝，请重新检查账号或服务配置'); return }
        if (event.code === 1009) { stop('实时消息超过大小限制，已切换任务查询'); return }
        scheduleReconnect(event.code === 4001 ? '正在重新验证实时连接' : event.code === 1013 ? '实时服务繁忙，正在等待重连' : '实时连接已断开，正在恢复')
      }
    } catch (error) {
      if (!active || current !== generation || controller.signal.aborted) return
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        stop(error.status === 404 ? '实时接口尚未部署，正在定时查询任务状态' : error.status === 401 ? '实时票据验证失败，请重新登录' : '当前账号无法建立实时连接')
        return
      }
      if (error instanceof ApiError && error.code === 'INVALID_RESPONSE') { stop('实时票据接口与当前协议不一致，已保留任务查询'); return }
      scheduleReconnect('实时连接暂不可用，正在定时查询任务状态')
    }
  }
  const visibilityChanged = () => {
    if (!active || stopped || !isCurrent()) return
    if (document.hidden) {
      clearTimeout(heartbeatTimer); clearTimeout(pongTimer); clearTimeout(reconnectTimer)
      heartbeatTimer = pongTimer = reconnectTimer = undefined
      waitingPong = null
    } else if (socket?.readyState === WebSocket.OPEN) {
      clearTimeout(pongTimer)
      ping()
    } else { void connect() }
  }
  return {
    start: () => { active = true; stopped = false; document.addEventListener('visibilitychange', visibilityChanged); void connect() },
    retry: () => { stopped = false; attempts = 0; gapRecoveries = []; void connect() },
    finish: () => stop(null),
    dispose: () => { active = false; stopped = true; document.removeEventListener('visibilitychange', visibilityChanged); detach() },
  }
}

export const isBusinessEvent = (message: GenerationMessage): message is GenerationEvent => 'sequence' in message
